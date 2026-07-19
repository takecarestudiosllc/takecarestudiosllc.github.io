import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Central asset loading with a shared LoadingManager. Current scenes are fully
 * procedural (shaders + instancing), but scenes receive this loader so future
 * GLB models / textures can be added without new plumbing:
 *
 *   const { model } = await ctx.assets.loadAll({ model: { url: '/models/x.glb', type: 'gltf' } });
 */
export type AssetRequest =
  | { url: string; type: 'texture' }
  | { url: string; type: 'gltf' };

export class AssetLoader {
  private manager = new THREE.LoadingManager();
  private textureLoader = new THREE.TextureLoader(this.manager);
  // Decoder files are copied from three/examples/jsm/libs/draco/gltf into
  // public/draco/ so Draco-compressed GLBs (e.g. phone.glb) decode locally.
  private dracoLoader = new DRACOLoader(this.manager).setDecoderPath('/draco/');
  private gltfLoader = new GLTFLoader(this.manager).setDRACOLoader(this.dracoLoader);

  loadTexture(url: string): Promise<THREE.Texture> {
    return this.textureLoader.loadAsync(url);
  }

  loadGLTF(url: string): Promise<GLTF> {
    return this.gltfLoader.loadAsync(url);
  }

  /** Load a keyed manifest of assets in parallel. */
  async loadAll<T extends Record<string, AssetRequest>>(
    manifest: T,
  ): Promise<{ [K in keyof T]: T[K]['type'] extends 'gltf' ? GLTF : THREE.Texture }> {
    const entries = await Promise.all(
      Object.entries(manifest).map(async ([key, req]) => {
        const asset = req.type === 'gltf' ? await this.loadGLTF(req.url) : await this.loadTexture(req.url);
        return [key, asset] as const;
      }),
    );
    return Object.fromEntries(entries) as never;
  }
}
