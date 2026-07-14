// Procedural SFX via WebAudio — no asset files needed. Synthesizes shots,
// hits, ability casts, and UI blips so the prototype ships self-contained.
export class Audio {
  constructor() {
    this.ctx = null
    this.master = null
  }
  _ensure() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.35
    this.master.connect(this.ctx.destination)
  }
  resume() { this._ensure(); this.ctx.resume?.() }

  _tone(freq, dur, type = 'sine', gain = 0.4, slideTo = null) {
    this._ensure()
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur)
  }
  _noise(dur, gain = 0.3) {
    this._ensure()
    const t = this.ctx.currentTime
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = this.ctx.createBufferSource(); src.buffer = buf
    const g = this.ctx.createGain(); g.gain.value = gain
    src.connect(g); g.connect(this.master); src.start(t)
  }

  shot() { this._tone(420, 0.08, 'square', 0.25, 90); this._noise(0.06, 0.18) }
  hit() { this._tone(880, 0.05, 'triangle', 0.3, 300) }
  kill() { this._tone(660, 0.12, 'sawtooth', 0.3, 990) }
  reload() { this._tone(200, 0.05, 'square', 0.2); setTimeout(() => this._tone(300, 0.05, 'square', 0.2), 120) }
  ability() { this._tone(140, 0.5, 'sine', 0.3, 700) }
  ui() { this._tone(520, 0.05, 'sine', 0.2) }
  roundStart() { this._tone(160, 0.5, 'sawtooth', 0.25, 520) }
}
