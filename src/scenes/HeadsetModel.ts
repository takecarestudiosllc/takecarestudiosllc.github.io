import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { addOutline } from './toon';

/**
 * Procedurally built VR headset — primitives only, so the site carries no
 * third-party model license. Style matches the other beats: gunmetal body,
 * black ink outlines, and lenses that glow with the Touch Grass art.
 *
 * Local orientation: the sealed visor front faces +z; the wearer side (face
 * cushion + lenses) faces -z; straps arc back over -z. Roughly 2.3 × 1.5 ×
 * 2.4 local units, centered near the origin — callers normalize the bbox to
 * their target world size, so exact dimensions here don't matter.
 */
export function buildHeadset(lensMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  // Less metallic than the phone so the moonbeam's spotlight can grade the
  // top surfaces (pure metal has almost no diffuse response).
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33,
    metalness: 0.6,
    roughness: 0.42,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    metalness: 0.3,
    roughness: 0.7,
  });
  lensMap.colorSpace = THREE.SRGBColorSpace;
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: lensMap,
    emissiveIntensity: 1.1,
    metalness: 0.1,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });

  const outlined: THREE.Mesh[] = [];

  // Visor shell.
  const visor = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.05, 1.05, 4, 0.24), bodyMat);
  outlined.push(visor);

  // Face cushion: darker inset block on the wearer side.
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.9, 0.35, 4, 0.17), cushionMat);
  cushion.position.z = -0.45;
  outlined.push(cushion);

  // Lenses: two discs set into the cushion, facing the wearer (-z).
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), lensMat);
    eye.position.set(0.52 * sx, 0.03, -0.64);
    eye.rotation.y = Math.PI;
    group.add(eye);
  }

  // Straps: a top arc over the crown plus two side straps that sweep back
  // from the visor's edges and converge behind — kept off the lens line so
  // nothing crosses the wearer side.
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 12, 24, Math.PI), bodyMat);
  arc.position.set(0, 0.12, -1.0);
  arc.rotation.y = Math.PI / 2; // plane YZ: from inside the visor, over the top, down the back
  outlined.push(arc);
  for (const sx of [-1, 1]) {
    // Hug the sides (never crossing the lens face): from the visor's edge
    // back toward the arc's rear, converging only slightly.
    const from = new THREE.Vector3(1.02 * sx, -0.05, -0.35);
    const strapEnd = new THREE.Vector3(0.6 * sx, 0.08, -1.7);
    const dir = strapEnd.clone().sub(from);
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, dir.length(), 8),
      bodyMat,
    );
    side.position.copy(from).add(strapEnd).multiplyScalar(0.5);
    side.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    outlined.push(side);
  }

  for (const mesh of outlined) {
    group.add(mesh);
    // ~0.04 world units of ink once the caller's normalization (~×1.9) runs.
    addOutline(mesh, 0.022);
  }
  return group;
}
