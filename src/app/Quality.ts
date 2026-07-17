/**
 * Device capability detection. Detected once at startup and passed to every
 * system so particle counts, pixel ratio, and motion all scale together.
 */
export interface QualityProfile {
  /** Renderer pixel-ratio cap. Never above 2 — retina beyond that is wasted fill rate. */
  dpr: number;
  /** Multiplier (0..1) applied to particle/instance counts in scenes. */
  density: number;
  antialias: boolean;
  /** True when the OS asks for reduced motion — disables smoothing and idle drift. */
  reducedMotion: boolean;
  /** Coarse pointer ≈ touch device: no hover parallax. */
  touch: boolean;
}

export function detectQuality(): QualityProfile {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;

  // Three rough tiers: phones/weak laptops, mid, desktop.
  const low = touch && (smallScreen || cores <= 4);
  const high = !touch && cores >= 8;

  return {
    dpr: Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2),
    density: low ? 0.35 : high ? 1 : 0.65,
    antialias: !low,
    reducedMotion,
    touch,
  };
}

/** Cheap WebGL support probe so non-WebGL browsers fall back to the CSS-only page. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
