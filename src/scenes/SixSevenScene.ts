import gsap from 'gsap';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { shaders } from '../shaders';

/**
 * Six Seven VR page: molten lava-lamp backdrop (pulled from the game's key
 * art) with embers rising through the frame. Scroll zooms the lava and sinks
 * the camera through the ember field.
 */
export class SixSevenScene extends SceneBase {
  private backdrop!: Backdrop;
  private embers!: ParticleField;

  init(): void {
    this.backdrop = new Backdrop(shaders.lavaFrag, {
      a: 0x330502, // deep red base
      b: 0xe2380b, // orange blobs
      c: 0xffb400, // yellow cores
    });
    this.scene.add(this.backdrop.mesh);

    this.embers = new ParticleField({
      count: Math.round(700 * this.ctx.quality.density),
      color: 0xffcf4d,
      size: 0.09,
      opacity: 0.55,
      sway: 0.35,
      rise: 0.55, // embers drift upward
      parallax: 2.0,
      bounds: { x: 10, y: 7, zNear: 4, zFar: -7 },
    });
    this.scene.add(this.embers.points);

    this.ctx.rig.position.set(0, 0, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  buildScrollTimeline(): void {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: this.ctx.scrub,
      },
    });
    tl.to(this.ctx.rig.position, { y: -1.0, z: 6.2 }, 0)
      .to(this.ctx.rig.lookAt, { y: 0.4 }, 0)
      .to(this.backdrop.uniforms.uScroll, { value: 1 }, 0)
      .to(this.embers.uniforms.uScroll, { value: 1 }, 0);
  }

  update(dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    void dt;
    this.backdrop.update(elapsed, pointer);
    this.embers.update(elapsed);
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
