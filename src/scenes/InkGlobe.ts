import * as THREE from 'three';

export interface InkGlobeOptions {
  /** [width, height] segment counts of the sphere geometry. */
  segments?: [number, number];
  /** Aura shell diameter relative to the globe's; defaults to AURA_SCALE.
   *  Keep at or below AURA_SCALE — scene exit clearances assume it. */
  auraScale?: number;
  /** Aura tint; defaults to the ink navy. */
  auraColor?: number;
  /** Peak aura alpha at the globe's silhouette; defaults to 0.5. */
  auraOpacity?: number;
}

/** Aura shell diameter relative to the globe's — the fade-out span. Exported
 *  so scenes can keep the aura in mind when sliding globes off-screen. */
export const AURA_SCALE = 1.225;

/** The globes' "ink": dark navy instead of black, for both the darkest
 *  texture values and the aura tint. */
const INK_COLOR = 0x0f1e46;

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
  private material: THREE.ShaderMaterial;
  private auraGeometry: THREE.SphereGeometry;
  private auraMaterial: THREE.ShaderMaterial;

  constructor(radius: number, map: THREE.Texture, opts: InkGlobeOptions = {}) {
    const [segW, segH] = opts.segments ?? [48, 32];
    this.geometry = new THREE.SphereGeometry(radius, segW, segH);
    // The map stores ink strength as grayscale (0 = full ink, 1 = paper);
    // the dark end renders as INK_COLOR navy so the globes match their auras.
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        // Raw sRGB channels (the shader writes to an sRGB target directly).
        uInk: {
          value: new THREE.Vector3(
            ((INK_COLOR >> 16) & 255) / 255,
            ((INK_COLOR >> 8) & 255) / 255,
            (INK_COLOR & 255) / 255,
          ),
        },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uInk;
        varying vec2 vUv;
        void main() {
          float t = texture2D(uMap, vUv).r;
          gl_FragColor = vec4(mix(uInk, vec3(1.0), t), 1.0);
        }
      `,
    });
    this.group.add(new THREE.Mesh(this.geometry, this.material));

    // Black aura: a larger back-side shell whose alpha fades with the view
    // angle — full ink where the globe's silhouette cuts it, transparent at
    // the shell's own rim. Because it's real geometry it projects exactly
    // like the globe does, so the halo stays concentric even when the globe
    // sits far off the camera axis (a camera-facing sprite goes lopsided
    // there: the sphere projects as an offset ellipse, not a circle).
    const auraScale = opts.auraScale ?? AURA_SCALE;
    const auraColor = opts.auraColor ?? INK_COLOR;
    this.auraGeometry = new THREE.SphereGeometry(radius * auraScale, segW, segH);
    // |view·normal| at the globe's silhouette as seen from far away — where
    // the fade should reach full strength.
    const edge = Math.sqrt(1 - 1 / (auraScale * auraScale));
    this.auraMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        // Raw sRGB channels (the shader writes to an sRGB target directly;
        // THREE.Color's linear conversion would render nearly black).
        uColor: {
          value: new THREE.Vector3(
            ((auraColor >> 16) & 255) / 255,
            ((auraColor >> 8) & 255) / 255,
            (auraColor & 255) / 255,
          ),
        },
        uEdge: { value: edge },
        uOpacity: { value: opts.auraOpacity ?? 0.5 },
      },
      vertexShader: /* glsl */ `
        varying float vDot;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vDot = abs(dot(n, normalize(-mvPos.xyz)));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uEdge;
        uniform float uOpacity;
        varying float vDot;
        void main() {
          float t = smoothstep(0.0, uEdge, vDot);
          gl_FragColor = vec4(uColor, t * t * uOpacity);
        }
      `,
    });
    this.group.add(new THREE.Mesh(this.auraGeometry, this.auraMaterial));
  }

  /**
   * Reduce a loaded color map to an ink-strength mask: luminance with a
   * gentle contrast push so surface features read, stored as grayscale
   * (0 = full ink, 1 = paper white) for the surface shader to colorize.
   * With `invert` (the default) values are flipped so dark regions print
   * white and bright ones dark — pass false to keep the map's natural
   * brightness. Pixel loop instead of a canvas filter for consistent output
   * across browsers. Call once per source map; the returned texture may be
   * shared between globes and is not disposed by dispose().
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
    // Data texture, not imagery: the shader reads ink strength verbatim, so
    // skip the sRGB decode that would bend the ramp.
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.auraGeometry.dispose();
    this.auraMaterial.dispose();
  }
}
