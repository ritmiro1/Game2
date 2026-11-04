let context = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = value;
}

export function playSound(kind = 'tick') {
  if (!enabled || typeof window === 'undefined') return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime;
    const presets = {
      tick: [260, 0.035, 'sine', 0.025],
      select: [410, 0.07, 'sine', 0.035],
      commit: [180, 0.16, 'triangle', 0.06],
      echo: [620, 0.35, 'sine', 0.045],
      damage: [90, 0.18, 'sawtooth', 0.07],
      shield: [330, 0.2, 'triangle', 0.045],
      control: [230, 0.14, 'sine', 0.04],
      capture: [440, 0.6, 'triangle', 0.065],
      heal: [520, 0.25, 'sine', 0.04],
      win: [660, 0.8, 'sine', 0.055],
    };
    const [frequency, duration, type, volume] = presets[kind] || presets.tick;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (kind === 'echo' || kind === 'capture' || kind === 'win') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
    if (kind === 'damage') oscillator.frequency.exponentialRampToValueAtTime(45, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  } catch {
    // Audio is decorative; browsers may deny it until the first user gesture.
  }
}
