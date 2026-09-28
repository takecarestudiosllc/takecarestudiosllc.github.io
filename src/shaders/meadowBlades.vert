// Actual mesh vertices bend; the backdrop texture coordinates never move.
attribute vec2 aRoot;
attribute vec2 aSize;
attribute float aSeed;
uniform float uTime;
uniform float uAspect;
uniform float uImageAspect;
uniform vec2 uTouch;
uniform float uTouchStrength;

varying vec2 vBladeUV;
varying vec2 vColorUV;
varying float vSeed;

void main() {
  float height = position.y;
  float bendWeight = height * height;
  vec2 crop = vec2(min(1.0, uAspect / uImageAspect), min(1.0, uImageAspect / uAspect));
  vec2 rootScreen = (aRoot - .5) / crop + .5;
  vec2 bladeScreen = rootScreen + vec2(0.0, aSize.y * .65 / crop.y);
  vec2 delta = (bladeScreen - uTouch) * vec2(uAspect, 1.0);
  float touch = (1.0 - smoothstep(.025, .20, length(delta))) * uTouchStrength;
  float wave = sin(uTime * 1.35 + aRoot.x * 23.0 + aRoot.y * 11.0);
  wave += .3 * sin(uTime * 2.1 + aSeed * 6.2831);
  float lean = (aSeed - .5) * aSize.y * .32;
  float bend = lean + wave * aSize.y * .095;
  bend += sign(delta.x + .001) * touch * aSize.y * .24;
  vec2 point = aRoot + vec2(position.x * aSize.x + bend * bendWeight, height * aSize.y);
  point.y -= touch * aSize.y * .08 * bendWeight;
  vec2 screen = (point - .5) / crop + .5;
  gl_Position = vec4(screen * 2.0 - 1.0, 0.0, 1.0);
  vBladeUV = uv;
  vColorUV = clamp(aRoot + vec2(0.0, aSize.y * .35), .002, .998);
  vSeed = aSeed;
}
