// Jade gem: flat-shaded facets lit by a fixed direction, with a rim term so the
// silhouette keeps glowing against black. The scene has no lights — a real rig
// would only affect these few meshes, and this keeps the palette exact.
varying vec3 vNormal;

uniform vec3 uDeep;    // shadowed facets
uniform vec3 uBody;    // the gem's own jade
uniform vec3 uCrown;   // pale highlight, matching the app's crown facet
uniform float uOpacity;

const vec3 LIGHT = vec3(0.42, 0.78, 0.47);

void main() {
  vec3 n = normalize(vNormal);
  // half-lambert: facets never go fully black, which is what reads as "gem"
  float lit = dot(n, normalize(LIGHT)) * 0.5 + 0.5;
  vec3 col = mix(uDeep, uBody, smoothstep(0.15, 0.75, lit));
  col = mix(col, uCrown, smoothstep(0.78, 1.0, lit));
  // edge-on facets flare — the glow that survives on a black page
  float rim = pow(1.0 - abs(n.z), 2.6);
  col += uCrown * rim * 0.45;
  gl_FragColor = vec4(col, uOpacity);
}
