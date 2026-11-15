let ctx: AudioContext | null = null;
let enabled = true;

export function setAudioEnabled(v: boolean) {
  enabled = v;
}

type Voice = "approve" | "undo" | "done" | "alert" | "tick" | "open";

const RECIPES: Record<Voice, { f: number[]; type: OscillatorType; dur: number; gain: number }> = {
  approve: { f: [523.25, 783.99], type: "sine", dur: 0.16, gain: 0.05 },
  undo: { f: [440, 293.66], type: "sine", dur: 0.18, gain: 0.045 },
  done: { f: [523.25, 659.25, 987.77], type: "triangle", dur: 0.2, gain: 0.05 },
  alert: { f: [330, 247], type: "sawtooth", dur: 0.14, gain: 0.028 },
  tick: { f: [1200], type: "square", dur: 0.03, gain: 0.012 },
  open: { f: [660], type: "sine", dur: 0.07, gain: 0.03 },
};

/** Tiny, deliberately quiet UI voice. Every sound is tied to a visible event. */
export function blip(voice: Voice) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const r = RECIPES[voice];
    const t0 = ctx.currentTime;
    r.f.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = r.type;
      osc.frequency.setValueAtTime(freq, t0 + i * r.dur * 0.55);
      g.gain.setValueAtTime(0.0001, t0 + i * r.dur * 0.55);
      g.gain.exponentialRampToValueAtTime(r.gain, t0 + i * r.dur * 0.55 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * r.dur * 0.55 + r.dur);
      osc.connect(g).connect(ctx!.destination);
      osc.start(t0 + i * r.dur * 0.55);
      osc.stop(t0 + i * r.dur * 0.55 + r.dur + 0.02);
    });
  } catch {
    /* audio unavailable — silent fallback */
  }
}