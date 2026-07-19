// Home page backdrop: paper-white field with slow black ink-nebula clouds
// while the hero is on screen (uClouds 1 → 0 fades them with the hero exit).
// Needs the shared noise chunk (fbm) prepended by src/shaders/index.ts.
varying vec2 vUv;

uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;    // page white
uniform vec3 uColorB;    // faint corner wash so the field isn't sterile
uniform vec3 uColorC;    // unused (nebula color comes from the shared chroma())
uniform float uClouds;   // hero-exit fade for the nebula
uniform vec2 uMouse;     // smoothed pointer, aspect-corrected uv space
uniform vec2 uMouseVel;  // smoothed pointer velocity (uv units / s, clamped)

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  float wash = smoothstep(0.55, 1.25, length(uv));
  vec3 col = mix(uColorA, uColorB, wash * 0.6);

  if (uClouds > 0.003) {
    // Liquid distortion around the cursor (hero only — uClouds gates it):
    // pixels near the pointer get dragged along the stroke, swirled around
    // it, and rippled by rings breathing outward. It all warps the uv the
    // nebula samples, so the clouds smear like ink stirred in water.
    vec2 duv = uv;
    vec2 d = uv - uMouse;
    float r = length(d);
    float influence = exp(-r * r * 18.0) * uClouds;
    vec2 swirl = vec2(-d.y, d.x) * length(uMouseVel) * 0.25;
    duv -= (uMouseVel * 0.35 + swirl) * influence;
    duv -= (d / max(r, 0.001)) * sin(r * 30.0 - uTime * 3.0) * 0.015 * influence;

    // Domain-warped fbm: one fbm pair bends the lookup of a second, which
    // turns blobby noise into wispy nebula filaments. Drifts slowly; the
    // pointer nudges it for a touch of parallax.
    // Higher frequency = several distributed banks on screen from frame one
    // (at lower frequency a single noise blob could own one side for
    // minutes). The uTime advection slides the whole pattern leftward fast
    // enough to feel alive — a bank crosses the screen in under a minute.
    vec2 p = duv * 2.2 + vec2(uTime * 0.08, 0.0) + uPointer * 0.06;
    vec2 q = vec2(
      fbm(p + vec2(0.0, uTime * 0.06)),
      fbm(p + vec2(5.2, 1.3) - uTime * 0.04)
    );
    float n = fbm(p + 1.6 * q);
    // Low threshold, long ramp: broad connected cloud banks across the whole
    // field rather than sparse islands. The hero copy's white halo carries
    // legibility, so no center clearing is carved out.
    float nebula = smoothstep(0.32, 0.8, n);
    // Hue drifts with time and swirls with the same warp field that shapes
    // the clouds, so color bands follow the filaments instead of sitting in
    // flat stripes.
    vec3 ink = chroma(uv.x * 0.12 + q.x * 0.3 + uTime * 0.02);
    col = mix(col, ink, nebula * 0.6 * uClouds);
  }

  gl_FragColor = vec4(col, 1.0);
}
