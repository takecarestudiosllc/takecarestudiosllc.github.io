import * as THREE from 'three';

/**
 * Comic-book toon helpers shared by the hand and the lotus: white cel-shaded
 * fills (MeshToonMaterial + a hard 3-step gradient) with black inverted-hull
 * outlines.
 */

let gradient: THREE.DataTexture | null = null;

/** Hard 3-step luminance ramp — the cel bands of the toon shading. */
export function toonGradient(): THREE.Texture {
  if (!gradient) {
    // Bright but distinct bands — the shadow step stays light so the hand
    // and lotus read white on the dark field, while the three steps keep
    // visibly different values so the cel shading still draws the form.
    gradient = new THREE.DataTexture(new Uint8Array([170, 220, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** Flat ink outline: back-face hull pushed out along the vertex normals.
 *  `thickness` is in the mesh's object space — divide the desired world
 *  thickness by the mesh's world scale. */
export function outlineMaterial(thickness: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uThickness: { value: thickness } },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec3 pos = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      void main() { gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0); }
    `,
  });
}

/** Add a black outline hull for `mesh` next to it (same parent, same local
 *  transform) and return it. */
export function addOutline(mesh: THREE.Mesh, thickness: number): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  outline.position.copy(mesh.position);
  outline.quaternion.copy(mesh.quaternion);
  outline.scale.copy(mesh.scale);
  mesh.parent?.add(outline);
  return outline;
}
