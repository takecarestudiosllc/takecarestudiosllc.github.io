// Six Seven VR backdrop: molten lava-lamp blobs matching the game's key art
// (deep red base, orange blobs, yellow cores).
varying vec2 vUv;

uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;    // deep red base
uniform vec3 uColorB;    // orange blobs
uniform vec3 uColorC;    // yellow cores

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  uv += uPointer * 0.025;
  uv *= 1.15 - uScroll * 0.22; // gentle zoom-in as the page scrolls

  float t = uTime * 0.05;
  vec2 q = vec2(
    fbm(uv * 2.0 + vec2(t, -t * 0.6)),
    fbm(uv * 2.0 + vec2(-t * 0.4, t))
  );
  float f = fbm(uv * 2.4 + q * 2.2 + vec2(0.0, uScroll * 2.0 - t));

  vec3 col = mix(uColorA, uColorB, smoothstep(0.30, 0.62, f));
  col = mix(col, uColorC, smoothstep(0.62, 0.80, f));
  col += uColorC * pow(max(f - 0.55, 0.0), 3.0) * 2.0;

  float vig = smoothstep(1.35, 0.30, length(uv));
  col *= 0.40 + 0.60 * vig;

  gl_FragColor = vec4(col, 1.0);
}
