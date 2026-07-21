// Jade gem facets. Only the view-space normal is needed downstream — the
// fragment stage fakes the lighting rather than running a real one.
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
