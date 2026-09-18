let ctx: AudioContext | null = null;
let audioOk = false;

export function tryEnableAudio() {
  if (audioOk) return;
  try {
    if (!ctx) ctx = new AudioContext();
    void ctx.resume().then(() => {
      if (ctx?.state === "running") audioOk = true;
    });
  } catch {
    // Web Audio no disponible en este navegador
  }
}

function tone(freq: number, type: OscillatorType, vol: number, dur: number, ret = 0) {
  if (!ctx || !audioOk) return;
  const t = ctx.currentTime + ret;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
}

export function sonarCritica() {
  [0, 0.22, 0.44, 0.66, 0.88].forEach((r) => {
    tone(1200, "sawtooth", 0.35, 0.2, r);
    tone(900, "sawtooth", 0.25, 0.2, r + 0.1);
  });
}

export function sonarInfo() {
  ([[700, 0], [560, 0.32], [440, 0.64]] as const).forEach(([f, r]) => tone(f, "sine", 0.13, 0.28, r));
}

export function sonarRecuperado() {
  tone(440, "sine", 0.1, 0.25, 0);
  tone(660, "sine", 0.1, 0.25, 0.28);
}

export function isAudioEnabled() {
  return audioOk;
}
