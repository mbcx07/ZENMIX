// zenmix-processor.ts — AudioWorklet processor for offline mixing
// Runs on the Audio Rendering Thread (not main thread, not a Web Worker)
// Zero-copy: receives buffers via SharedArrayBuffer when available
//
// IMPORTANT: This file is loaded via audioWorklet.addModule()
// It runs in AudioWorkletGlobalScope — no DOM, no window, limited APIs

class ZenMixProcessor extends AudioWorkletProcessor {
  // AudioWorklet processes 128 frames per callback
  // For offline rendering, we just pass through and accumulate
  
  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    // Passthrough — actual mixing happens in the graph connected externally
    // This processor exists as a synchronization point for the worklet pipeline
    const output = outputs[0];
    if (output && output.length > 0) {
      // Zero out output buffers (silence passthrough)
      for (let ch = 0; ch < output.length; ch++) {
        output[ch].fill(0);
      }
    }
    // Keep alive
    return true;
  }
}

registerProcessor('zenmix-processor', ZenMixProcessor);
