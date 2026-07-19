// Shared slow-cycling chromatic palette (IQ cosine palette), kept a touch
// dark/rich so the hues carry on the paper-white field. Prepended to shaders
// by src/shaders/index.ts and inlined by InkGlobe — one definition for the
// nebula, the stars, and the globes so they all breathe the same colors.
// Call with t = (small spatial term) + uTime * 0.02.
vec3 chroma(float t) {
  return vec3(0.45) + 0.35 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}
