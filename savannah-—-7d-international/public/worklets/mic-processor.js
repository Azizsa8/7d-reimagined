/**
 * Savannah mic worklet: takes the device-rate mono input, low-pass averages and
 * decimates it to 16 kHz, converts to PCM16 and posts ~30 ms frames (480 samples)
 * as transferable ArrayBuffers. Runs off the main thread.
 */
class SavannahMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;
    this.frameSamples = 480; // 30 ms at 16 kHz
    this.out = new Int16Array(this.frameSamples);
    this.outIndex = 0;
    this.acc = 0;
    this.accCount = 0;
    this.pos = 0; // fractional position in the input stream
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.muted === 'boolean') this.muted = e.data.muted;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    if (this.muted) return true;

    // Box-filter decimation: average every `ratio` input samples into one output sample.
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.accCount++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.accCount));
        this.acc = 0;
        this.accCount = 0;
        this.out[this.outIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.outIndex >= this.frameSamples) {
          const buf = this.out.buffer.slice(0);
          this.port.postMessage(buf, [buf]);
          this.outIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('savannah-mic', SavannahMicProcessor);
