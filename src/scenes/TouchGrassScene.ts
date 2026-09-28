import { SceneBase } from './SceneBase';
import { TouchGrassScenery } from './TouchGrassScenery';
import { TouchGrassBlades } from './TouchGrassBlades';

/** Static game capture with independently bending grass meshes in the foreground. */
export class TouchGrassScene extends SceneBase {
  private scenery!: TouchGrassScenery;
  private clock = 0;

  init(): void {
    this.scenery = new TouchGrassScenery(this.ctx.assets);
    this.scene.add(this.scenery.mesh);
    const blades = new TouchGrassBlades(this.scenery, this.ctx.quality.density);
    this.scene.add(blades.mesh);
    this.ctx.rig.parallax.set(0, 0);
    window.addEventListener('pointermove', this.onPointer);
    window.addEventListener('pointerdown', this.onPointer);
  }

  private canInteract(): boolean {
    const c = document.body.classList;
    return this.scenery.ready && c.contains('tg-motion') && c.contains('tg-scene-visible') &&
      !c.contains('tg-context-lost');
  }

  private onPointer = (event: PointerEvent): void => {
    if (!this.canInteract() || !(event.target instanceof Element) ||
      !event.target.closest('.tg-hero') || event.target.closest('a,button') ||
      (event.pointerType === 'touch' && event.type !== 'pointerdown')) return;
    this.scenery.uniforms.uTouch.value.set(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
    this.scenery.uniforms.uTouchStrength.value = event.type === 'pointerdown' ? 1.2 : .65;
  };

  buildScrollTimeline(): void {
    // Keep the captured trees and rocks stable instead of simulating a mismatched 3D camera.
  }

  update(dt: number): void {
    this.clock += dt;
    this.scenery.uniforms.uTime.value = this.clock;
    this.scenery.uniforms.uTouchStrength.value *= Math.exp(-dt * 1.6);
    // Reveal only in a render frame after the texture is ready; no black loading flash.
    if (this.scenery.ready) document.body.classList.add('tg-scene-loaded');
  }

  resize(width: number, height: number): void {
    this.scenery.resize(width, height);
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerdown', this.onPointer);
    this.scenery.dispose();
    super.dispose();
  }
}
