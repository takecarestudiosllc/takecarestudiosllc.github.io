// Instanced grass blade: per-instance placement plus quadratic wind bend
// (tips sway, roots stay planted).
attribute vec3 aOffset;   // world position of the blade root
attribute float aScale;   // blade height multiplier
attribute float aAngle;   // rotation around Y
attribute float aSeed;    // per-blade random in [0, 1]

uniform float uTime;
uniform float uWind;      // sway amplitude

varying float vHeight;    // 0 at root, 1 at tip
varying float vSeed;
varying float vDepth;

void main() {
  vHeight = position.y;
  vSeed = aSeed;

  vec3 p = position;
  float c = cos(aAngle);
  float s = sin(aAngle);
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  p *= aScale;

  // wind: bend grows with the square of height so the base stays anchored
  float bend = vHeight * vHeight * uWind;
  float w = sin(uTime * 1.6 + aOffset.x * 0.9 + aOffset.z * 0.7 + aSeed * 6.2831);
  p.x += w * bend;
  p.z += w * bend * 0.5;

  vec4 mv = modelViewMatrix * vec4(p + aOffset, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
