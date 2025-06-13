// public/mic-worklet.js
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.samplesPerChunk = 4800; // 100ms @ 48kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      this.buffer.push(...input[0]);

      if (this.buffer.length >= this.samplesPerChunk) {
        const chunk = new Float32Array(this.buffer.slice(0, this.samplesPerChunk));
        this.port.postMessage(chunk);
        this.buffer = this.buffer.slice(this.samplesPerChunk);
      }
    }
    return true;
  }
}
registerProcessor("mic-processor", MicProcessor);