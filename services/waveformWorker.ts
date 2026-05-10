// waveformWorker.ts — OffscreenCanvas-based waveform renderer
// Renders audio waveforms in a Web Worker so the main thread stays responsive.
// Uses OffscreenCanvas for GPU-accelerated rendering off the main thread.

interface WaveformRequest {
  id: string;
  type: 'render';
  audioData: Float32Array;
  width: number;
  height: number;
  color: string;
  bgColor: string;
}

interface WaveformResponse {
  id: string;
  type: 'ready';
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = async (e: MessageEvent<WaveformRequest>) => {
  const { id, audioData, width, height, color, bgColor } = e.data;

  // Lazy init canvas
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
  }

  if (!ctx) return;

  // Clear
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const midY = height / 2;
  const step = Math.max(1, Math.floor(audioData.length / width));

  // Draw waveform
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  let maxVal = 0;
  for (let x = 0; x < width; x++) {
    let sum = 0;
    const start = x * step;
    const end = Math.min(start + step, audioData.length);
    for (let i = start; i < end; i++) {
      sum += Math.abs(audioData[i]);
    }
    const avg = sum / (end - start);
    maxVal = Math.max(maxVal, avg);

    const y = midY - avg * midY;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();

  // Mirror (bottom half)
  ctx.beginPath();
  ctx.strokeStyle = color + '66'; // 40% opacity
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x++) {
    let sum = 0;
    const start = x * step;
    const end = Math.min(start + step, audioData.length);
    for (let i = start; i < end; i++) {
      sum += Math.abs(audioData[i]);
    }
    const avg = sum / (end - start);
    const y = midY + avg * midY;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Create ImageBitmap and transfer back
  const bitmap = await createImageBitmap(canvas);

  const response: WaveformResponse = { id, type: 'ready', bitmap, width, height };
  (self as any).postMessage(response, [bitmap]);
};
