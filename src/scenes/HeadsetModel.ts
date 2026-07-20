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
/** Rounded-rectangle path, centered on the origin (shared by the facial
 *  rim's outer edge and its inner cutout). */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

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

  // Facial-interface rim: a rounded frame around the lens area, protruding
  // toward the wearer — the light-seal cover typical of VR headsets. The
  // lenses sit recessed inside its cavity.
  const rimShape = roundedRect(2.1, 1.0, 0.3);
  rimShape.holes.push(roundedRect(1.85, 0.72, 0.24));
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rimShape, {
      depth: 0.3,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    }),
    cushionMat,
  );
  rim.position.z = -0.85; // extrudes +z, so the frame spans the cushion → wearer gap
  outlined.push(rim);

  // Lenses: two discs set into the cushion, facing the wearer (-z).
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), lensMat);
    eye.position.set(0.52 * sx, 0.03, -0.64);
    eye.rotation.y = Math.PI;
    group.add(eye);
  }

  // Straps: flat bands (a thin rectangle extruded along a curve) — one over
  // the crown, one along each side, all meeting a connector pad at the
  // back. The cross-section is wide along the curve's in-plane normal and
  // thin along its binormal, which for these planar paths lays each strap's
  // broad face against the head (flat side inward).
  const bandProfile = new THREE.Shape();
  bandProfile.moveTo(-0.11, -0.028);
  bandProfile.lineTo(0.11, -0.028);
  bandProfile.lineTo(0.11, 0.028);
  bandProfile.lineTo(-0.11, 0.028);
  bandProfile.closePath();
  const bandPaths = [
    // Over the top: planar in YZ (binormal = ±x → band lies flat across the head).
    [
      new THREE.Vector3(0, 0.35, -0.25),
      new THREE.Vector3(0, 0.8, -0.6),
      new THREE.Vector3(0, 0.95, -1.0),
      new THREE.Vector3(0, 0.7, -1.45),
      new THREE.Vector3(0, 0.2, -1.72),
    ],
    // Sides: planar in XZ (flat face against the head's side), running at
    // the visor's vertical midline. Where they sweep behind the lens plane
    // the opaque lens discs hide them, so the lenses stay clear.
    ...[-1, 1].map((sx) => [
      new THREE.Vector3(1.02 * sx, 0, -0.35),
      new THREE.Vector3(0.95 * sx, 0, -0.95),
      new THREE.Vector3(0.6 * sx, 0, -1.5),
      new THREE.Vector3(0.16 * sx, 0, -1.7),
    ]),
  ];
  for (const points of bandPaths) {
    const band = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bandProfile, {
        steps: 28,
        bevelEnabled: false,
        extrudePath: new THREE.CatmullRomCurve3(points),
      }),
      bodyMat,
    );
    outlined.push(band);
  }
  // Back connector the three bands tuck into: a round disc facing the
  // wearer, sized to sit in the visual gap between the lenses.
  const backPad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 28), bodyMat);
  backPad.position.set(0, 0.02, -1.75);
  backPad.rotation.x = Math.PI / 2; // disc face toward ±z
  outlined.push(backPad);

  for (const mesh of outlined) {
    group.add(mesh);
    // ~0.04 world units of ink once the caller's normalization (~×1.9) runs.
    addOutline(mesh, 0.022);
  }
  return group;
}
