import * as THREE from 'three';

export interface InkGlobeOptions {
  /** [width, height] segment counts of the sphere geometry. */
  segments?: [number, number];
}

/** Aura sprite diameter relative to the globe's — the fade-out span. */
const AURA_SCALE = 1.45;

/**
 * Decorative monochrome globe: a sphere wrapped in an equirectangular planet
 * map (NASA Blue Marble, LROC moon, …) reduced to inverted grayscale via
 * toInk(), so it reads as a printed planet on the paper-white backdrop
 * rather than a photograph. Unlit (basic material) to stay strictly
 * black-and-white — the scene's violet rim light would otherwise tint it.
 * Add `group` to the scene and give it a slow rotation in the scene's
 * update() for idle life.
 */
export class InkGlobe {
  readonly group = new THREE.Group();

  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;
  private auraMaterial: THREE.SpriteMaterial;

  private static auraTexture: THREE.Texture | null = null;

  constructor(radius: number, map: THREE.Texture, opts: InkGlobeOptions = {}) {
    const [segW, segH] = opts.segments ?? [48, 32];
    this.geometry = new THREE.SphereGeometry(radius, segW, segH);
    this.material = new THREE.MeshBasicMaterial({ map });
    this.group.add(new THREE.Mesh(this.geometry, this.material));

    // Black aura: a camera-facing sprite centered on the globe. Its gradient
    // is solid ink out to the globe's silhouette (a crisp rim against the
    // pale surface — the near hemisphere occludes the rest) and fades beyond.
    this.auraMaterial = new THREE.SpriteMaterial({
      map: InkGlobe.getAuraTexture(),
      color: 0x111114,
      transparent: true,
      depthWrite: false,
    });
    const aura = new THREE.Sprite(this.auraMaterial);
    aura.scale.setScalar(radius * 2 * AURA_SCALE);
    this.group.add(aura);
  }

  /** Shared radial-gradient sprite: white ink (tinted by the material color),
   *  solid to the globe edge, easing to transparent at the sprite rim. */
  private static getAuraTexture(): THREE.Texture {
    if (!InkGlobe.auraTexture) {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const g = canvas.getContext('2d')!;
      const edge = 1 / AURA_SCALE; // globe silhouette as a fraction of the sprite
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(edge, 'rgba(255,255,255,1)');
      grad.addColorStop(edge + (1 - edge) * 0.35, 'rgba(255,255,255,0.3)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      InkGlobe.auraTexture = new THREE.CanvasTexture(canvas);
    }
    return InkGlobe.auraTexture;
  }

  /**
   * Reduce a loaded color map to grayscale ink (luminance + a gentle contrast
   * push so surface features read). With `invert` (the default) values are
   * flipped so dark regions print white and bright ones dark — pass false to
   * keep the map's natural brightness. Pixel loop instead of a canvas filter
   * for consistent output across browsers. Call once per source map; the
   * returned texture may be shared between globes and is not disposed by
   * dispose().
   */
  static toInk(source: THREE.Texture, invert = true): THREE.CanvasTexture {
    const img = source.image as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const pixels = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = THREE.MathUtils.clamp(128 + (lum - 128) * 1.35, 0, 255);
      d[i] = d[i + 1] = d[i + 2] = invert ? 255 - v : v;
    }
    g.putImageData(pixels, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.auraMaterial.dispose();
  }
}
