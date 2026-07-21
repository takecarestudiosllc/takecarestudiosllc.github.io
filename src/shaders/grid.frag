// Square grid matrix behind the corpus figures: even jade rules with brighter
// pips at the intersections and a slow pulse washing outward from the centre.
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;   // rules
uniform vec3 uColorB;   // intersection pips
uniform vec3 uColorC;   // pulse tint
uniform float uOpacity;

const float CELLS = 16.0;

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  uv += uPointer * 0.015;

  // Distance to the nearest rule in each axis. Lines land on the half-cell, so
  // an intersection is where both components reach zero at once.
  vec2 f = abs(fract(uv * CELLS) - 0.5);
  float rule = 1.0 - smoothstep(0.0, 0.05, min(f.x, f.y));
  float pip = 1.0 - smoothstep(0.0, 0.16, length(f));

  // Radius normalised against the frame's own corner, so the vignette falls off
  // identically at any aspect. Measured raw, a portrait screen never gets far
  // enough from the centre to dim at all, and the grid blazes edge to edge.
  float r = length(uv) / (0.5 * length(vec2(uAspect, 1.0)));

  float pulse = 0.55 + 0.45 * sin(uTime * 0.55 - r * 2.2);
  vec3 col = mix(uColorA, uColorC, pulse * 0.5) * rule + uColorB * pip;

  // hold it to the middle of the frame so it never crowds the page edges
  float vig = smoothstep(1.0, 0.12, r);
  float a = (rule * 0.4 + pip * 0.6) * vig * (0.55 + 0.45 * pulse) * uOpacity;
  gl_FragColor = vec4(col, a);
}
