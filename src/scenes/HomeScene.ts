import gsap from 'gsap';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { shaders } from '../shaders';

/**
 * Studio landing page: violet nebula backdrop + drifting dust field.
 * Scroll dollies the camera forward and down through the dust while the
 * nebula slowly travels.
 */
export class HomeScene extends SceneBase {
  private backdrop!: Backdrop;
  private dust!: ParticleField;

  init(): void {
    this.backdrop = new Backdrop(shaders.nebulaFrag, {
      a: 0x06060a, // near-black
      b: 0x1d1840, // deep indigo cloud
      c: 0x8b7dff, // violet glow (matches --accent)
    });
    this.scene.add(this.backdrop.mesh);

    this.dust = new ParticleField({
      count: Math.round(900 * this.ctx.quality.density),
      color: 0xb9b4ff,
      size: 0.1,
      opacity: 0.45,
      sway: 0.6,
      rise: 0.05,
      parallax: 2.5,
      bounds: { x: 11, y: 7, zNear: 4, zFar: -8 },
    });
    this.scene.add(this.dust.points);

    this.ctx.rig.position.set(0, 0.4, 9);
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
    tl.to(this.ctx.rig.position, { y: -1.2, z: 5.5 }, 0)
      .to(this.ctx.rig.lookAt, { y: 0.5 }, 0)
      .to(this.backdrop.uniforms.uScroll, { value: 1 }, 0)
      .to(this.dust.uniforms.uScroll, { value: 1 }, 0);
  }

  update(dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    void dt;
    this.backdrop.update(elapsed, pointer);
    this.dust.update(elapsed);
    this.dust.points.rotation.y = elapsed * 0.015; // slow ambient orbit
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
