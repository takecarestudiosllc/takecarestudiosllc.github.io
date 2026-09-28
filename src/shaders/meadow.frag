// The original in-game capture is static. A separate mesh layer animates the grass.
varying vec2 vUv;
uniform sampler2D uImage;
uniform float uImageAspect;
uniform float uAspect;
uniform float uReady;

void main() {
  if (uReady < .5) {
    gl_FragColor = vec4(.16, .28, .13, 1.0);
    return;
  }
  // Same centered cover crop as the CSS fallback; never stretch the trees.
  vec2 crop = vec2(min(1.0, uAspect / uImageAspect), min(1.0, uImageAspect / uAspect));
  vec2 uv = (vUv - .5) * crop + .5;
  gl_FragColor = vec4(texture2D(uImage, uv).rgb, 1.0);
}
