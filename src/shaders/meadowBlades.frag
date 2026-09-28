uniform sampler2D uImage;
uniform float uReady;
varying vec2 vBladeUV;
varying vec2 vColorUV;
varying float vSeed;

void main() {
  if (uReady < .5) discard;
  // Each blade takes its green from the grass at its own location in the capture.
  // Exclude flowers and pale highlights, rather than introducing white grass.
  vec3 color = texture2D(uImage, vColorUV).rgb;
  float green = smoothstep(.04, .14, color.g - max(color.r, color.b));
  if (green < .01) discard;
  float fold = mix(.93, 1.04, step(.5, vBladeUV.x));
  color *= fold * mix(.94, 1.04, vSeed);
  color *= mix(.88, 1.03, vBladeUV.y);
  // Feather only the root into the photograph; tips retain the game's sharp silhouette.
  float alpha = smoothstep(.02, .24, vBladeUV.y) * green * .88;
  gl_FragColor = vec4(color, alpha);
}
