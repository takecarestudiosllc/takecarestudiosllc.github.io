// Touch Grass VR backdrop: sunny meadow gradient with drifting light patches
// and a soft sun glow. Sits behind the instanced grass field.
varying vec2 vUv;

uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;    // lush green, low
uniform vec3 uColorB;    // light lime sky, high
uniform vec3 uColorC;    // sunlight patches

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  uv += uPointer * 0.02;

  float t = uTime * 0.03;
  float g = smoothstep(-0.55, 0.65, (vUv.y - 0.5) + uScroll * 0.25);
  vec3 col = mix(uColorA, uColorB, g);

  // drifting dappled light
  float f = fbm(uv * 2.2 + vec2(t * 2.0, uScroll * 1.2));
  col += uColorC * f * 0.22;

  // sun glow, upper right
  float sun = smoothstep(0.9, 0.1, length(uv - vec2(0.45, 0.42)));
  col += vec3(1.0, 0.98, 0.85) * sun * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
