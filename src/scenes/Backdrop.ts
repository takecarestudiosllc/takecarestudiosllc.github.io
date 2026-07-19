import * as THREE from 'three';
import { shaders } from '../shaders';

/**
 * Fullscreen shader backdrop. The vertex shader outputs clip-space directly,
 * so this always fills the viewport regardless of camera moves — camera
 * motion only affects the mid-ground (particles, grass, meshes), which
 * produces the layered parallax feel.
 */
export class Backdrop {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    uTime: THREE.IUniform<number>;
    uScroll: THREE.IUniform<number>;
    uAspect: THREE.IUniform<number>;
    uPointer: THREE.IUniform<THREE.Vector2>;
    uColorA: THREE.IUniform<THREE.Color>;
    uColorB: THREE.IUniform<THREE.Color>;
    uColorC: THREE.IUniform<THREE.Color>;
  };

  constructor(
    fragmentShader: string,
    colors: { a: number; b: number; c: number },
    /** Extra shader-specific uniforms (e.g. paper.frag's uClouds). Shared by
     *  reference, so the caller can keep tweening the objects it passed. */
    extra: Record<string, THREE.IUniform<number | THREE.Vector2>> = {},
  ) {
    this.uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uAspect: { value: window.innerWidth / window.innerHeight },
      uPointer: { value: new THREE.Vector2() },
      uColorA: { value: new THREE.Color(colors.a) },
      uColorB: { value: new THREE.Color(colors.b) },
      uColorC: { value: new THREE.Color(colors.c) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: shaders.backdropVert,
      fragmentShader,
      uniforms: { ...this.uniforms, ...extra },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; // always drawn first, behind everything
  }

  update(elapsed: number, pointer: { x: number; y: number }): void {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uPointer.value.set(pointer.x, pointer.y);
  }

  resize(width: number, height: number): void {
    this.uniforms.uAspect.value = width / height;
  }
}
