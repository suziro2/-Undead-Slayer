// Synthesized audio only (WebAudio oscillators and noise): no audio files are shipped.
class Audio {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    this.track = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.musicVolume * 0.25;
    this.sfxGain.gain.value = this.sfxVolume * 0.5;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, when = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.25) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  sfx(name) {
    switch (name) {
      case 'swing': this.noise(0.08, 0.15); this.tone(520, 0.08, { type: 'triangle', slide: -300, vol: 0.12 }); break;
      case 'hit': this.noise(0.1, 0.3); this.tone(180, 0.12, { type: 'sawtooth', slide: -120, vol: 0.2 }); break;
      case 'hurt': this.tone(140, 0.25, { type: 'sawtooth', slide: -80, vol: 0.25 }); break;
      case 'shot': this.tone(880, 0.12, { type: 'triangle', slide: -500, vol: 0.12 }); break;
      case 'magic': this.tone(300, 0.3, { type: 'sine', slide: 500, vol: 0.2 }); break;
      case 'coin': this.tone(988, 0.08, { type: 'square', vol: 0.12 }); this.tone(1319, 0.12, { type: 'square', vol: 0.12, when: 0.08 }); break;
      case 'potion': this.tone(523, 0.1, { type: 'triangle', vol: 0.2 }); this.tone(784, 0.14, { type: 'triangle', vol: 0.2, when: 0.1 }); break;
      case 'dodge': this.tone(660, 0.15, { type: 'sine', slide: -400, vol: 0.15 }); break;
      case 'death': this.tone(300, 0.5, { type: 'sawtooth', slide: -250, vol: 0.2 }); break;
      case 'boss': this.tone(90, 0.8, { type: 'sawtooth', slide: -40, vol: 0.3 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.15, when: i * 0.12 })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.2, when: i * 0.2 })); break;
      case 'summon': this.tone(200, 0.6, { type: 'sine', slide: 900, vol: 0.2 }); this.noise(0.4, 0.08); break;
      case 'reveal': this.tone(880, 0.1, { type: 'square', vol: 0.12 }); this.tone(1320, 0.2, { type: 'square', vol: 0.1, when: 0.07 }); break;
      case 'click': this.tone(700, 0.04, { type: 'square', vol: 0.06 }); break;
      case 'error': this.tone(160, 0.15, { type: 'square', vol: 0.12 }); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.2, when: i * 0.09 })); break;
      default: break;
    }
  }

  // Simple looping chord progression; each track is a set of root notes (Hz).
  playMusic(track = 'field') {
    if (!this.ctx || this.track === track) return;
    this.stopMusic();
    this.track = track;
    const progressions = {
      field: [[220, 262, 330], [175, 220, 262], [196, 247, 294], [262, 330, 392]],
      boss: [[110, 131, 165], [104, 124, 156], [98, 117, 147], [123, 147, 185]],
      menu: [[262, 330, 392], [220, 262, 330], [174, 220, 262], [196, 247, 294]],
    };
    const chords = progressions[track] || progressions.field;
    let step = 0;
    const play = () => {
      const chord = chords[step % chords.length];
      chord.forEach((f, i) => this.tone(f, 1.7, { type: 'triangle', vol: 0.05 / (i + 1), when: i * 0.02 }));
      this.tone(chord[0] / 2, 0.9, { type: 'sine', vol: 0.08 });
      step += 1;
    };
    play();
    this.musicTimer = setInterval(play, 1900);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.track = null;
  }
}

export const audio = new Audio();
