import * as THREE from 'three';
import { shaders } from '../shaders';

/**
 * The app's jade reward gems, drifting up across the quiz section.
 *
 * The app draws them flat, as an SVG kite with a paler crown facet, a white
 * highlight and a sparkle that fires once every three seconds. Here they are
 * real geometry — an eight-sided bipyramid cut to the same silhouette (short
 * crown, long pavilion) so a tumbling gem still reads as that icon from any
 * angle — with the highlight and sparkle carried over as billboards.
 */

/** Palette pinned in the app as JADE_GEM: gems stay jade in every theme. */
const DEEP = 0x1a9060;
const BODY = 0x3dc48e;
const CROWN = 0x88ecc4;

/** Girdle radius and the two apex heights, in the app's 4.5 : 4 : 7 proportion. */
const R = 0.45;
const CROWN_H = 0.4;
const PAVILION_H = 0.7;
const SIDES = 8;

/** Flow axis — up and to the right, ~35° above horizontal. */
const DIR = new THREE.Vector2(0.819, 0.574);
/** Spawn/exit box in world units, generous enough to cover a wide viewport. */
const BOUND_X = 8;
const BOUND_Y = 5.5;
/** The app's twinkle: a 3s cycle that is only visible for its last fifth. */
const SPARKLE_CYCLE = 3;

interface Gem {
  group: THREE.Group;
  mesh: THREE.Mesh;
  sparkle: THREE.Sprite;
  speed: number;
  /** Radians per second, per axis, for the idle tumble. */
  tumble: THREE.Vector3;
  /** Offset into the sparkle cycle so they never fire in unison. */
  phase: number;
}

/**
 * Eight-sided bipyramid. Built unindexed so `computeVertexNormals` gives every
 * facet its own normal — shared normals would smooth it into a blob.
 */
function gemGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < SIDES; i++) {
    const a0 = (i / SIDES) * Math.PI * 2;
    const a1 = ((i + 1) / SIDES) * Math.PI * 2;
    const x0 = Math.cos(a0) * R;
    const z0 = Math.sin(a0) * R;
    const x1 = Math.cos(a1) * R;
    const z1 = Math.sin(a1) * R;
    pos.push(x0, 0, z0, x1, 0, z1, 0, CROWN_H, 0);
    // wound the other way so the pavilion faces outward too
    pos.push(x1, 0, z1, x0, 0, z0, 0, -PAVILION_H, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Soft jade halo, the same radial falloff the node discs sit on. */
function glowTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(136,236,196,0.55)');
  grad.addColorStop(0.45, 'rgba(61,196,142,0.18)');
  grad.addColorStop(1, 'rgba(61,196,142,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}

/** The app's four-point sparkle star, traced at 16x its SVG scale. */
function sparkleTexture(): THREE.CanvasTexture {
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(S / 2, S / 2);
  ctx.scale(16, 16);
  ctx.beginPath();
  ctx.moveTo(0, -1.8);
  ctx.lineTo(0.32, -0.32);
  ctx.lineTo(1.8, 0);
  ctx.lineTo(0.32, 0.32);
  ctx.lineTo(0, 1.8);
  ctx.lineTo(-0.32, 0.32);
  ctx.lineTo(-1.8, 0);
  ctx.lineTo(-0.32, -0.32);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

export class GemStream {
  readonly group = new THREE.Group();
  private gems: Gem[] = [];
  private geometry = gemGeometry();
  private material: THREE.ShaderMaterial;
  private glowMat: THREE.SpriteMaterial;
  private sparkleMat: THREE.SpriteMaterial;
  private glowTex = glowTexture();
  private sparkleTex = sparkleTexture();
  private opacity = 0;

  /**
   * @param ceiling Upper bound on the fade. A narrow screen has nowhere for the
   *   gems to drift that is not directly behind the copy, so they are held back
   *   there rather than glowing through the text.
   */
  constructor(count: number, private ceiling = 1) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: shaders.gemVert,
      fragmentShader: shaders.gemFrag,
      uniforms: {
        uDeep: { value: new THREE.Color(DEEP) },
        uBody: { value: new THREE.Color(BODY) },
        uCrown: { value: new THREE.Color(CROWN) },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glowMat = new THREE.SpriteMaterial({
      map: this.glowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sparkleMat = new THREE.SpriteMaterial({
      map: this.sparkleTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(this.geometry, this.material);
      const scale = 0.13 + Math.random() * 0.13;
      mesh.scale.setScalar(scale);
      group.add(mesh);

      const glow = new THREE.Sprite(this.glowMat);
      glow.scale.setScalar(scale * 5);
      group.add(glow);

      // sits off the crown, where the app puts its highlight; kept out of the
      // mesh so the tumble doesn't carry it around the gem
      const sparkle = new THREE.Sprite(this.sparkleMat.clone());
      sparkle.position.set(scale * 0.5, scale * 0.5, scale * 0.6);
      sparkle.scale.setScalar(0.001);
      group.add(sparkle);

      const gem: Gem = {
        group,
        mesh,
        sparkle,
        speed: 0.38 + Math.random() * 0.5,
        tumble: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          0.35 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.35,
        ),
        phase: Math.random() * SPARKLE_CYCLE,
      };
      // stagger the first pass across the whole box instead of all at one edge
      group.position.set(
        (Math.random() * 2 - 1) * BOUND_X,
        (Math.random() * 2 - 1) * BOUND_Y,
        -1.5 + Math.random() * 4,
      );
      group.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      this.gems.push(gem);
      this.group.add(group);
    }
    this.group.visible = false;
  }

  /** Re-enter from the left or bottom edge, weighted by their lengths. */
  private respawn(gem: Gem): void {
    const left = BOUND_Y * 2;
    const bottom = BOUND_X * 2;
    if (Math.random() < left / (left + bottom)) {
      gem.group.position.x = -BOUND_X;
      gem.group.position.y = (Math.random() * 2 - 1) * BOUND_Y;
    } else {
      gem.group.position.x = (Math.random() * 2 - 1) * BOUND_X;
      gem.group.position.y = -BOUND_Y;
    }
    gem.group.position.z = -1.5 + Math.random() * 4;
  }

  update(dt: number, elapsed: number, speed: number): void {
    if (!this.group.visible) return;
    for (const gem of this.gems) {
      const step = gem.speed * speed * dt;
      gem.group.position.x += DIR.x * step;
      gem.group.position.y += DIR.y * step;
      if (gem.group.position.x > BOUND_X || gem.group.position.y > BOUND_Y) this.respawn(gem);

      gem.mesh.rotation.x += gem.tumble.x * speed * dt;
      gem.mesh.rotation.y += gem.tumble.y * speed * dt;
      gem.mesh.rotation.z += gem.tumble.z * speed * dt;

      // The app's keyframes: scale 0 → 0 → 2 → 0 at 0/0.8/0.9/1 of the cycle,
      // rotating 45° → 225° across the visible tail.
      const u = ((elapsed + gem.phase) % SPARKLE_CYCLE) / SPARKLE_CYCLE;
      let s = 0;
      if (u >= 0.9) s = 2 - ((u - 0.9) / 0.1) * 2;
      else if (u >= 0.8) s = ((u - 0.8) / 0.1) * 2;
      const size = s * 0.12 * this.opacity;
      gem.sparkle.scale.setScalar(Math.max(size, 0.0001));
      gem.sparkle.material.rotation =
        (u < 0.8 ? 45 : 45 + ((u - 0.8) / 0.2) * 180) * THREE.MathUtils.DEG2RAD;
      gem.sparkle.material.opacity = s > 0 ? this.opacity : 0;
    }
  }

  setOpacity(raw: number): void {
    const value = raw * this.ceiling;
    if (Math.abs(value - this.opacity) < 0.002) return;
    this.opacity = value;
    this.group.visible = value > 0.004;
    this.material.uniforms.uOpacity.value = value;
    this.glowMat.opacity = value * 0.9;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.glowMat.dispose();
    this.sparkleMat.dispose();
    this.glowTex.dispose();
    this.sparkleTex.dispose();
    this.gems.forEach((g) => (g.sparkle.material as THREE.SpriteMaterial).dispose());
  }
}
