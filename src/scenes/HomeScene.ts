import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { StarField } from './StarField';
import { VaporTrack, trackY } from './VaporTrack';
import { toonGradient, addOutline } from './toon';
import { LotusFlower } from './LotusFlower';
import { InkGlobe, AURA_SCALE } from './InkGlobe';
import { shaders } from '../shaders';

/**
 * Studio landing page — four scroll beats over a paper-white field flanked
 * by slowly turning black-and-white globes (big Earth left, small moon right):
 *   1. Hero copy (DOM only, canvas is backdrop).
 *   2. #games — DOM cards slide in (see domAnimations), canvas stays ambient.
 *   3. #model-showcase — a 3D model crosses the screen right → left, scrubbed.
 *   4. #lotus — a hand rises from below, palm-light ignites and blooms into a
 *      lotus; the finale copy fades in on the last stretch (DOM side).
 *
 * Scroll-driven values are tweened on wrapper groups / plain properties;
 * idle life (bobbing, spin, flicker) is layered on inner nodes in update()
 * so the two never fight.
 */

// The globes belong to the hero beat only. The Earth hugs the left edge —
// EARTH_VISIBLE of its width on-screen, the rest past the frustum — and the
// moon floats at MOON_X right; both slide out past their own edge (aura
// included) as the showcase section scrolls in.
const EARTH_RADIUS = 2.9;
const EARTH_Z = -1.5;
const EARTH_VISIBLE = 0.55;
const MOON_RADIUS = 1.15;
const MOON_X = 4.9;
/** ~20% of the viewport height above the old resting spot (-0.8). */
const MOON_Y = 0.75;
const MOON_Z = -1;
/** Extra exit clearance for the pointer sway: the rig shifts up to ±0.5 and
 *  its lookAt compensation rotates the frustum, moving the edge ~1 world
 *  unit at the globes' depth. */
const SWAY_MARGIN = 1.2;

// Depth planes for the model beats (camera sits at z = 9 looking at origin).
const PHONE_Z = 4;
const HAND_Z = 0.5;
/** Margin past the frustum edge covering the model's own size + camera sway. */
const OFFSCREEN_MARGIN = 2.2;
const HAND_HIDDEN_Y = -7;
const HAND_RAISED_Y = 0.5;

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
 *  with the model scale, so double the hand means double this offset.
 *  y holds the lotus at its pre-raise height: when HAND_RAISED_Y moved up
 *  0.3 (-0.2 → 0.1), this dropped 0.3 to compensate (0.14 → -0.16). */
const PALM_OFFSET = new THREE.Vector3(0, -0.16, 1.5);
/** Lean the bloom toward the camera so its golden heart reads, not just the
 *  petal rim (camera sits above and in front of the flower). */
const LOTUS_TILT = 0.75;

export class HomeScene extends SceneBase {
  private backdrop!: Backdrop;
  private dust!: ParticleField;
  private stars!: StarField;
  private vapor!: VaporTrack;
  private lotus!: LotusFlower;
  /** Flanking globes — more may join later, keep them in one list.
   *  Empty until their textures finish loading in loadModels(). */
  private globes: InkGlobe[] = [];
  /** The big left-edge Earth and right moon (also in globes); null until
   *  loaded. */
  private earth: InkGlobe | null = null;
  private moon: InkGlobe | null = null;
  /** 0 = globes at their hero spots, 1 = fully slid off-screen. Tweened by
   *  scroll; positions are applied from it every frame. */
  private globesExit = 0;
  /** Hero nebula clouds in paper.frag: 1 visible → 0 gone. */
  private cloudFade: THREE.IUniform<number> = { value: 1 };
  /** Liquid-distortion cursor for paper.frag: smoothed position and velocity
   *  in the shader's aspect-corrected uv space. */
  private mouse: THREE.IUniform<THREE.Vector2> = { value: new THREE.Vector2() };
  private mouseVel: THREE.IUniform<THREE.Vector2> = { value: new THREE.Vector2() };
  private mouseTarget = new THREE.Vector2();
  private mouseInstVel = new THREE.Vector2();

  /** Scroll-tweened wrappers; loaded models drop in as children when ready. */
  private phone = new THREE.Group();
  private phoneModel = new THREE.Group();
  private hand = new THREE.Group();
  private handModel = new THREE.Group();

  init(): void {
    this.backdrop = new Backdrop(
      shaders.paperFrag,
      {
        a: 0xffffff, // page white
        b: 0xefeef4, // faint corner wash
        c: 0x111114, // hero nebula ink
      },
      { uClouds: this.cloudFade, uMouse: this.mouse, uMouseVel: this.mouseVel },
    );
    this.scene.add(this.backdrop.mesh);

    // Twinkling ink stars behind the globes, hero beat only — the hero-exit
    // timeline sends them up, away, out of focus, and gone.
    this.stars = new StarField({
      count: Math.round(40 * this.ctx.quality.density),
      size: 0.21,

      opacity: 0.85,
      bounds: { x: 9.5, y: 5.5, zNear: -3, zFar: -6 },
    });
    this.scene.add(this.stars.points);

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
    // Hidden during the hero (stars own that beat); the hero-exit timeline
    // fades the dust in as the stars leave.
    this.dust.uniforms.uOpacity.value = 0;
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

    // The ethereal track the phone rides: vapory lines + motes braided along
    // the same trackY curve that steers the phone's y in update().
    this.vapor = new VaporTrack({ halfWidth: 9, z: PHONE_Z - 0.3 });
    this.scene.add(this.vapor.group);

    // --- beat 4: hand + lotus (starts parked below the frustum) -------------
    this.hand.position.set(0, HAND_HIDDEN_Y, HAND_Z);
    this.handModel.rotation.copy(HAND_ROTATION);
    this.handModel.scale.setScalar(HAND_SCALE);
    this.hand.add(this.handModel);
    this.lotus = new LotusFlower();
    this.lotus.group.position.copy(PALM_OFFSET);
    this.lotus.group.rotation.x = LOTUS_TILT;
    this.lotus.group.scale.setScalar(1.4); // 1.08 + another 30%
    this.hand.add(this.lotus.group);
    this.scene.add(this.hand);

    void this.loadModels();

    this.ctx.rig.position.set(0, 0.4, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  /** Frustum half-width at depth z (the camera looks down -z from the rig). */
  private halfWidthAt(z: number): number {
    const cam = this.ctx.rig.camera;
    const dist = this.ctx.rig.position.z - z;
    return Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist * cam.aspect;
  }

  /**
   * |x| that fully clears a sphere of radius r centered at depth z out the
   * side of the frustum. The side planes are slanted, so clearing takes
   * r·√(1+slope²) beyond the half-width — measuring only at the center's
   * depth leaves the sphere's near hemisphere poking into view — plus
   * SWAY_MARGIN for the pointer parallax.
   */
  private clearX(z: number, r: number): number {
    const halfW = this.halfWidthAt(z);
    const slope = halfW / (this.ctx.rig.position.z - z);
    return halfW + r * Math.sqrt(1 + slope * slope) + SWAY_MARGIN;
  }

  /**
   * Place both globes for the current camera and hero-exit progress. At
   * globesExit = 0 the Earth peeks EARTH_VISIBLE of its width in from the
   * left frustum edge (center at edge = 50% visible; each extra 5% moves the
   * center 0.1 radius inward) and the moon rests at MOON_X; at 1 each has
   * slid past its own edge, aura included. Frame-rate applied (not cached)
   * so resizes and the scroll tween compose without re-plumbing.
   */
  private applyGlobePositions(): void {
    if (this.earth) {
      const baseX = -(this.halfWidthAt(EARTH_Z) + EARTH_RADIUS * (1 - 2 * EARTH_VISIBLE));
      const exitX = -this.clearX(EARTH_Z, EARTH_RADIUS * AURA_SCALE);
      this.earth.group.position.x = baseX + (exitX - baseX) * this.globesExit;
      // Center vertically on screen: the camera looks down from rig height
      // toward its lookAt, so the screen's mid-line at the Earth's depth
      // sits along that ray, not at y = 0.
      const rigPos = this.ctx.rig.position;
      const look = this.ctx.rig.lookAt;
      const t = (rigPos.z - EARTH_Z) / (rigPos.z - look.z);
      this.earth.group.position.y = rigPos.y + (look.y - rigPos.y) * t;
    }
    if (this.moon) {
      const exitX = this.clearX(MOON_Z, MOON_RADIUS * AURA_SCALE);
      this.moon.group.position.x = MOON_X + (exitX - MOON_X) * this.globesExit;
    }
  }

  /**
   * x just past the frustum edge at the phone's depth. Derived from the
   * camera aspect (not a desktop-tuned constant) so on narrow phones the
   * crossing spans the visible width instead of happening mostly off-screen.
   */
  private offscreenX(): number {
    return this.halfWidthAt(PHONE_Z) + OFFSCREEN_MARGIN;
  }

  private async loadModels(): Promise<void> {
    const { phone, hand, earthMap, moonMap } = await this.ctx.assets.loadAll({
      phone: { url: '/models/phone.glb', type: 'gltf' },
      hand: { url: '/models/hand.glb', type: 'gltf' },
      earthMap: { url: '/textures/earth_day_2048.jpg', type: 'texture' },
      moonMap: { url: '/textures/moon_1024.jpg', type: 'texture' },
    });

    // Globes flanking the page: big Earth left, small moon right, both in
    // natural grayscale (dark oceans / bright land, bright moon) — their
    // black auras keep the silhouettes crisp on the white page.
    const earthInk = InkGlobe.toInk(earthMap, false);
    const moonInk = InkGlobe.toInk(moonMap, false);
    earthMap.dispose();
    moonMap.dispose();
    const earth = new InkGlobe(EARTH_RADIUS, earthInk, { auraScale: AURA_SCALE * 0.9 });
    earth.group.position.set(0, 0, EARTH_Z); // x/y applied per-frame below
    const moon = new InkGlobe(MOON_RADIUS, moonInk, { segments: [32, 22] });
    moon.group.position.set(MOON_X, MOON_Y, MOON_Z);
    this.globes = [earth, moon];
    this.earth = earth;
    this.moon = moon;
    this.applyGlobePositions();
    for (const g of this.globes) this.scene.add(g.group);

    // Normalize authored units: center the model and scale its longest axis
    // to a fixed world height so a replacement GLB drops in unchanged.
    const box = new THREE.Box3().setFromObject(phone.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.2 / Math.max(size.x, size.y, size.z);
    phone.scene.scale.setScalar(scale);
    phone.scene.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
    // Re-skin the asset: gunmetal black body everywhere, except the screen
    // face (asset mesh "pCube3_Front_0"), which gets an emissive home-screen
    // wallpaper so it reads as a lit display.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x23262b,
      metalness: 0.85,
      roughness: 0.32,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      emissiveMap: this.makeScreenTexture(),
    });
    phone.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = obj.name === 'pCube3_Front_0' ? screenMat : bodyMat;
      }
    });
    this.phoneModel.add(phone.scene);

    // Comic-book override: white cel-shaded hand with a black ink outline
    // hull per mesh — the palm light still shades the cel bands when it
    // ignites. Outline thickness is in hand-model units (× HAND_SCALE in
    // world), so 0.002 ≈ 0.04 world units of ink.
    const handMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      gradientMap: toonGradient(),
    });
    const handMeshes: THREE.Mesh[] = [];
    hand.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = handMat;
        handMeshes.push(obj);
      }
    });
    handMeshes.forEach((m) => addOutline(m, 0.002));
    this.handModel.add(hand.scene);
  }

  /** Home screen for the phone: violet wallpaper inside a black bezel, a
   *  status bar, a grid of app icons, and a frosted dock. All shapes, no
   *  text — the canvas is drawn vertically flipped (glTF UVs put canvas row
   *  0 at the screen's bottom edge) and mirrored glyphs would show. */
  private makeScreenTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 1024;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.translate(0, c.height);
    g.scale(1, -1); // y = 0 is now the screen's TOP edge

    // Wallpaper inside the bezel; clip so everything stays behind the rim.
    g.beginPath();
    g.roundRect(30, 30, c.width - 60, c.height - 60, 44);
    g.clip();
    const grad = g.createLinearGradient(0, 30, 0, c.height - 30);
    grad.addColorStop(0, '#1a1440');
    grad.addColorStop(0.6, '#2c2260');
    grad.addColorStop(1, '#8b7dff'); // site accent glowing up from the dock
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);

    // Status bar: time pill left, signal dots + battery right.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.roundRect(52, 52, 74, 22, 11);
    g.fill();
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(360 + i * 22, 63, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.roundRect(424, 53, 38, 20, 6);
    g.fill();

    // App icons: 4 × 5 grid of rounded squares with a soft top gloss.
    const colors = [
      '#e05d5d', '#4d9de0', '#3bb273', '#f2c14e',
      '#9b6ee0', '#38c8b8', '#e08b3c', '#e0e4ec',
      '#5d6dbe', '#e07ba0', '#57c785', '#e0c95d',
      '#7a8699', '#66c6e0', '#c96ee0', '#e0a34e',
      '#4dbe8a', '#8f9be0', '#e0655d', '#50b8d8',
    ];
    const icon = 84;
    const margin = 52;
    const gapX = (c.width - margin * 2 - icon * 4) / 3;
    colors.forEach((color, i) => {
      const x = margin + (i % 4) * (icon + gapX);
      const y = 120 + Math.floor(i / 4) * 128;
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(x, y, icon, icon, 22);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.roundRect(x + 8, y + 8, icon - 16, icon * 0.4, 14);
      g.fill();
    });

    // Frosted dock with four anchor apps.
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.roundRect(44, c.height - 176, c.width - 88, 128, 34);
    g.fill();
    ['#e0e4ec', '#4d9de0', '#3bb273', '#e05d5d'].forEach((color, i) => {
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(margin + 14 + i * (icon + gapX), c.height - 154, icon, icon, 22);
      g.fill();
    });

    g.restore();
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

    // Hero exit — the globes slide off (Earth left, moon right) and the
    // stars rise/recede/defocus/fade while the next section (the VR games
    // grid) scrolls into view, so they all belong to the first beat only.
    // Globe positions are derived from globesExit in applyGlobePositions().
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#games', start: 'top bottom', end: 'top center', scrub },
      })
      .to(this, { globesExit: 1 }, 0)
      .to(this.stars.uniforms.uExit, { value: 1 }, 0)
      .to(this.cloudFade, { value: 0 }, 0)
      // Dust takes over from the stars once the hero is left behind (0.3 is
      // its authored resting opacity from the ParticleField config above).
      .to(this.dust.uniforms.uOpacity, { value: 0.3 }, 0);

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
      // crossing — the back of the phone is never shown. Vertical motion is
      // NOT tweened here: update() sets y from trackY(x) so the phone rides
      // the vapor track exactly.
      .fromTo(this.phone.rotation, { y: -0.55 }, { y: 0.45 }, 0)
      .fromTo(this.vapor.uniforms.uReveal, { value: 0 }, { value: 1, duration: 0.22, ease: 'sine.out' }, 0)
      .to(this.vapor.uniforms.uReveal, { value: 0, duration: 0.25, ease: 'sine.in' }, 0.75);

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
    // Liquid cursor for the hero nebula: smooth the pointer into shader uv
    // space (pointer y is screen-down, shader y is up), derive a smoothed
    // velocity from the smoothed position, and clamp swipe spikes.
    const cam = this.ctx.rig.camera;
    this.mouseTarget.set(pointer.x * 0.5 * cam.aspect, -pointer.y * 0.5);
    const px = this.mouse.value.x;
    const py = this.mouse.value.y;
    this.mouse.value.lerp(this.mouseTarget, 1 - Math.exp(-10 * dt));
    if (dt > 0) {
      this.mouseInstVel.set((this.mouse.value.x - px) / dt, (this.mouse.value.y - py) / dt);
      this.mouseVel.value.lerp(this.mouseInstVel, 1 - Math.exp(-4 * dt));
      if (this.mouseVel.value.length() > 1.5) this.mouseVel.value.setLength(1.5);
    }

    this.backdrop.update(elapsed, pointer);
    this.dust.update(elapsed);
    this.stars.update(elapsed);
    this.dust.points.rotation.y = elapsed * 0.015; // slow ambient orbit

    this.applyGlobePositions();
    // Globes turn slowly, alternating direction so they don't read as one
    // rigid backdrop.
    this.globes.forEach((g, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      g.group.rotation.y = elapsed * 0.08 * dir;
      g.group.rotation.x = Math.sin(elapsed * 0.11 + i * 2.1) * 0.15;
    });

    this.vapor.update(elapsed);
    // The phone rides the vapor track: scroll drives x, the curve gives y.
    this.phone.position.y = trackY(this.phone.position.x);

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
