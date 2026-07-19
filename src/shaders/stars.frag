// Four-pointed sparkle: an astroid (|x|^⅔ + |y|^⅔) makes a concave diamond
// with thin points along the axes, rotated per-star by its seed. As vBlur
// rises the sparkle melts into a wide dim disc — defocused bokeh has no
// spikes — before fading out entirely. Color comes from the shared chroma()
// palette (prepended by src/shaders/index.ts) so the stars cycle with the
// nebula behind them.
uniform float uOpacity;

varying float vAlpha;
varying float vBlur;
varying float vRot;
varying float vHue;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  p = mat2(cos(vRot), -sin(vRot), sin(vRot), cos(vRot)) * p;
  float m = pow(abs(p.x), 0.6667) + pow(abs(p.y), 0.6667);
  float edge = pow(0.5, 0.6667);
  float crisp = smoothstep(edge, edge * 0.45, m);
  float soft = smoothstep(0.5, 0.05, length(p)) * 0.55;
  float a = mix(crisp, soft, vBlur) * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(chroma(vHue), a);
}
