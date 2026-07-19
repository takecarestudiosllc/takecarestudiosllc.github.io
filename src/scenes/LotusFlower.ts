import * as THREE from 'three';
import { toonGradient, addOutline } from './toon';

/**
 * Procedural lotus flower that blooms under scroll control.
 *
 * The flower is three rings of curved petals around a golden heart, plus a
 * warm point light and an additive glow sprite (the "light in the palm").
 * Nothing here tweens itself — the scene's scroll timeline drives two plain
 * numbers and `update()` poses the petals every frame:
 *
 *   bloom  0 → 1   bud closed → fully open (outer ring leads, inner follows)
 *   glow   0 → 1   palm light off → full radiance
 */

interface RingSpec {
  count: number;
  radius: number;
  length: number;
  width: number;
  closedTilt: number; // rotation.x when bloom = 0 (negative leans inward — bud)
  openTilt: number;   // rotation.x when bloom = 1 (petal folds outward)
  delay: number;      // fraction of bloom before this ring starts opening
  color: number;
}

const RINGS: RingSpec[] = [
  { count: 8, radius: 0.16, length: 0.95, width: 0.62, closedTilt: -0.16, openTilt: 1.02, delay: 0.0,  color: 0xe87fb7 },
  { count: 8, radius: 0.11, length: 0.82, width: 0.54, closedTilt: -0.1,  openTilt: 0.74, delay: 0.18, color: 0xf49fcb },
  { count: 5, radius: 0.07, length: 0.66, width: 0.46, closedTilt: -0.05, openTilt: 0.45, delay: 0.36, color: 0xffc7e0 },
];

/** Petal: a plane sculpted into a cupped teardrop, base at the origin, tip at +Y. */
function makePetalGeometry(length: number, width: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 6, 14).translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i); // -0.5 … 0.5 across the petal
    const t = pos.getY(i);  //  0 base … 1 tip
    const profile = Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.75); // narrow base, round swell, soft tip
    const x = x0 * width * profile;
    pos.setXYZ(
      i,
      x,
      t * length,
      0.34 * t * t * length            // lengthwise curl outward
        - 1.4 * x * x * (0.3 + 0.7 * t), // crosswise cup toward the center
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(224, 240, 255, 1)');
  grad.addColorStop(0.25, 'rgba(150, 198, 255, 0.55)');
  grad.addColorStop(0.6, 'rgba(140, 150, 255, 0.16)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const easeInOut = (t: number): number => t * t * (3 - 2 * t); // smoothstep

/** Diffuse tint for the palm light's blue wash: white at rest → light blue
 *  when glowing. Tinting the diffuse (not the emissive) survives the white
 *  ceiling the scene lights push these materials against. (Shared with the
 *  hand via HomeScene.) */
export const GLOW_TINT_BASE = new THREE.Color(0xffffff);
export const GLOW_TINT_BLUE = new THREE.Color(0x8fb3e8);

export class LotusFlower {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;

  /** Scroll-driven controls — tween these from the scene timeline. */
  bloom = 0;
  glow = 0;

  private head = new THREE.Group(); // petals + heart; scales up out of the light
  private pivots: { pivot: THREE.Object3D; ring: RingSpec; phase: number }[] = [];
  private sprite: THREE.Sprite;
  private heart: THREE.Mesh;
  /** Petal materials, tinted blue by the glow in update(). */
  private petalMats: THREE.MeshToonMaterial[] = [];

  constructor() {
    // Comic-book petals: white cel-shaded fill (ring.color is unused while
    // this style is in) with a black ink outline hull per petal.
    for (const ring of RINGS) {
      const geo = makePetalGeometry(ring.length, ring.width);
      const mat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        gradientMap: toonGradient(),
        side: THREE.DoubleSide,
        // Neutral emissive lift so the petals read bright white instead of
        // taking the scene's violet rim light as a lavender tint — kept low
        // enough that the cel bands still shade the form.
        emissive: 0x48484c,
      });
      this.petalMats.push(mat);
      for (let i = 0; i < ring.count; i++) {
        // wrapper spins around the stem axis; pivot tilts the petal open.
        const wrapper = new THREE.Group();
        wrapper.rotation.y = (i / ring.count) * Math.PI * 2 + ring.delay * 2; // offset rings so petals interleave
        const pivot = new THREE.Group();
        pivot.position.z = ring.radius;
        const petal = new THREE.Mesh(geo, mat);
        pivot.add(petal);
        addOutline(petal, 0.02);
        wrapper.add(pivot);
        this.head.add(wrapper);
        this.pivots.push({ pivot, ring, phase: i * 1.7 });
      }
    }

    this.heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xcfe4ff,
        emissive: 0x7fb3ff,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
    );
    this.heart.position.y = 0.08;
    this.head.add(this.heart);
    this.group.add(this.head);

    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      }),
    );
    // The glow hovers above the flower's center rather than sitting in the
    // palm, so it reads as the bloom's radiance, not a light on the hand.
    this.sprite.position.y = 0.55;
    this.group.add(this.sprite);

    this.light = new THREE.PointLight(0x86b8ff, 0, 12, 1.8);
    this.light.position.y = 0.85;
    this.group.add(this.light);
  }

  update(elapsed: number): void {
    const bloom = THREE.MathUtils.clamp(this.bloom, 0, 1);
    const glow = THREE.MathUtils.clamp(this.glow, 0, 1);

    for (const { pivot, ring, phase } of this.pivots) {
      const local = easeInOut(THREE.MathUtils.clamp((bloom - ring.delay) / (1 - ring.delay), 0, 1));
      const sway = Math.sin(elapsed * 0.8 + phase) * 0.02 * local; // breathing once open
      pivot.rotation.x = THREE.MathUtils.lerp(ring.closedTilt, ring.openTilt, local) + sway;
    }

    // The flower emerges out of the palm light rather than popping in.
    const emerge = easeInOut(THREE.MathUtils.clamp(bloom * 1.6, 0, 1));
    const headScale = 0.05 + 0.95 * emerge;
    this.head.scale.setScalar(headScale);
    this.head.rotation.y = elapsed * 0.1; // slow ceremonial turn

    const flicker = 1 + Math.sin(elapsed * 2.3) * 0.05 + Math.sin(elapsed * 5.1) * 0.03;
    this.light.intensity = glow * 6 * flicker;
    // The toon materials sit at their white ceiling under the scene lights,
    // so the point light alone can't tint them — wash the diffuse color
    // blue instead, breathing with the same flicker.
    const wash = glow * (0.75 + 0.25 * flicker);
    for (const mat of this.petalMats) {
      mat.color.copy(GLOW_TINT_BASE).lerp(GLOW_TINT_BLUE, wash);
    }
    const spriteMat = this.sprite.material as THREE.SpriteMaterial;
    spriteMat.opacity = glow * 0.2 * (0.9 - 0.35 * bloom); // glow softens as petals take over
    const s = (0.6 + glow * 2.6 + bloom * 1.2) * flicker;
    this.sprite.scale.setScalar(s);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          (m as THREE.Material & { map?: THREE.Texture }).map?.dispose();
          m.dispose();
        });
      }
    });
  }
}
