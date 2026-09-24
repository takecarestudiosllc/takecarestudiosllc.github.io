// Restrained atmosphere: layered parallax and chapter lighting, not bright clouds behind copy.
varying vec2 vUv;
uniform float uTime;
uniform float uScroll;
uniform float uAspect;
uniform float uClouds;
uniform float uChapter;
uniform float uDetail;
uniform vec2 uMouse;
uniform vec2 uMouseVel;
uniform vec2 uPointer;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
void main() {
  vec2 uv = (vUv - .5) * vec2(uAspect, 1.0);
  float apps = smoothstep(1.0, 2.0, uChapter) * (1.0 - smoothstep(2.0, 3.0, uChapter));
  vec3 violet = vec3(.18, .13, .32);
  vec3 jade = vec3(.06, .24, .21);
  vec3 tint = mix(violet, jade, apps);
  vec2 center = vec2(.36 * uAspect, -.03 + .07 * sin(uChapter * 1.5));
  float glow = exp(-length((uv - center) * vec2(.85, 1.2)) * 3.0);
  vec3 col = vec3(.025, .034, .055) + tint * glow * .48;
  vec2 p = uv * 1.7 - vec2(0., uScroll * .17) + vec2(uTime * .009, 0.);
  float cloud;
  if (uDetail > .5) {
    vec2 d = uv - uMouse;
    p -= uMouseVel * exp(-dot(d,d) * 6.) * .08;
    float warp = fbm(p + vec2(0., uTime * .007));
    cloud = fbm(p + warp * 1.25);
  } else {
    // Low-tier devices skip every FBM octave, preserving the lighting and models.
    cloud = .5 + .2 * sin(p.x * 1.3 + sin(p.y * 2.1)) * cos(p.y * 1.5);
  }
  float veil = smoothstep(.38, .8, cloud);
  float right = smoothstep(-.5, .7, uv.x);
  col += tint * veil * (.16 + right * .22) * uClouds;
  // A broad arc carries moonlight across the chapter changes.
  float arc = exp(-abs(length((uv - vec2(.4,-.5)) * vec2(.7,1.)) - .7) * 22.);
  col += tint * arc * .07;
  col *= 1. - .35 * smoothstep(.35, 1.1, length(vUv - .5));
  gl_FragColor = vec4(col, 1.);
}
