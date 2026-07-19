// Hero star field: tiny ink stars twinkle in place, then rise, recede, and
// defocus as uExit runs 0 → 1 (scroll leaving the hero beat).
attribute float aSeed;

uniform float uTime;
uniform float uExit;
uniform float uSize;
uniform float uScale;

varying float vAlpha;
varying float vBlur;
varying float vRot;
varying float vHue;

void main() {
  vec3 pos = position;
  // Blow out radially — spread hard enough toward the screen edges to beat
  // the shrink from receding — while drifting up and away from the camera.
  pos.xy *= 1.0 + uExit * (2.2 + aSeed * 1.5);
  pos.y += uExit * (2.5 + aSeed * 2.0);
  pos.z -= uExit * (5.0 + aSeed * 3.0);

  // Twinkle cycle: each star rests small, then blooms up while spinning
  // fast and shrinks back. The whole small → big → small pulse is squeezed
  // into a ~1 s window at the start of the multi-second cycle; the star
  // rests for the remainder. Rotation completes whole turns per pulse so
  // the wrap is seamless.
  float rate = 0.12 + aSeed * 0.18;
  float cycle = fract(uTime * rate + aSeed * 7.0);
  float window = 1.0 * rate; // 1 s as a fraction of this star's cycle
  float local = clamp(cycle / window, 0.0, 1.0);
  float pulse = sin(3.14159 * local);
  pulse = pulse * pulse * pulse;
  vRot = aSeed * 6.2832 + local * 6.2832 * (1.0 + floor(aSeed * 2.0));
  vBlur = uExit;
  vAlpha = 1.0 - uExit;
  // Same drift rate as the nebula's chroma() call, but offset a third of a
  // cycle so the stars never sit on the nebula's current hue.
  vHue = 0.33 + pos.x * 0.012 + uTime * 0.02;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  // Defocus reads as growing softly while losing alpha, so scale up with exit.
  // Rest size is half the twinkle peak so stars stay visible between pulses.
  float size = uSize * (0.6 + 0.9 * aSeed) * (0.75 + 0.75 * pulse) * (1.0 + uExit * 2.5);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
