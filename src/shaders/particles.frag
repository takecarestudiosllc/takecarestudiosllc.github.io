uniform vec3 uColor;
uniform float uOpacity;

varying float vFade;

void main() {
  // soft round sprite from the point coordinate
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.06, d) * uOpacity * vFade;
  gl_FragColor = vec4(uColor, alpha);
}
