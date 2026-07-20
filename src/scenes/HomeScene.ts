import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { StarField } from './StarField';
import { VaporTrack, trackY } from './VaporTrack';
import { toonGradient, addOutline } from './toon';
import { LotusFlower, GLOW_TINT_BASE, GLOW_TINT_BLUE } from './LotusFlower';
import { buildHeadset } from './HeadsetModel';
import { InkGlobe, AURA_SCALE } from './InkGlobe';
import { shaders } from '../shaders';

/**
 * Studio landing page — four scroll beats over a paper-white field with a
 * slowly turning black-and-white moon globe floating right:
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

// The moon belongs to the hero beat only. It hangs small at MOON_X right,
// then on the hero exit it zooms in (scale tween) and finally rises off the
// top of the frame, aura included.
const MOON_RADIUS = 1.15;
const MOON_X = 4.2;
const MOON_Y = 1.35;
/** The exit drifts the moon to top-center, not straight up. */
const MOON_EXIT_X = 0;
const MOON_Z = -1;
/** The moon rests small and swells to full size as the hero exits. */
const MOON_SCALE_START = 0.55;
const MOON_SCALE_END = 1.5;
/** Extra exit clearance for the pointer sway: the rig shifts up to ±0.5 and
 *  its lookAt compensation rotates the frustum, moving the edge ~1 world
 *  unit at the globes' depth. */
const SWAY_MARGIN = 1.2;

// Depth planes for the model beats (camera sits at z = 9 looking at origin).
const PHONE_Z = 4;
/** Where the phone's ride ends: parked right of center, screen turned a
 *  touch to the viewer's left. */
const PHONE_REST_X = 1.2;
const PHONE_REST_Y = 0;
const PHONE_REST_ROT = -0.35;
const HAND_Z = 0.5;
/** Beat 2 stage: the VR headset lands on a surface right of the copy. */
const HEADSET_Z = -2.5;
/** Parked above the frustum (half-height ≈ 4.4 at HEADSET_Z, plus the
 *  model's own half-size and camera sway). */
const HEADSET_HIDDEN_Y = 8;
/** Where the headset stands: x right of the copy, resting so its base
 *  touches the surface line. */
const HEADSET_X = 1.9;
const HEADSET_REST_Y = -1.05;
const SURFACE_Y = -2.05;
/** Yaw that turns the headset body slightly to the viewer's right while
 *  the wearer side (local -z on the built model, where the lenses live)
 *  faces the camera near-on — frontal enough that the back-strap connector
 *  parallaxes into the gap between the lenses instead of onto one:
 *  opening normal = (-sinθ, 0, -cosθ) ≈ (-0.29, 0, 0.96). */
const HEADSET_REST_ROT = Math.PI - 0.29;
/** Moonbeam cone: from the moon down onto the landed headset. Silver-white,
 *  matching the moon's halo. */
const BEAM_HEIGHT = 8.5;
const BEAM_SILVER = new THREE.Vector3(0.91, 0.93, 0.96);
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
const UP = new THREE.Vector3(0, 1, 0);
const HAND_SCALE = 21;
/** Where the lotus sits relative to the hand wrapper (roughly the palm).
 *  Scales with HAND_SCALE — the palm's wrapper-space position moves linearly
 *  with the model scale, so double the hand means double this offset.
 *  y holds the lotus at its pre-raise height: when HAND_RAISED_Y moved up
 *  0.3 (-0.2 → 0.1), this dropped 0.3 to compensate (0.14 → -0.16). */
const PALM_OFFSET = new THREE.Vector3(0, -0.16, 1.5);
/** Lean the bloom toward the camera so its glowing heart reads, not just
 *  the petal rim (camera sits above and in front of the flower). */
const LOTUS_TILT = 1.05;

export class HomeScene extends SceneBase {
  private backdrop!: Backdrop;
  private dust!: ParticleField;
  private stars!: StarField;
  private vapor!: VaporTrack;
  private lotus!: LotusFlower;
  /** Hero globes — just the moon today, keep the list for future additions.
   *  Empty until their textures finish loading in loadModels(). */
  private globes: InkGlobe[] = [];
  /** The right-side moon (also in globes); null until loaded. */
  private moon: InkGlobe | null = null;
  /** 0 = moon at its hero spot, 1 = fully risen off the top. Tweened by
   *  scroll; positions are applied from it every frame. */
  private globesExit = 0;
  /** Scroll-tweened moon scale (the hero-exit "zoom in"). */
  private moonScale = MOON_SCALE_START;
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
  /** 0 = phone rides trackY exactly, 1 = parked at PHONE_REST_Y. Tweened at
   *  the end of the crossing so it eases off the track as it stops. */
  private phoneRest = 0;
  /** Extra y on top of the track/rest blend: starts positive so the phone
   *  enters from the top-right corner, drops to 0 while it settles, and
   *  rises again after the pin so the phone scrolls up with the text. */
  private phoneLift = 2.5;
  private hand = new THREE.Group();
  private handModel = new THREE.Group();
  /** Hand material — its emissive gets the lotus's blue wash in update(). */
  private handMat: THREE.MeshToonMaterial | null = null;
  private headset = new THREE.Group();
  private headsetModel = new THREE.Group();
  /** Moonbeam: a cone anchored to the moon that grows toward the landing
   *  spot (beamGrow 0 → 1, scroll-tweened from the first scroll tick), plus
   *  light pool + surface line faded via beamFade; the spotlight does the
   *  actual lighting. Re-aimed every frame in update() so it tracks the
   *  zooming, rising moon. */
  private beam!: THREE.Mesh;
  private beamGrow = 0;
  private beamFade: THREE.IUniform<number> = { value: 0 };
  private beamTarget = new THREE.Vector3(HEADSET_X, SURFACE_Y, HEADSET_Z);
  private beamStart = new THREE.Vector3();
  private beamTip = new THREE.Vector3();
  private beamDir = new THREE.Vector3();
  private beamSpot!: THREE.SpotLight;
  private poolMaterial!: THREE.MeshBasicMaterial;
  /** Grass patch under the headset: base disc + instanced blades, faded
   *  together with the landing tableau. */
  private grassMaterials: THREE.Material[] = [];
  /** Time uniform driving the blades' sway (injected via onBeforeCompile). */
  private grassSway: THREE.IUniform<number> = { value: 0 };

  init(): void {
    this.backdrop = new Backdrop(
      shaders.paperFrag,
      {
        a: 0x2a3038, // gunmetal page field
        b: 0x39414c, // faint lighter corner wash
        c: 0x111114, // unused
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
      color: 0xaab3c4, // pale motes read on the gunmetal field
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

    // --- beat 2: VR headset stage (parked above until the games beat) -------
    // Anchor x compresses on narrow screens so the whole tableau stays
    // in frame; sizes get the init-time mobile trim.
    const anchorX = HEADSET_X * this.posScale();
    const sz = this.sizeScale();
    this.headset.position.set(anchorX, HEADSET_HIDDEN_Y, HEADSET_Z);
    this.headset.rotation.y = HEADSET_REST_ROT;
    this.headset.add(this.headsetModel);
    this.scene.add(this.headset);

    // Moonbeam: an open cone whose narrow end sits inside the moon and whose
    // wide end reaches the landing spot as beamGrow runs 0 → 1. View-angle
    // fade softens the silhouette edges; alpha grows toward the moon end so
    // it reads as light pouring out of it.
    const beamGeo = new THREE.CylinderGeometry(0.6, 1.9, BEAM_HEIGHT, 32, 1, true);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uFade: this.beamFade, uColor: { value: BEAM_SILVER } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDot;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vDot = abs(dot(n, normalize(-mvPos.xyz)));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vDot;
        void main() {
          float core = smoothstep(0.1, 0.75, vDot);
          // Brightest at the moon end, dimming down the beam, with the far
          // tip faded fully out so the cone's open rim never draws a hard
          // ellipse while the beam is still growing.
          float fall = mix(0.2, 1.0, vUv.y) * smoothstep(0.0, 0.18, vUv.y);
          gl_FragColor = vec4(uColor, core * fall * 0.32 * uFade);
        }
      `,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.visible = false; // positioned/aimed per-frame in update()
    this.scene.add(this.beam);

    // Where the beam meets the surface: a soft silver pool (billboard
    // ellipse) over the surface itself — a black circular plate the headset
    // rests on, a squat cylinder so the near-edge-on camera still sees a
    // disc silhouette rather than a hairline.
    this.poolMaterial = new THREE.MeshBasicMaterial({
      color: 0xdde5f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6 * sz, 40), this.poolMaterial);
    pool.scale.y = 0.22;
    pool.position.set(anchorX, SURFACE_Y, HEADSET_Z - 0.2);
    this.scene.add(pool);
    // The headset lands on a circular patch of 3D grass (Touch Grass,
    // after all): a green toon base disc with a few hundred instanced
    // triangular blades in varied greens standing inside its rim.
    // Unlit flat colors — the beam spotlight overexposes lit materials at
    // this range, and flat greens suit the comic look anyway.
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0x2c8a3e,
      transparent: true,
      opacity: 0,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.9 * sz, 2.9 * sz, 0.14, 48), baseMat);
    base.position.set(anchorX, SURFACE_Y - 0.07, HEADSET_Z);
    this.scene.add(base);

    // One tapered triangle per blade, instanced; per-instance color picks
    // from a small palette of meadow greens.
    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.04, 0, 0, 0.04, 0, 0, 0, 1, 0], 3),
    );
    bladeGeo.computeVertexNormals();
    const bladeMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    // Gentle sway: bend each blade's tip (displacement ∝ local y) with a
    // per-instance phase from its planted position, before the instance
    // matrix is applied so every blade waves about its own root.
    bladeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSway = this.grassSway;
      shader.vertexShader = `uniform float uSway;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
          float swayPh = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;
          transformed.x += sin(uSway * 1.5 + swayPh) * 0.06 * position.y;
          transformed.z += cos(uSway * 1.05 + swayPh * 1.3) * 0.03 * position.y;
        #endif
        `,
      )}`;
    };
    const GRASS_COUNT = 975;
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, GRASS_COUNT);
    grass.frustumCulled = false; // instance transforms live outside the geometry bounds
    const dummy = new THREE.Object3D();
    const greens = [
      new THREE.Color(0x53c437),
      new THREE.Color(0x3fae2a),
      new THREE.Color(0x74d94e),
      new THREE.Color(0x2f9130),
      new THREE.Color(0x8ce063),
    ];
    for (let i = 0; i < GRASS_COUNT; i++) {
      const r = 2.8 * sz * Math.sqrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      dummy.position.set(
        anchorX + Math.cos(th) * r,
        SURFACE_Y,
        HEADSET_Z + Math.sin(th) * r,
      );
      // Blades face the camera (the geometry plane is XY, camera looks down
      // -z) with only a little yaw jitter, so none turn edge-on and vanish
      // into hairlines.
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.3,
      );
      dummy.scale.set(0.8 + Math.random() * 0.8, 0.26 + Math.random() * 0.34, 1);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      grass.setColorAt(i, greens[Math.floor(Math.random() * greens.length)]);
    }
    this.scene.add(grass);
    this.grassMaterials = [baseMat, bladeMat];

    // The light that actually illuminates the headset from above.
    this.beamSpot = new THREE.SpotLight(0xeef2fa, 0, 0, 0.6, 0.7, 1.4);
    this.beamSpot.position.set(anchorX, 7, HEADSET_Z + 0.6);
    this.beamSpot.target = this.headset;
    this.scene.add(this.beamSpot);

    // --- beat 3: the crossing model (starts parked off-screen right) --------
    this.phone.position.set(this.offscreenX(), -0.35, PHONE_Z);
    this.phone.add(this.phoneModel);
    this.scene.add(this.phone);

    // The ethereal track the phone rides: vapory lines + motes braided along
    // the same trackY curve that steers the phone's y in update(). Center
    // plane sits well behind PHONE_Z so even with the ±1 z jitter every
    // line stays behind the phone.
    this.vapor = new VaporTrack({ halfWidth: 9, z: PHONE_Z - 1.6 });
    this.scene.add(this.vapor.group);

    // --- beat 4: hand + lotus (starts parked below the frustum) -------------
    this.hand.position.set(0, HAND_HIDDEN_Y, HAND_Z);
    this.handModel.rotation.copy(HAND_ROTATION);
    this.handModel.scale.setScalar(HAND_SCALE * sz);
    this.hand.add(this.handModel);
    this.lotus = new LotusFlower();
    this.lotus.group.position.copy(PALM_OFFSET).multiplyScalar(sz);
    this.lotus.group.rotation.x = LOTUS_TILT;
    this.lotus.group.scale.setScalar(1.4 * sz); // 1.08 + another 30%
    this.hand.add(this.lotus.group);
    this.scene.add(this.hand);

    void this.loadModels();

    this.ctx.rig.position.set(0, 0.4, 9);
    this.ctx.rig.lookAt.set(0, 0, 0);
  }

  /** Horizontal layout compression for narrow screens: 1 at the design
   *  aspect (16:10), shrinking proportionally on phones so side-anchored
   *  models stay inside the frame. Re-read per frame where possible so
   *  desktop window resizes track live. */
  private posScale(): number {
    return Math.min(1, this.ctx.rig.camera.aspect / 1.6);
  }

  /** Model size trim for narrow screens (applied once at init — a mobile
   *  orientation change reloads layout via ScrollTrigger refresh, but baked
   *  geometry keeps this scale). */
  private sizeScale(): number {
    return THREE.MathUtils.clamp(this.ctx.rig.camera.aspect / 1.6, 0.55, 1);
  }

  /** Frustum half-width at depth z (the camera looks down -z from the rig). */
  private halfWidthAt(z: number): number {
    const cam = this.ctx.rig.camera;
    const dist = this.ctx.rig.position.z - z;
    return Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist * cam.aspect;
  }

  /**
   * y that clears the top frustum edge at the moon's depth for the given
   * zoom scale, aura included, plus the sway margin. Camera-dependent, so
   * callers re-evaluate per frame rather than caching.
   */
  private moonExitY(scale: number): number {
    const cam = this.ctx.rig.camera;
    const dist = this.ctx.rig.position.z - MOON_Z;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist;
    const rigPos = this.ctx.rig.position;
    const look = this.ctx.rig.lookAt;
    const midY = rigPos.y + (look.y - rigPos.y) * (dist / (rigPos.z - look.z));
    const slope = halfH / dist;
    const r = MOON_RADIUS * scale * AURA_SCALE;
    return midY + halfH + r * Math.sqrt(1 + slope * slope) + SWAY_MARGIN;
  }

  /**
   * Place the moon for the current camera and hero-exit progress. At
   * globesExit = 0 it rests at MOON_Y (scale from moonScale); at 1 it has
   * risen past the top edge, aura included. Frame-rate applied (not cached)
   * so resizes and the scroll tweens compose without re-plumbing.
   */
  private applyGlobePositions(): void {
    if (this.moon) {
      this.moon.group.scale.setScalar(this.moonScale);
      const exitY = this.moonExitY(this.moonScale);
      const restX = MOON_X * this.posScale();
      this.moon.group.position.x = restX + (MOON_EXIT_X - restX) * this.globesExit;
      this.moon.group.position.y = MOON_Y + (exitY - MOON_Y) * this.globesExit;
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
    const { phone, hand, moonMap, lensMap } = await this.ctx.assets.loadAll({
      phone: { url: '/models/phone.glb', type: 'gltf' },
      hand: { url: '/models/hand.glb', type: 'gltf' },
      moonMap: { url: '/textures/moon_1024.jpg', type: 'texture' },
      lensMap: { url: '/textures/tgs1_1024.jpg', type: 'texture' },
    });

    // Moon floating right of the hero copy, in natural grayscale (bright
    // moon) with a faint silver-white halo against the night sky.
    const moonInk = InkGlobe.toInk(moonMap, false);
    moonMap.dispose();
    const moon = new InkGlobe(MOON_RADIUS, moonInk, {
      segments: [32, 22],
      auraColor: 0xe8edf5,
      auraOpacity: 0.3,
    });
    moon.group.position.set(MOON_X, MOON_Y, MOON_Z);
    moon.group.scale.setScalar(this.moonScale);
    this.globes = [moon];
    this.moon = moon;
    this.applyGlobePositions();
    for (const g of this.globes) this.scene.add(g.group);

    // Normalize authored units: center the model and scale its longest axis
    // to a fixed world height so a replacement GLB drops in unchanged.
    const box = new THREE.Box3().setFromObject(phone.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = (2.2 * this.sizeScale()) / Math.max(size.x, size.y, size.z);
    phone.scene.scale.setScalar(scale);
    phone.scene.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
    // Re-skin the asset: gunmetal gray everywhere, screen face included.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x23262b,
      metalness: 0.85,
      roughness: 0.32,
    });
    phone.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.material = bodyMat;
    });
    this.phoneModel.add(phone.scene);

    // Comic-book override: white cel-shaded hand with a black ink outline
    // hull per mesh — the palm light still shades the cel bands when it
    // ignites. Outline thickness is in hand-model units (× HAND_SCALE in
    // world), so 0.002 ≈ 0.04 world units of ink.
    const handMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      gradientMap: toonGradient(),
      // Neutral emissive lift so the hand reads bright white instead of
      // taking the scene's violet rim light as a lavender tint — kept low
      // enough that the cel bands still shade the form.
      emissive: 0x48484c,
    });
    this.handMat = handMat;
    const handMeshes: THREE.Mesh[] = [];
    hand.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = handMat;
        handMeshes.push(obj);
      }
    });
    handMeshes.forEach((m) => addOutline(m, 0.002));
    this.handModel.add(hand.scene);

    // Beat 2: procedurally built headset (see HeadsetModel.ts — no
    // third-party asset, no license). Normalized like the phone:
    // recentered, longest axis to a fixed world size.
    const builtHeadset = buildHeadset(lensMap);
    const vrBox = new THREE.Box3().setFromObject(builtHeadset);
    const vrSize = vrBox.getSize(new THREE.Vector3());
    const vrScale = (4.4 * this.sizeScale()) / Math.max(vrSize.x, vrSize.y, vrSize.z);
    builtHeadset.scale.setScalar(vrScale);
    builtHeadset.position.copy(vrBox.getCenter(new THREE.Vector3())).multiplyScalar(-vrScale);
    this.headsetModel.add(builtHeadset);
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

    // Hero exit — the moon zooms in first, then rises off the top of the
    // frame; meanwhile the night sky and its clouds cross-fade to paper
    // white and the stars rise/recede/defocus/fade, so they all belong to
    // the first beat only. Moon position/scale are derived from moonScale +
    // globesExit in applyGlobePositions(). Ends at 'top 60%' so the sky is
    // fully white before the games copy (dark text) settles into view.
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#games', start: 'top bottom', end: 'top 60%', scrub },
      })
      // Zoom and rise run together across the whole exit — the moon swells
      // as it climbs, clearing the top edge right at the end. The beam
      // waits for it (it starts in the games pin timeline below).
      .to(this, { moonScale: MOON_SCALE_END, duration: 1, ease: 'sine.inOut' }, 0)
      .to(this, { globesExit: 1, duration: 1, ease: 'sine.inOut' }, 0)
      .to(this.stars.uniforms.uExit, { value: 1, duration: 1 }, 0)
      .to(this.cloudFade, { value: 0, duration: 1 }, 0)
      // Dust takes over from the stars once the hero is left behind (0.3 is
      // its authored resting opacity from the ParticleField config above).
      .to(this.dust.uniforms.uOpacity, { value: 0.3, duration: 1 }, 0);

    // Beat 2 — with the moon gone, its beam extends down into frame first;
    // then the headset descends through it and lands on the plate with its
    // lens turned to the viewer's right. Everything lifts away again over
    // the pin's last stretch.
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#games', start: 'top top', end: 'bottom bottom', scrub },
      })
      // The beam appears only now — after the moon has left the screen —
      // already on its final line, growing to fit.
      .to(this.beamFade, { value: 1, duration: 0.06, ease: 'sine.out' }, 0)
      .to(this, { beamGrow: 1, duration: 0.24, ease: 'sine.out' }, 0.02)
      .fromTo(
        this.headset.position,
        { y: HEADSET_HIDDEN_Y },
        { y: HEADSET_REST_Y, duration: 0.32, ease: 'power2.out' },
        0.24,
      )
      // A half-turn of settle during the drop, ending lens-right.
      .fromTo(
        this.headset.rotation,
        { y: HEADSET_REST_ROT + 2.2 },
        { y: HEADSET_REST_ROT, duration: 0.34, ease: 'power2.out' },
        0.24,
      )
      // Grass patch first, then pool + the actual light as the headset lands.
      .to(this.grassMaterials, { opacity: 1, duration: 0.16, ease: 'sine.out' }, 0.42)
      .to(this.poolMaterial, { opacity: 0.22, duration: 0.16, ease: 'sine.out' }, 0.5)
      .to(this.beamSpot, { intensity: 750, duration: 0.16, ease: 'sine.out' }, 0.5)
      // Hold the tableau, then strike the whole set before the showcase beat.
      .to(this.beamFade, { value: 0, duration: 0.14, ease: 'sine.in' }, 0.8)
      .to(this.poolMaterial, { opacity: 0, duration: 0.14, ease: 'sine.in' }, 0.8)
      .to(this.grassMaterials, { opacity: 0, duration: 0.14, ease: 'sine.in' }, 0.8)
      .to(this.beamSpot, { intensity: 0, duration: 0.14, ease: 'sine.in' }, 0.8)
      .to(this.headset.position, { y: HEADSET_HIDDEN_Y, duration: 0.16, ease: 'power2.in' }, 0.82);

    // Beat 3 — phone drops in from the top-right corner, joins the vapor
    // track, and pulls up at middle-right with the screen turned slightly
    // to the viewer's left. phoneRest eases it off the track's diagonal
    // onto its resting height; phoneLift carries the corner entry.
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
      .fromTo(
        this.phone.position,
        { x: () => this.offscreenX() },
        { x: () => PHONE_REST_X * this.posScale(), duration: 0.85, ease: 'sine.out' },
        0,
      )
      .fromTo(this, { phoneLift: 2.5 }, { phoneLift: 0, duration: 0.4, ease: 'sine.out' }, 0)
      // Sweep stays well under ±90° so the screen faces the viewer the whole
      // ride — the back of the phone is never shown. Vertical motion is NOT
      // tweened here: update() blends trackY(x) toward PHONE_REST_Y.
      .fromTo(
        this.phone.rotation,
        { y: -0.7 },
        { y: PHONE_REST_ROT, duration: 0.85, ease: 'sine.out' },
        0,
      )
      .to(this, { phoneRest: 1, duration: 0.35, ease: 'sine.inOut' }, 0.5)
      .fromTo(this.vapor.uniforms.uReveal, { value: 0 }, { value: 1, duration: 0.22, ease: 'sine.out' }, 0)
      .to(this.vapor.uniforms.uReveal, { value: 0, duration: 0.25, ease: 'sine.in' }, 0.75);

    // After the pin releases, the resting phone rides up at scroll speed so
    // it leaves the frame together with the section's text (full frustum
    // height at PHONE_Z ≈ 3.84 world units per viewport of scroll).
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#model-showcase',
          start: 'bottom bottom',
          end: 'bottom top',
          scrub,
        },
      })
      .to(this, { phoneLift: 4 });

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

    // The moonbeam lies on its final line from the first frame — origin at
    // the moon's exit spot above the frame, aimed at the landing target —
    // and beamGrow only extends it along that line. No pivoting: one
    // continuous shaft from the hero beat into the games beat.
    if (this.beamGrow > 0.002) {
      const startY = this.moonExitY(MOON_SCALE_END);
      this.beamStart.set(MOON_EXIT_X, startY, MOON_Z);
      this.beamTarget.setX(HEADSET_X * this.posScale());
      this.beamTip
        .copy(this.beamTarget)
        .sub(this.beamStart)
        .multiplyScalar(this.beamGrow)
        .add(this.beamStart);
      this.beamDir.copy(this.beamStart).sub(this.beamTip);
      const len = Math.max(this.beamDir.length(), 0.001);
      this.beam.visible = true;
      this.beam.position.copy(this.beamStart).add(this.beamTip).multiplyScalar(0.5);
      this.beam.quaternion.setFromUnitVectors(UP, this.beamDir.normalize());
      this.beam.scale.y = len / BEAM_HEIGHT;
    } else {
      this.beam.visible = false;
    }

    this.vapor.update(elapsed);
    // The phone rides the vapor track — scroll drives x, the curve gives y —
    // easing onto its flat resting height as phoneRest goes 0 → 1, plus the
    // entry/exit lift.
    const onTrack = trackY(this.phone.position.x);
    this.phone.position.y =
      onTrack + (PHONE_REST_Y - onTrack) * this.phoneRest + this.phoneLift;

    // Idle life on the inner nodes (scroll owns the wrappers).
    this.phoneModel.position.y = Math.sin(elapsed * 0.9) * 0.08;
    this.phoneModel.rotation.z = Math.sin(elapsed * 0.6) * 0.06;
    // Whisper of life only — the headset "sits" on its surface, so no bob.
    this.headsetModel.rotation.z = Math.sin(elapsed * 0.45) * 0.015;
    this.grassSway.value = elapsed;
    this.handModel.position.y = Math.sin(elapsed * 0.7) * 0.05;
    this.lotus.update(elapsed);
    // The palm light's blue wash reaches the hand too (a bit weaker than
    // the petals — the light sits above the palm).
    if (this.handMat) {
      const glow = THREE.MathUtils.clamp(this.lotus.glow, 0, 1);
      this.handMat.color.copy(GLOW_TINT_BASE).lerp(GLOW_TINT_BLUE, glow * 0.65);
    }
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
