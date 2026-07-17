// Fullscreen backdrop: bypasses the camera entirely by emitting clip-space
// coordinates directly (z = 1.0 pins it to the far plane).
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
