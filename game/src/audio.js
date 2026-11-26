// Canyon Arcade — every sound is synthesised here with WebAudio. No audio files
// are loaded: the engine hum is an oscillator, the chimes are sine notes, the
// impacts are filtered noise. Everything is guarded, so a browser that blocks
// audio (or a headless screenshot run) simply stays silent.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let alarmTimer = null;
  let alarmOn = false;
  let muted = false;

  /** Create the context on the first user gesture; browsers block it before. */
  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'sine';
      engineOsc2.frequency.value = 110;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      engineOsc2.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function resume() {
    if (ensure() && context.state === 'suspended') {
      context.resume().catch(() => {});
    }
  }

  /** A short sine note: the building block of chimes and beeps. */
  function note(frequency, startAt, duration, volume, type) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + startAt + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(context.currentTime + startAt);
      osc.stop(context.currentTime + startAt + duration + 0.05);
    } catch {
      // Silence is fine.
    }
  }

  /** A burst of filtered noise: impacts, crashes, wind. */
  function noise(duration, volume, filterFreq, type) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = type || 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
    } catch {
      // Silence is fine.
    }
  }

  return {
    /** Call from any user gesture so the engine can start. */
    unlock() {
      resume();
    },

    /** Continuous engine hum; `speed01` is 0..1 from throttle. */
    engine(speed01, running) {
      if (!ensure() || muted) return;
      try {
        const target = running ? 0.05 + 0.06 * speed01 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(52 + 58 * speed01, context.currentTime, 0.1);
        engineOsc2.frequency.setTargetAtTime(104 + 116 * speed01, context.currentTime, 0.1);
        engineFilter.frequency.setTargetAtTime(380 + 700 * speed01, context.currentTime, 0.1);
      } catch {
        // Silence is fine.
      }
    },

    /** Two bright notes: flying through a ring. */
    chime() {
      note(880, 0, 0.22, 0.22);
      note(1318.5, 0.07, 0.3, 0.18);
    },

    /** A dull thud plus a flutter: a bird strike. */
    thud() {
      noise(0.18, 0.5, 300);
      note(140, 0, 0.18, 0.3, 'triangle');
    },

    /** Metallic clatter, falling in pitch: a part tearing off. */
    clatter() {
      noise(0.35, 0.35, 2400, 'bandpass');
      note(420, 0, 0.3, 0.16, 'square');
      note(210, 0.12, 0.35, 0.14, 'square');
    },

    /** A scrape: the wall kissing the wing. */
    scrape() {
      noise(0.22, 0.3, 1800, 'bandpass');
    },

    /** A rising alarm while the wing is failing; call with false to stop it. */
    alarm(on) {
      if (on === alarmOn) return;
      alarmOn = on;
      if (!ensure()) return;
      if (on && !muted) {
        alarmTimer = window.setInterval(() => {
          note(660, 0, 0.12, 0.12, 'square');
          note(520, 0.16, 0.12, 0.12, 'square');
        }, 320);
      } else if (alarmTimer !== null) {
        window.clearInterval(alarmTimer);
        alarmTimer = null;
      }
    },

    /** A short arpeggio: mission complete. */
    fanfare() {
      note(523.25, 0, 0.25, 0.2);
      note(659.25, 0.12, 0.25, 0.2);
      note(783.99, 0.24, 0.25, 0.2);
      note(1046.5, 0.36, 0.5, 0.22);
    },

    /** A long noise burst: the plane going down. */
    crash() {
      noise(0.9, 0.6, 500);
      note(90, 0, 0.8, 0.3, 'triangle');
    },

    setMuted(value) {
      muted = value;
      if (muted && engineGain) {
        try {
          engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
        } catch {
          // Silence is fine.
        }
      }
    },
  };
}
