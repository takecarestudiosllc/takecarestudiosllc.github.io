import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { LotusFlower } from './LotusFlower';
import { InkGlobe } from './InkGlobe';
import { shaders } from '../shaders';

/**
 * Studio landing page — four scroll beats over a paper-white field flanked
 * by slowly turning black-and-white globes (big Earth right, small moon left):
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
const PHONE_Z = 4;
const HAND_Z = 0.5;
/** Margin past the frustum edge covering the model's own size + camera sway. */
const OFFSCREEN_MARGIN = 2.2;
const HAND_HIDDEN_Y = -7;
const HAND_RAISED_Y = -0.7;

// Orientation of the loaded hand model: upturned palm (holding the lotus),
// fingers reaching toward the camera. Tuned visually with world-space
// corrections baked into one Euler; the glb's bind-pose axes reported in
// the asset do not match what renders, so trust the eyeball, not the
// export metadata. To adjust: compose extra world-axis quaternion
// rotations onto this value numerically rather than tweaking components.
const HAND_ROTATION = new THREE.Euler(-2.599, 0.048, 0.15, 'XYZ');
const HAND_SCALE = 21;
/** Where the lotus sits relative to the hand wrapper (roughly the palm).
 *  Scales with HAND_SCALE — the palm's wrapper-space position moves linearly
 *  with the model scale, so double the hand means double this offset. */
const PALM_OFFSET = new THREE.Vector3(0, 0.14, 1.5);
/** Lean the bloom toward the camera so its golden heart reads, not just the
 *  petal rim (camera sits above and in front of the flower). */
const LOTUS_TILT = 0.65;

export class HomeScene extends SceneBase {
  private backdrop!: Backdrop;
  private dust!: ParticleField;
  private lotus!: LotusFlower;
  /** Flanking globes — more may join later, keep them in one list.
   *  Empty until their textures finish loading in loadModels(). */
  private globes: InkGlobe[] = [];

  /** Scroll-tweened wrappers; loaded models drop in as children when ready. */
  private phone = new THREE.Group();
  private phoneModel = new THREE.Group();
  private hand = new THREE.Group();
  private handModel = new THREE.Group();

  init(): void {
    this.backdrop = new Backdrop(shaders.paperFrag, {
      a: 0xffffff, // page white
      b: 0xefeef4, // faint corner wash
      c: 0x111114, // unused
    });
    this.scene.add(this.backdrop.mesh);

    this.dust = new ParticleField({
      count: Math.round(900 * this.ctx.quality.density),
      color: 0x55506e, // ink-violet motes read on the white field
      size: 0.1,
      opacity: 0.3,
      sway: 0.6,
      rise: 0.05,
      parallax: 2.5,
      bounds: { x: 11, y: 7, zNear: 4, zFar: -8 },
      blending: THREE.NormalBlending, // additive washes out against white
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
    this.phone.position.set(this.offscreenX(), -0.35, PHONE_Z);
    this.phone.add(this.phoneModel);
    this.scene.add(this.phone);

    // --- beat 4: hand + lotus (starts parked below the frustum) -------------
    this.hand.position.set(0, HAND_HIDDEN_Y, HAND_Z);
    this.handModel.rotation.copy(HAND_ROTATION);
    this.handModel.scale.setScalar(HAND_SCALE);
    this.hand.add(this.handModel);
    this.lotus = new LotusFlower();
    this.lotus.group.position.copy(PALM_OFFSET);
    this.lotus.group.rotation.x = LOTUS_TILT;
    this.lotus.group.scale.setScalar(0.9);
    this.hand.add(this.lotus.group);
    this.scene.add(this.hand);

    void this.loadModels();

    this.ctx.rig.position.set(0, 0.4, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  /**
   * x just past the frustum edge at the phone's depth. Derived from the
   * camera aspect (not a desktop-tuned constant) so on narrow phones the
   * crossing spans the visible width instead of happening mostly off-screen.
   */
  private offscreenX(): number {
    const cam = this.ctx.rig.camera;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (this.ctx.rig.position.z - PHONE_Z);
    return halfH * cam.aspect + OFFSCREEN_MARGIN;
  }

  private async loadModels(): Promise<void> {
    const { phone, hand, earthMap, moonMap } = await this.ctx.assets.loadAll({
      phone: { url: '/models/phone.glb', type: 'gltf' },
      hand: { url: '/models/hand.glb', type: 'gltf' },
      earthMap: { url: '/textures/earth_day_2048.jpg', type: 'texture' },
      moonMap: { url: '/textures/moon_1024.jpg', type: 'texture' },
    });

    // Globes flanking the page: big Earth right, small moon left, both in
    // natural grayscale (dark oceans / bright land, bright moon) — their
    // black auras keep the silhouettes crisp on the white page.
    const earthInk = InkGlobe.toInk(earthMap, false);
    const moonInk = InkGlobe.toInk(moonMap, false);
    earthMap.dispose();
    moonMap.dispose();
    const earth = new InkGlobe(2.9, earthInk);
    earth.group.position.set(5.4, 0.6, -1.5);
    const moon = new InkGlobe(1.15, moonInk, { segments: [32, 22] });
    moon.group.position.set(-4.9, -0.8, -1);
    this.globes = [earth, moon];
    for (const g of this.globes) this.scene.add(g.group);

    // Normalize authored units: center the model and scale its longest axis
    // to a fixed world height so a replacement GLB drops in unchanged.
    const box = new THREE.Box3().setFromObject(phone.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.2 / Math.max(size.x, size.y, size.z);
    phone.scene.scale.setScalar(scale);
    phone.scene.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
    // The screen ships as dead black gloss. Give the screen face (asset mesh
    // "pCube3_Front_0") its own copy of the shared "Front" material with an
    // emissive wallpaper — a violet gradient inside a dark bezel so it reads
    // as a lit display — without lighting up the side buttons that reuse the
    // same material.
    phone.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name === 'pCube3_Front_0') {
        const mat = (obj.material as THREE.MeshStandardMaterial).clone();
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = 0.9;
        mat.emissiveMap = this.makeScreenTexture();
        obj.material = mat;
      }
    });
    this.phoneModel.add(phone.scene);

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

  /** Wallpaper for the phone screen: violet glow rising from the bottom edge,
   *  black bezel rim. (Canvas top lands at the screen's bottom via glTF UVs.) */
  private makeScreenTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 1024;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#8b7dff'); // site accent at the top…
    grad.addColorStop(0.55, '#2c2260');
    grad.addColorStop(1, '#0d0a1f'); // …falling into near-black
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(30, 30, c.width - 60, c.height - 60, 44);
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // match glTF UV convention
    return tex;
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

    // Beat 2 — phone crosses right → left while its section scrolls through.
    // Endpoints are functions so a resize/rotation refresh recomputes them.
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#model-showcase',
          start: 'top center',
          end: 'bottom bottom',
          scrub,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(this.phone.position, { x: () => this.offscreenX() }, { x: () => -this.offscreenX() }, 0)
      // Sweep stays well under ±90° so the screen faces the viewer the whole
      // crossing — the back of the phone is never shown.
      .fromTo(this.phone.rotation, { y: -0.55 }, { y: 0.45 }, 0)
      .fromTo(this.phone.position, { y: -0.55 }, { y: -0.05, ease: 'sine.inOut' }, 0);

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

    // Globes turn slowly, alternating direction so they don't read as one
    // rigid backdrop.
    this.globes.forEach((g, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      g.group.rotation.y = elapsed * 0.08 * dir;
      g.group.rotation.x = Math.sin(elapsed * 0.11 + i * 2.1) * 0.15;
    });

    // Idle life on the inner nodes (scroll owns the wrappers).
    this.phoneModel.position.y = Math.sin(elapsed * 0.9) * 0.08;
    this.phoneModel.rotation.z = Math.sin(elapsed * 0.6) * 0.06;
    this.handModel.position.y = Math.sin(elapsed * 0.7) * 0.05;
    this.lotus.update(elapsed);
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
