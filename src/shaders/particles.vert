// Shared floating-particle system (dust, embers, pollen — behavior via uniforms).
attribute float aSeed;   // stable per-particle random in [0, 1]

uniform float uTime;
uniform float uScroll;     // page scroll progress 0..1
uniform float uSize;       // particle diameter in world units
uniform float uScale;      // projection factor: viewport px * dpr (set from JS)
uniform float uSway;       // horizontal drift amplitude
uniform float uRise;       // upward speed (embers rise, dust ~0)
uniform float uParallax;   // how much scroll shifts particles by depth

varying float vFade;

void main() {
  vec3 p = position;
  float phase = aSeed * 6.2831;

  // idle drift
  p.x += sin(uTime * (0.15 + aSeed * 0.20) + phase) * uSway;
  p.y += cos(uTime * (0.12 + aSeed * 0.25) + phase * 1.7) * uSway * 0.6;

  // rise and wrap inside a 16-unit tall volume
  p.y = mod(p.y + uTime * uRise * (0.4 + aSeed) + 8.0, 16.0) - 8.0;

  // depth-differentiated scroll parallax
  p.y += uScroll * uParallax * (0.4 + aSeed);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // world-size → screen px: size * (projection factor / view depth)
  gl_PointSize = uSize * (0.5 + aSeed) * (uScale * 0.65 / -mv.z);
  vFade = smoothstep(34.0, 6.0, -mv.z); // fade out with distance
}
