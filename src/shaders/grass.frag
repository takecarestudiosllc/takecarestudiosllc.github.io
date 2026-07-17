uniform vec3 uBase;      // color at the root
uniform vec3 uTip;       // color at the tip
uniform vec3 uFog;       // distance fade target (matches the meadow horizon)
uniform float uFogNear;
uniform float uFogFar;

varying float vHeight;
varying float vSeed;
varying float vDepth;

void main() {
  vec3 col = mix(uBase, uTip, vHeight);
  col *= 0.85 + 0.30 * vSeed;                              // per-blade variation
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth)); // horizon fade
  gl_FragColor = vec4(col, 1.0);
}
