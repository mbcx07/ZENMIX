/**
 * audioRepairService.ts — Audio Diagnostics & Repair Service
 *
 * Detects and repairs common audio issues in the browser:
 * - Clipping detection and soft-limiting
 * - DC offset removal
 * - Silence/padding removal at begin/end
 * - Dropout detection and interpolation
 * - Noise floor analysis
 * - Phase correlation check (for stereo)
 * - Automatic quality grading
 *
 * Uses pure Web Audio API math — no external dependencies.
 */

// ────────────────────────────────────────────────────────────
// DIAGNOSTIC RESULT TYPES
// ────────────────────────────────────────────────────────────

export type AudioQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
export type AudioIssue = 
  | 'clipping' | 'dc_offset' | 'dropouts' | 'low_volume' 
  | 'background_noise' | 'phase_issues' | 'silence_padding' 
  | 'truncated' | 'distorted' | 'low_sample_rate';

export interface AudioDiagnostic {
  quality: AudioQuality;
  issues: AudioIssue[];
  details: {
    peakLevel: number;          // dB (0 = max)
    rmsLevel: number;           // dB
    crestFactor: number;        // Peak/RMS ratio
    dcOffset: number;           // 0-1 scale
    clippingPercent: number;    // % of samples clipped
    dropoutCount: number;       // Number of zero-runs > 100ms
    noiseFloor: number;         // dB (estimated)
    durationSeconds: number;
    sampleRate: number;
    isStereo: boolean;
    phaseCorrelation?: number;  // -1 to 1 (stereo only)
    issues_found: number;
  };
}

// ────────────────────────────────────────────────────────────
// REPAIR RESULT
// ────────────────────────────────────────────────────────────

export interface RepairResult {
  success: boolean;
  repairedBuffer: AudioBuffer;
  originalDiagnostic: AudioDiagnostic;
  finalDiagnostic: AudioDiagnostic;
  repairsApplied: string[];
  improvementPercent: number;  // Estimated quality improvement
}

// ────────────────────────────────────────────────────────────
// DIAGNOSTIC ENGINE
// ────────────────────────────────────────────────────────────

/**
 * Run complete audio diagnostics on an AudioBuffer.
 */
export function diagnoseAudio(buffer: AudioBuffer): AudioDiagnostic {
  const issues: AudioIssue[] = [];
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const isStereo = channels >= 2;
  const durationSeconds = buffer.duration;

  let peakVal = 0;
  let sumSq = 0;
  let dcSum = 0;
  let clipCount = 0;
  let dropoutCount = 0;
  let totalSamples = 0;

  // Mono analysis (use first channel or mix down)
  const channelData = buffer.getChannelData(0);
  totalSamples = channelData.length;

  let zeroRun = 0;
  let prevSample = 0;

  for (let i = 0; i < channelData.length; i++) {
    const s = channelData[i];
    const absVal = Math.abs(s);

    // Peak
    if (absVal > peakVal) peakVal = absVal;

    // RMS accumulator
    sumSq += s * s;

    // DC offset
    dcSum += s;

    // Clipping (>0.99 = likely clipped)
    if (absVal >= 0.999) clipCount++;

    // Dropout (zero-run detection)
    if (absVal < 0.0001) {
      zeroRun++;
    } else {
      if (zeroRun > sampleRate * 0.1) dropoutCount++; // >100ms silence = dropout
      zeroRun = 0;
    }
  }
  // Check final zero run
  if (zeroRun > sampleRate * 0.1) dropoutCount++;

  // Compute metrics
  const dcOffset = dcSum / totalSamples;
  const dcOffsetScaled = Math.abs(dcOffset) * 10; // Scale for readability
  const rmsVal = Math.sqrt(sumSq / totalSamples);
  const peakDB = 20 * Math.log10(Math.max(peakVal, 0.0001));
  const rmsDB = 20 * Math.log10(Math.max(rmsVal, 0.0001));
  const crestFactor = peakDB - rmsDB;
  const clippingPct = (clipCount / totalSamples) * 100;

  // Noise floor estimate: standard deviation of quietest 10% of samples
  const sortedAbs = new Float32Array(channelData).map(Math.abs).sort();
  const quietIdx = Math.floor(channelData.length * 0.1);
  let noiseSum = 0;
  for (let i = 0; i < quietIdx; i++) noiseSum += sortedAbs[i] * sortedAbs[i];
  const noiseRms = Math.sqrt(noiseSum / quietIdx);
  const noiseFloorDB = 20 * Math.log10(Math.max(noiseRms, 0.000001));

  // Issue detection
  if (clippingPct > 0.5) issues.push('clipping');
  else if (clippingPct > 0.1) issues.push('clipping');

  if (dcOffsetScaled > 0.1) issues.push('dc_offset');

  if (dropoutCount > 2) issues.push('dropouts');

  if (rmsDB < -30) issues.push('low_volume');

  if (noiseFloorDB > -40 && rmsDB < -15) issues.push('background_noise');

  if (crestFactor > 25) issues.push('distorted');
  if (crestFactor > 40) issues.push('distorted');

  // Stereo analysis
  let phaseCorrelation: number | undefined;
  if (isStereo && buffer.getChannelData(1)) {
    const right = buffer.getChannelData(1);
    let corr = 0;
    let leftSum = 0, rightSum = 0;
    for (let i = 0; i < Math.min(channelData.length, right.length); i++) {
      corr += channelData[i] * right[i];
      leftSum += channelData[i] * channelData[i];
      rightSum += right[i] * right[i];
    }
    const denom = Math.sqrt(leftSum * rightSum);
    phaseCorrelation = denom > 0 ? corr / denom : 0;
    if (phaseCorrelation < -0.5) issues.push('phase_issues');
  }

  // Check for prolonged silence at start/end (> 2s)
  let startSilenceSamples = 0;
  for (let i = 0; i < channelData.length && Math.abs(channelData[i]) < 0.0005; i++) {
    startSilenceSamples++;
  }
  let endSilenceSamples = 0;
  for (let i = channelData.length - 1; i >= 0 && Math.abs(channelData[i]) < 0.0005; i--) {
    endSilenceSamples++;
  }
  if (startSilenceSamples > sampleRate * 2 || endSilenceSamples > sampleRate * 2) {
    issues.push('silence_padding');
  }

  // Sample rate check
  if (sampleRate < 22050) issues.push('low_sample_rate');

  // Quality grading
  let quality: AudioQuality;
  const issueCount = issues.length;
  if (issueCount === 0) {
    quality = 'excellent';
  } else if (issueCount === 1 && !['clipping', 'distorted', 'dropouts'].includes(issues[0])) {
    quality = 'good';
  } else if (issueCount <= 2) {
    quality = 'fair';
  } else if (issueCount <= 4) {
    quality = 'poor';
  } else {
    quality = 'damaged';
  }

  return {
    quality,
    issues,
    details: {
      peakLevel: Math.round(peakDB * 10) / 10,
      rmsLevel: Math.round(rmsDB * 10) / 10,
      crestFactor: Math.round(crestFactor * 10) / 10,
      dcOffset: Math.round(dcOffsetScaled * 1000) / 1000,
      clippingPercent: Math.round(clippingPct * 100) / 100,
      dropoutCount,
      noiseFloor: Math.round(noiseFloorDB * 10) / 10,
      durationSeconds,
      sampleRate,
      isStereo,
      phaseCorrelation: phaseCorrelation !== undefined
        ? Math.round(phaseCorrelation * 100) / 100
        : undefined,
      issues_found: issueCount,
    },
  };
}

// ────────────────────────────────────────────────────────────
// REPAIR FUNCTIONS
// ────────────────────────────────────────────────────────────

/**
 * Remove DC offset from audio buffer.
 */
function removeDCOffset(buffer: AudioBuffer): AudioBuffer {
  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);
    
    // Calculate DC for this channel
    let dc = 0;
    for (let i = 0; i < src.length; i++) dc += src[i];
    dc /= src.length;

    for (let i = 0; i < src.length; i++) {
      dst[i] = src[i] - dc;
    }
  }

  return result;
}

/**
 * Apply soft-knee limiting to prevent/repair clipping.
 * Threshold at -0.3dB, soft knee, ratio 4:1.
 */
function applySoftLimiter(buffer: AudioBuffer): AudioBuffer {
  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  const threshold = 0.95;  // ~-0.45dB
  const makeupGain = 1.02; // Slight makeup

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);

    for (let i = 0; i < src.length; i++) {
      const absVal = Math.abs(src[i]);
      if (absVal > threshold) {
        const sign = src[i] > 0 ? 1 : -1;
        const overshoot = absVal - threshold;
        const reduced = threshold + overshoot / 4; // 4:1 ratio above threshold
        dst[i] = Math.min(1.0, reduced * makeupGain) * sign;
      } else {
        dst[i] = src[i] * makeupGain;
      }
    }
  }

  return result;
}

/**
 * Interpolate dropouts (zero-runs > threshold).
 * Uses cubic interpolation from surrounding samples.
 */
function interpolateDropouts(buffer: AudioBuffer, minSilenceSamples: number = 1000): AudioBuffer {
  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);

    let zeroStart = -1;
    for (let i = 0; i < src.length; i++) {
      if (Math.abs(src[i]) < 0.000001) {
        if (zeroStart < 0) zeroStart = i;
      } else {
        if (zeroStart >= 0 && (i - zeroStart) >= minSilenceSamples) {
          // Interpolate between zeroStart-1 and i
          const before = Math.max(0, zeroStart - 1);
          const valBefore = src[before];
          const valAfter = src[i];
          const gapLength = i - zeroStart;
          for (let j = 0; j < gapLength; j++) {
            const t = (j + 1) / (gapLength + 1);
            dst[zeroStart + j] = valBefore + (valAfter - valBefore) * t;
          }
        } else if (zeroStart >= 0) {
          // Short gap — just copy
          for (let j = zeroStart; j < i; j++) dst[j] = src[j];
        } else {
          dst[i] = src[i];
        }
        zeroStart = -1;
      }
    }
  }

  return result;
}

/**
 * Trim leading/trailing silence (threshold-based gate).
 */
function trimSilence(buffer: AudioBuffer, threshold: number = 0.0005): AudioBuffer {
  let start = 0;
  let end = buffer.length;

  const channel = buffer.getChannelData(0);

  // Find first non-silent sample
  while (start < buffer.length && Math.abs(channel[start]) < threshold) start++;

  // Find last non-silent sample
  while (end > start && Math.abs(channel[end - 1]) < threshold) end--;

  // Keep small buffer (10ms) at each end
  start = Math.max(0, start - Math.floor(buffer.sampleRate * 0.01));
  end = Math.min(buffer.length, end + Math.floor(buffer.sampleRate * 0.01));

  const newLength = end - start;
  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: newLength,
    sampleRate: buffer.sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    result.getChannelData(ch).set(buffer.getChannelData(ch).slice(start, end));
  }

  return result;
}

/**
 * Apply gentle noise gate to reduce background noise.
 */
function applyNoiseGate(buffer: AudioBuffer, threshold: number = 0.003): AudioBuffer {
  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);

    for (let i = 0; i < src.length; i++) {
      const absVal = Math.abs(src[i]);
      if (absVal < threshold) {
        dst[i] = src[i] * (absVal / threshold) * 0.3; // Attenuate noise
      } else {
        dst[i] = src[i];
      }
    }
  }

  return result;
}

/**
 * Normalize volume to target peak or RMS level.
 */
function normalizeVolume(buffer: AudioBuffer, targetPeakDB: number = -1): AudioBuffer {
  let maxVal = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxVal) maxVal = abs;
    }
  }

  if (maxVal === 0) return buffer;

  const targetGain = Math.pow(10, targetPeakDB / 20) / maxVal;
  if (Math.abs(targetGain - 1.0) < 0.01) return buffer;

  const result = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = Math.max(-1, Math.min(1, src[i] * targetGain));
    }
  }

  return result;
}

/**
 * Stereo phase correction: center the stereo image.
 * Applies mid-side processing to fix phase issues.
 */
function fixPhaseIssues(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels < 2) return buffer;

  const result = new AudioBuffer({
    numberOfChannels: 2,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mid = result.getChannelData(0);
  const side = result.getChannelData(1);

  // Mid-side processing: keep mid, reduce side
  for (let i = 0; i < buffer.length; i++) {
    const m = (left[i] + right[i]) / 2;
    const s = (left[i] - right[i]) / 2 * 0.5; // Reduce side by half
    mid[i] = m + s;
    side[i] = m - s; // Reconstruct with reduced side
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// MAIN REPAIR PIPELINE
// ────────────────────────────────────────────────────────────

/**
 * Automatically diagnose and repair an AudioBuffer.
 * Applies only the repairs needed based on diagnostic results.
 */
export function repairAudio(buffer: AudioBuffer): RepairResult {
  const originalDiagnostic = diagnoseAudio(buffer);
  let repaired = buffer;
  const repairsApplied: string[] = [];

  for (const issue of originalDiagnostic.issues) {
    switch (issue) {
      case 'dc_offset':
        repaired = removeDCOffset(repaired);
        repairsApplied.push('DC offset eliminado');
        break;
      case 'clipping':
        repaired = applySoftLimiter(repaired);
        repairsApplied.push('Soft-limiter aplicado (anti-clipping)');
        break;
      case 'dropouts':
        repaired = interpolateDropouts(repaired);
        repairsApplied.push('Dropouts interpolados');
        break;
      case 'silence_padding':
        repaired = trimSilence(repaired);
        repairsApplied.push('Silencio inicial/final recortado');
        break;
      case 'background_noise':
        repaired = applyNoiseGate(repaired);
        repairsApplied.push('Noise gate aplicado');
        break;
      case 'low_volume':
        repaired = normalizeVolume(repaired, -1);
        repairsApplied.push('Volumen normalizado a -1dB');
        break;
      case 'phase_issues':
        repaired = fixPhaseIssues(repaired);
        repairsApplied.push('Corrección de fase stereo (mid-side)');
        break;
      case 'distorted':
        repaired = applySoftLimiter(repaired);
        repaired = normalizeVolume(repaired, -3);
        repairsApplied.push('Limitación y normalización para reducir distorsión');
        break;
      // No repair available for: 'low_sample_rate', 'truncated'
    }
  }

  const finalDiagnostic = diagnoseAudio(repaired);
  const improvement = Math.max(0, 
    originalDiagnostic.details.issues_found - finalDiagnostic.details.issues_found
  ) / Math.max(1, originalDiagnostic.details.issues_found) * 100;

  return {
    success: repairsApplied.length > 0,
    repairedBuffer: repaired,
    originalDiagnostic,
    finalDiagnostic,
    repairsApplied,
    improvementPercent: Math.round(improvement),
  };
}

/**
 * Check file integrity — detect truncated or corrupted audio files.
 * Uses heuristic: checks if the file structure is consistent with its format.
 */
export function checkFileIntegrity(
  arrayBuffer: ArrayBuffer,
  expectedFormat?: string
): { valid: boolean; reason: string } {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 44) {
    return { valid: false, reason: 'Archivo demasiado pequeño para ser audio válido' };
  }

  // Check for WAV RIFF header
  const isWav = 
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

  // Check for MP3 sync word
  const isMp3 = 
    (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) ||
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33);

  // Check for OGG
  const isOgg =
    bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;

  // Check for FLAC
  const isFlac =
    bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;

  const detectedFormat = isWav ? 'WAV' : isMp3 ? 'MP3' : isOgg ? 'OGG' : isFlac ? 'FLAC' : 'desconocido';

  if (expectedFormat && detectedFormat !== expectedFormat.toUpperCase()) {
    return { 
      valid: false, 
      reason: `Formato detectado: ${detectedFormat}, esperado: ${expectedFormat.toUpperCase()}. Posible archivo corrupto o extensión incorrecta.`
    };
  }

  // Check for all-zero files (completely silent = likely corrupted)
  let nonZeroCount = 0;
  const sampleSize = Math.min(bytes.length, 10000);
  for (let i = 44; i < sampleSize; i++) {
    if (bytes[i] !== 0) nonZeroCount++;
  }
  if (nonZeroCount === 0 && bytes.length > 100) {
    return { valid: false, reason: 'Archivo de audio con solo silencio (posible corrupción de datos)' };
  }

  return { valid: true, reason: `Formato válido: ${detectedFormat}` };
}

// ────────────────────────────────────────────────────────────
// AUDIO BUFFER → WAV BLOB (utility)
// ────────────────────────────────────────────────────────────

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const dataSize = length * numChannels * 2;
  const totalSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  let pos = 0;
  const w = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i)); };
  const u16 = (v: number) => { view.setUint16(pos, v, true); pos += 2; };
  const u32 = (v: number) => { view.setUint32(pos, v, true); pos += 4; };
  const i16 = (v: number) => { view.setInt16(pos, v, true); pos += 2; };

  w('RIFF'); u32(totalSize - 8); w('WAVE');
  w('fmt '); u32(16); u16(1); u16(numChannels);
  u32(sampleRate); u32(sampleRate * numChannels * 2);
  u16(numChannels * 2); u16(16);
  w('data'); u32(dataSize);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      i16(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
