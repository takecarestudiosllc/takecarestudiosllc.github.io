import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { shaders } from '../shaders';

/**
 * Support page: the jade grid matrix from zhong.html's corpus section, here as
 * the page's own background rather than a per-section flourish. Nothing else —
 * no constellation, no motes — so the panels stay the thing you look at.
 *
 * The grid holds at full strength the whole way down (its shader already
 * vignettes it to the middle of the frame); the canvas fade-in is what keeps it
 * from popping on load.
 */
export class SupportScene extends SceneBase {
  private grid!: Backdrop;
  private opacity = { value: 1 };

  init(): void {
    this.grid = new Backdrop(
      shaders.gridFrag,
      { a: 0x1e9b6e, b: 0x88ecc4, c: 0x5eecc8 },
      { uOpacity: this.opacity },
      { transparent: true },
    );
    this.scene.add(this.grid.mesh);

    this.ctx.rig.position.set(0, 0, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  // The backdrop fills clip space regardless of the camera, and there is
  // nothing else here to move — so nothing for scroll to drive.
  buildScrollTimeline(): void {}

  update(_dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    this.grid.update(elapsed, pointer);
  }

  resize(width: number, height: number): void {
    this.grid.resize(width, height);
  }
}
