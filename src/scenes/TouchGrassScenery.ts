import * as THREE from 'three';
import type { AssetLoader } from '../app/AssetLoader';
import { shaders } from '../shaders';

/** The game's own, undistorted forest capture. Crop and color inputs also feed the blade layer. */
export class TouchGrassScenery {
  readonly uniforms = {
    uImage: { value: null as THREE.Texture | null },
    uImageAspect: { value: 16 / 9 },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uTime: { value: 0 },
    uTouch: { value: new THREE.Vector2(.5, .12) },
    uTouchStrength: { value: 0 },
    uReady: { value: 0 },
  };
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private texture: THREE.Texture | null = null;
  private disposed = false;

  constructor(assets: AssetLoader) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: shaders.backdropVert,
      fragmentShader: shaders.meadowFrag,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    // Reuse the original 1920px capture on large screens; phones use the smaller copy.
    const url = window.innerWidth >= 900 ? '/textures/tgs2.png' : '/textures/tgs2_1024.jpg';
    void assets.loadTexture(url).then((texture) => {
      if (this.disposed) { texture.dispose(); return; }
      // The shared renderer uses no output conversion. Preserve the capture's exact colors.
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.texture = texture;
      this.uniforms.uImage.value = texture;
      const image = texture.image as HTMLImageElement;
      this.uniforms.uImageAspect.value = image.naturalWidth / image.naturalHeight;
      this.uniforms.uReady.value = 1;
    }).catch(() => {
      // The DOM image remains visible and the motion controls stay hidden on failure.
    });
  }

  get ready(): boolean { return this.uniforms.uReady.value === 1; }

  resize(width: number, height: number): void {
    this.uniforms.uAspect.value = width / height;
  }

  dispose(): void {
    this.disposed = true;
    this.texture?.dispose();
  }
}
