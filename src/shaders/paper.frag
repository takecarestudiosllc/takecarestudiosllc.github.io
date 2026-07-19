// Home page backdrop: flat paper-white field. The visual interest at the
// edges comes from the InkGlobe planets in front of it, not the shader.
varying vec2 vUv;

uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;    // page white
uniform vec3 uColorB;    // faint corner wash so the field isn't sterile
uniform vec3 uColorC;    // unused (kept for the shared Backdrop uniform set)

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  float wash = smoothstep(0.55, 1.25, length(uv));
  gl_FragColor = vec4(mix(uColorA, uColorB, wash * 0.6), 1.0);
}
