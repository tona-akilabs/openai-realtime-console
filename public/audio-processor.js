// public/audio-processor.js
class MyAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // Options can be passed from the main thread, e.g., bufferSize
    // this.bufferSize = options.processorOptions.bufferSize || 128; // Default to 128 samples per block
    // this.audioBuffer = new Float32Array(this.bufferSize * 2); // Example buffer, adjust size as needed
    // this.bufferIndex = 0;

    // It's common to downsample and convert to Int16 PCM here if needed
    // For simplicity, this example just forwards Float32 data.
    // You'll need to adapt your downsampleTo16kHz and Int16 conversion logic here.
  }

  static get parameterDescriptors() {
    return [/* Define any custom AudioParams here if needed */];
  }

  process(inputs, outputs, parameters) {
    // inputs[0] is an array of channels, and inputs[0][0] is the Float32Array for the first channel.
    const inputChannelData = inputs[0][0];

    if (inputChannelData) {
      // Send the raw Float32Array data back to the main thread
      // Or process it (downsample, convert to PCM Int16) here
      // and then send the processed data.
      this.port.postMessage(inputChannelData.buffer, [inputChannelData.buffer]);
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('my-audio-processor', MyAudioProcessor);