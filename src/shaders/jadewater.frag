// Anime-style jade water rising along the bottom edge.
//
// Cel-shaded rather than simulated: the surface is a few layered sine waves,
// the body is three flat tones with a hard ink line along the crest, and the
// highlights are bold dashes instead of soft gradients. No fbm anywhere — noise
// is what made the earlier passes read as fire or fluid rather than as drawn
// water.
//
// Almost everything here is a standing wave, so the water breathes on the spot;
// the bubbles are the only part that actually travels, drifting slowly upward.
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA;   // deep body
uniform vec3 uColorB;   // mid jade
uniform vec3 uColorC;   // pale crest
uniform float uOpacity;

/** A cel edge: hard enough to read as ink, soft enough not to alias. */
float cel(float edge, float v) {
  return smoothstep(edge - 0.0022, edge + 0.0022, v);
}

void main() {
  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y);
  float t = uTime * 0.16;
  // Bubbles want the aspect-corrected x so they stay round; the surface waves
  // want this one, which spans ±0.5 at any aspect, so the same number of crests
  // crosses the screen whether it is landscape or portrait. Keyed to the
  // aspect-corrected x instead, a phone got well under one cycle — a flat line.
  float u = vUv.x - 0.5;

  // Crest height: layered standing waves that roll in place.
  // On a portrait screen the footer covers the bottom band, so the water sits
  // higher there or almost none of it is left visible.
  float level = mix(0.15, 0.22, smoothstep(1.1, 0.6, uAspect));
  float surf = level
    + sin(u * 15.0 + t * 1.7) * 0.034
    + sin(u * 26.0 - t * 1.1) * 0.018
    + sin(u * 40.0 + t * 2.3) * 0.007;

  // Rounded tongues lifting out of it, swelling and settling without moving on.
  // Few and wide: a higher count reads as spikes once the screen is narrow.
  float lobes = pow(sin(u * 19.0 + 1.3) * 0.5 + 0.5, 3.0);
  surf += lobes * (0.042 + 0.03 * sin(t * 1.9 + u * 3.4));

  float d = surf - vUv.y;              // > 0 inside the water
  float body = cel(0.0, d);

  // Three flat tones — pale at the crest, deepening down.
  vec3 col = uColorC;
  col = mix(col, uColorB, cel(0.032, d));
  col = mix(col, uColorA, cel(0.11, d));

  // Bold dashed highlight running parallel to the crest. The dash envelope
  // drives the strip's *thickness*, not just whether it is drawn — so each one
  // comes to a point at both ends like a brush stroke. Gating it on/off instead
  // left flat-ended ribbons.
  float lane = abs(d - 0.052 - 0.014 * sin(u * 9.5 + t * 2.0));
  float env = smoothstep(0.32, 0.95, sin(u * 7.4 - t * 1.4) * 0.5 + 0.5);
  float sheen = body * (1.0 - cel(0.012 * env, lane));
  col = mix(col, uColorC, sheen);

  // Bubbles rising through the body — the only part that actually travels.
  // Each column gets its own rise rate and each cell its own size and jitter,
  // so they never read as a marching grid.
  float bcol = floor(p.x * 15.0);
  float rise = 1.8 + hash21(vec2(bcol, 3.7)) * 2.6;
  vec2 bc = vec2(p.x * 15.0, vUv.y * 15.0 - t * rise);
  vec2 bi = floor(bc);
  vec2 bf = fract(bc) - 0.5;
  bf.x += (hash21(bi + 5.1) - 0.5) * 0.5;
  float rad = mix(0.10, 0.24, hash21(bi + 11.3));
  float bub = step(0.55, hash21(bi)) * (1.0 - cel(rad, length(bf)));
  col = mix(col, uColorC, bub * body * 0.9);

  // Ink line along the crest, drawn last so nothing paints over it.
  float outline = body * (1.0 - cel(0.013, d));
  col = mix(col, vec3(0.94, 1.0, 0.98), outline * 0.85);

  gl_FragColor = vec4(col, body * 0.92 * uOpacity);
}
