import gsap from 'gsap';
import type { QualityProfile } from './Quality';
import { Renderer } from './Renderer';
import { CameraRig } from './CameraRig';
import { AssetLoader } from './AssetLoader';
import { createSceneForPage } from './SceneManager';

/**
 * WebGL bootstrap. This module (and Three.js with it) is loaded dynamically
 * by App only on pages that have a scene, so text-only pages (legal) never
 * download the 3D stack.
 */
export function bootWebGL(page: string, quality: QualityProfile, scrub: boolean | number): void {
  const rig = new CameraRig(quality);
  const scene = createSceneForPage(page, {
    rig,
    assets: new AssetLoader(),
    quality,
    scrub,
  });
  if (!scene) return;

  const renderer = new Renderer(quality);
  scene.init();
  scene.buildScrollTimeline();

  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.resize(w, h);
    rig.resize(w, h);
    scene.resize(w, h);
  });

  // Single render loop on the shared GSAP ticker (same clock as Lenis/ScrollTrigger).
  const start = gsap.ticker.time;
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 1 / 20); // clamp tab-switch spikes
    rig.update(pointer, dt);
    scene.update(dt, time - start, pointer);
    renderer.render(scene.scene, rig.camera);
    renderer.reveal();
  });
}
