import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { LotusFlower } from './LotusFlower';
import { shaders } from '../shaders';

/**
 * Studio landing page — four scroll beats over one violet nebula:
 *   1. Hero copy (DOM only, canvas is backdrop).
 *   2. #model-showcase — a 3D model crosses the screen right → left, scrubbed.
 *   3. #games — DOM cards slide in (see domAnimations), canvas stays ambient.
 *   4. #lotus — a hand rises from below, palm-light ignites and blooms into a
 *      lotus; the finale copy fades in on the last stretch (DOM side).
 *
 * Scroll-driven values are tweened on wrapper groups / plain properties;
 * idle life (bobbing, spin, flicker) is layered on inner nodes in update()
 * so the two never fight.
 */

// Depth planes for the model beats (camera sits at z = 9 looking at origin).
const HELMET_Z = 4;
const HAND_Z = 4.5;
/** x far enough beyond the frustum edge (plus camera sway) to be off-screen. */
const OFFSCREEN_X = 6.5;
const HAND_HIDDEN_Y = -7;
const HAND_RAISED_Y = -1.35;

// Orientation of the loaded hand model so the palm faces up toward the camera.
// The WebXR "generic hand" glb is authored in grip space; if a replacement
// model faces the wrong way, these two are the knobs to turn.
const HAND_ROTATION = new THREE.Euler(0.55, 0.25, -Math.PI / 2, 'XYZ');
const HAND_SCALE = 11.5;
/** Where the lotus sits relative to the hand wrapper (roughly the palm). */
const PALM_OFFSET = new THREE.Vector3(0, 0.95, -0.1);

export class HomeScene extends SceneBase {
  private backdrop!: Backdrop;
  private dust!: ParticleField;
  private lotus!: LotusFlower;

  /** Scroll-tweened wrappers; loaded models drop in as children when ready. */
  private helmet = new THREE.Group();
  private helmetModel = new THREE.Group();
  private hand = new THREE.Group();
  private handModel = new THREE.Group();

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

    // --- lighting for the PBR beats (shader materials ignore all of this) ---
    const pmrem = new THREE.PMREMGenerator(this.ctx.gl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xfff4e6, 1.1);
    key.position.set(3, 4, 6);
    const rim = new THREE.DirectionalLight(0x8b7dff, 1.6);
    rim.position.set(-5, 1, -3);
    this.scene.add(new THREE.AmbientLight(0x8b7dff, 0.25), key, rim);

    // --- beat 2: the crossing model (starts parked off-screen right) --------
    this.helmet.position.set(OFFSCREEN_X, -0.35, HELMET_Z);
    this.helmet.add(this.helmetModel);
    this.scene.add(this.helmet);

    // --- beat 4: hand + lotus (starts parked below the frustum) -------------
    this.hand.position.set(0, HAND_HIDDEN_Y, HAND_Z);
    this.handModel.rotation.copy(HAND_ROTATION);
    this.handModel.scale.setScalar(HAND_SCALE);
    this.hand.add(this.handModel);
    this.lotus = new LotusFlower();
    this.lotus.group.position.copy(PALM_OFFSET);
    this.lotus.group.scale.setScalar(0.9);
    this.hand.add(this.lotus.group);
    this.scene.add(this.hand);

    void this.loadModels();

    this.ctx.rig.position.set(0, 0.4, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  private async loadModels(): Promise<void> {
    const { helmet, hand } = await this.ctx.assets.loadAll({
      helmet: { url: '/models/helmet.glb', type: 'gltf' },
      hand: { url: '/models/hand.glb', type: 'gltf' },
    });

    helmet.scene.scale.setScalar(0.85);
    this.helmetModel.add(helmet.scene);

    // Sculptural override: the hand reads as one dark form that the palm
    // light carves out, instead of the asset's utilitarian skin material.
    const handMat = new THREE.MeshStandardMaterial({
      color: 0x37315e,
      roughness: 0.5,
      metalness: 0.1,
    });
    hand.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.material = handMat;
    });
    this.handModel.add(hand.scene);
  }

  buildScrollTimeline(): void {
    const scrub = this.ctx.scrub;

    // Whole-page: nebula travel + dust drift (as before).
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub },
      })
      .to(this.backdrop.uniforms.uScroll, { value: 1 }, 0)
      .to(this.dust.uniforms.uScroll, { value: 1 }, 0);

    // Beat 2 — helmet crosses right → left while its section scrolls through.
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#model-showcase', start: 'top center', end: 'bottom bottom', scrub },
      })
      .fromTo(this.helmet.position, { x: OFFSCREEN_X }, { x: -OFFSCREEN_X }, 0)
      .fromTo(this.helmet.rotation, { y: -1.3 }, { y: 1.1 }, 0)
      .fromTo(this.helmet.position, { y: -0.55 }, { y: -0.05, ease: 'sine.inOut' }, 0);

    // Beat 4 — hand rises, palm light ignites, lotus blooms. Durations are
    // fractions of the pinned scroll (timeline is 1 unit long).
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#lotus', start: 'top 80%', end: 'bottom bottom', scrub },
      })
      .fromTo(this.hand.position, { y: HAND_HIDDEN_Y }, { y: HAND_RAISED_Y, duration: 0.32, ease: 'sine.out' }, 0)
      .to(this.lotus, { glow: 1, duration: 0.28 }, 0.16)
      .to(this.lotus, { bloom: 1, duration: 0.42 }, 0.4)
      .to({}, { duration: 0.18 }, 0.82); // hold the bloom while the finale copy fades in
  }

  update(dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    void dt;
    this.backdrop.update(elapsed, pointer);
    this.dust.update(elapsed);
    this.dust.points.rotation.y = elapsed * 0.015; // slow ambient orbit

    // Idle life on the inner nodes (scroll owns the wrappers).
    this.helmetModel.position.y = Math.sin(elapsed * 0.9) * 0.08;
    this.helmetModel.rotation.z = Math.sin(elapsed * 0.6) * 0.06;
    this.handModel.position.y = Math.sin(elapsed * 0.7) * 0.05;
    this.lotus.update(elapsed);
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
