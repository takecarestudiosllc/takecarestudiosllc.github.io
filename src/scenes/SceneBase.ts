import * as THREE from 'three';
import type { CameraRig } from '../app/CameraRig';
import type { AssetLoader } from '../app/AssetLoader';
import type { QualityProfile } from '../app/Quality';

/** Everything a scene needs from the app, injected at construction. */
export interface SceneContext {
  rig: CameraRig;
  assets: AssetLoader;
  quality: QualityProfile;
  /** Scroll-scrub setting to use on ScrollTrigger timelines. */
  scrub: boolean | number;
  /** Live renderer — lets scenes bake PMREM environment maps for PBR models. */
  gl: THREE.WebGLRenderer;
}

/**
 * Base class for page scenes. A scene owns its THREE.Scene graph, its scroll
 * timeline, and its per-frame updates. To add a new page: subclass this,
 * register it in SceneManager, and give the page's <body> a matching data-page.
 */
export abstract class SceneBase {
  readonly scene = new THREE.Scene();

  constructor(protected ctx: SceneContext) {}

  /** Build the scene graph. Called once, before the first frame. */
  abstract init(): void;

  /**
   * Create the GSAP timeline that scroll drives (camera moves, uniform
   * sweeps). Scenes attach their own ScrollTrigger inside.
   */
  abstract buildScrollTimeline(): void;

  /** Per-frame tick. dt in seconds, elapsed in seconds since start. */
  abstract update(dt: number, elapsed: number, pointer: { x: number; y: number }): void;

  resize(_width: number, _height: number): void {}

  /** Free GPU resources. MPA pages die with the document, but keep this correct. */
  dispose(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
