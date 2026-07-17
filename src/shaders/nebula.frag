// Home page backdrop: slow domain-warped nebula in studio violets.
// (noise chunk is prepended at build time — see src/shaders/index.ts)
varying vec2 vUv;

uniform float uTime;
uniform float uScroll;   // 0..1 page scroll progress, drives the drift
uniform float uAspect;
uniform vec2 uPointer;   // normalized pointer, subtle warp
uniform vec3 uColorA;    // deep base
uniform vec3 uColorB;    // mid cloud
uniform vec3 uColorC;    // accent glow

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  uv += uPointer * 0.035;

  float t = uTime * 0.02;
  vec2 q = vec2(fbm(uv * 1.4 + t), fbm(uv * 1.4 - t * 0.7 + 3.1));
  float f = fbm(uv * 1.8 + q * 1.6 + vec2(0.0, uScroll * 1.6));

  vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.85, f));
  col += uColorC * pow(max(f - 0.45, 0.0), 2.0) * 1.5;

  float vig = smoothstep(1.25, 0.35, length(uv));
  col *= 0.35 + 0.65 * vig;

  gl_FragColor = vec4(col, 1.0);
}
