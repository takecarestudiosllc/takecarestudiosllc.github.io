import * as THREE from 'three';
import { shaders } from '../shaders';

export interface StarFieldOptions {
  count: number;
  /** Star diameter in world units (projected to pixels by depth). */
  size: number;
  opacity: number;
  /** Half-extents of the spawn box (z as near/far planes). */
  bounds: { x: number; y: number; zNear: number; zFar: number };
}

/**
 * Hero-only star field (a single draw call): small ink stars that twinkle in
 * place. Tween `uniforms.uExit` 0 → 1 from a scroll timeline and the stars
 * rise, recede from the camera, defocus, and fade out — all in the shader,
 * so per-frame CPU cost is one uniform update.
 */
export class StarField {
  readonly points: THREE.Points;
  readonly uniforms: {
    uTime: THREE.IUniform<number>;
    uExit: THREE.IUniform<number>;
    uSize: THREE.IUniform<number>;
    uScale: THREE.IUniform<number>;
    uOpacity: THREE.IUniform<number>;
  };

  constructor(opts: StarFieldOptions) {
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
      uExit: { value: 0 },
      uSize: { value: opts.size },
      uScale: { value: window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: opts.opacity },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: shaders.starsVert,
      fragmentShader: shaders.starsFrag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // dark stars on a white field
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; // uExit moves stars in the shader
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
