import * as THREE from 'three';
import { shaders } from '../shaders';

export interface ParticleFieldOptions {
  count: number;
  color: number;
  /** Particle diameter in world units (projected to pixels by depth). */
  size: number;
  opacity: number;
  /** Idle drift amplitude in world units. */
  sway: number;
  /** Upward speed — embers rise, dust stays near 0. */
  rise: number;
  /** Scroll-driven vertical parallax amount. */
  parallax: number;
  /** Half-extents of the spawn box. */
  bounds: { x: number; y: number; zNear: number; zFar: number };
  /** Defaults to additive (glowing motes on dark scenes); pass NormalBlending
   *  for light backdrops where additive would wash out to invisible. */
  blending?: THREE.Blending;
}

/**
 * GPU particle field (a single draw call). Motion is computed in the vertex
 * shader from uTime, so per-frame CPU cost is just two uniform updates.
 */
export class ParticleField {
  readonly points: THREE.Points;
  readonly uniforms: {
    uTime: THREE.IUniform<number>;
    uScroll: THREE.IUniform<number>;
    uSize: THREE.IUniform<number>;
    uScale: THREE.IUniform<number>;
    uSway: THREE.IUniform<number>;
    uRise: THREE.IUniform<number>;
    uParallax: THREE.IUniform<number>;
    uColor: THREE.IUniform<THREE.Color>;
    uOpacity: THREE.IUniform<number>;
  };

  constructor(opts: ParticleFieldOptions) {
    const positions = new Float32Array(opts.count * 3);
    const seeds = new Float32Array(opts.count);
    for (let i = 0; i < opts.count; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * opts.bounds.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * opts.bounds.y;
      positions[i * 3 + 2] = THREE.MathUtils.lerp(opts.bounds.zNear, opts.bounds.zFar, Math.random());
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSize: { value: opts.size },
      uScale: { value: window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) },
      uSway: { value: opts.sway },
      uRise: { value: opts.rise },
      uParallax: { value: opts.parallax },
      uColor: { value: new THREE.Color(opts.color) },
      uOpacity: { value: opts.opacity },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: shaders.particlesVert,
      fragmentShader: shaders.particlesFrag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: opts.blending ?? THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; // the wrap in the shader moves particles
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
