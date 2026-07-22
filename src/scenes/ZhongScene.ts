import gsap from 'gsap';
import * as THREE from 'three';
import { SceneBase } from './SceneBase';
import { ParticleField } from './ParticleField';
import { Backdrop } from './Backdrop';
import { GemStream } from './GemStream';
import { NodeGraph, DESIGN_RADIUS, OUTER_SHELL, NODE_HALF } from './NodeGraph';
import { shaders } from '../shaders';

interface Box {
  left: number;
  /** Top in document space, so scrolling is a plain subtraction. */
  docTop: number;
  width: number;
  height: number;
}

/**
 * An element's box in document space, walked through offsetParent rather than
 * read from getBoundingClientRect — the reveal animations hold their targets
 * under a transform, which a rect would bake in and a layout box ignores.
 */
function docBox(el: HTMLElement): Box {
  let left = 0;
  let docTop = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    docTop += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, docTop, width: el.offsetWidth, height: el.offsetHeight };
}

/** Clear air between the bottom of the parked 学 disc and the panel below it. */
const FOCUS_CLEARANCE = 26;

/**
 * Zhong page: no backdrop shader at all — the page is flat black, lit only by
 * the app's node constellation turning in the hero and two layers of jade
 * motes drifting behind it.
 *
 * The graph is pinned to the `.node-graph` element in the hero: that element
 * keeps the layout slot (and carries a CSS-only copy of the graph as the
 * no-WebGL fallback), and this scene parks the 3D version exactly over it, so
 * one set of responsive rules positions both.
 */
export class ZhongScene extends SceneBase {
  private far!: ParticleField;
  private near!: ParticleField;
  private graph!: NodeGraph;
  /** Per-section flourishes, each faded in only while its section is on screen. */
  private gems!: GemStream;
  private grid!: Backdrop;
  private water!: Backdrop;
  private gridOpacity = { value: 0 };
  private waterOpacity = { value: 0 };
  private slot: HTMLElement | null = document.querySelector('.node-graph');
  /** The 学 panel in the explorer section — the graph's second anchor. */
  private card: HTMLElement | null = document.querySelector('#explorer .zhong-card');
  private slotBox: Box = { left: 0, docTop: 0, width: 0, height: 0 };
  private cardBox: Box = { left: 0, docTop: 0, width: 0, height: 0 };
  /** Explorer-section pose, solved in measure(): how far 学 sits from the
   *  graph's centre on screen, and which way it has to point to get there. */
  private focusRadiusPx = 0;
  private focusDir = new THREE.Vector3(0, 1, 0);
  /**
   * Scrubbed by GSAP: `focus` 0 → 1 as the explorer section arrives, `fade`
   * 1 → 0 as the page leaves it behind.
   */
  private view = { focus: 0, fade: 1, gems: 0 };
  private spinSpeed = 1;

  init(): void {
    // Far layer: dense, small, dim — reads as depth rather than as objects.
    this.far = new ParticleField({
      count: Math.round(520 * this.ctx.quality.density),
      color: 0x1e9b6e, // character-node jade
      size: 0.055,
      opacity: 0.4,
      sway: 0.22,
      rise: 0.1,
      parallax: 1.1,
      bounds: { x: 12, y: 8, zNear: -3, zFar: -11 },
    });
    this.scene.add(this.far.points);

    // Near layer: fewer, larger, brighter — the motes you actually notice.
    this.near = new ParticleField({
      count: Math.round(150 * this.ctx.quality.density),
      color: 0x5eecc8, // connector-line jade
      size: 0.12,
      opacity: 0.55,
      sway: 0.5,
      rise: 0.18,
      parallax: 3.2,
      bounds: { x: 9, y: 6, zNear: 5, zFar: -2 },
    });
    this.scene.add(this.near.points);

    // Reward gems streaming up across the middle of the page.
    const narrow = window.innerWidth < 640;
    this.gems = new GemStream(
      Math.max(7, Math.round((narrow ? 12 : 20) * this.ctx.quality.density)),
      narrow ? 0.5 : 1,
    );
    this.scene.add(this.gems.group);

    // Grid matrix behind the corpus figures.
    this.grid = new Backdrop(
      shaders.gridFrag,
      { a: 0x1e9b6e, b: 0x88ecc4, c: 0x5eecc8 },
      { uOpacity: this.gridOpacity },
      { transparent: true },
    );
    this.grid.mesh.visible = false;
    this.scene.add(this.grid.mesh);

    // Cel-shaded jade water rising along the bottom of the platforms section.
    // Normal blending, not additive — flat drawn tones need to sit on the page,
    // and additive washed the overlapping bands out to white.
    this.water = new Backdrop(
      shaders.jadeWaterFrag,
      { a: 0x0e6b4e, b: 0x2fb488, c: 0x9df5d4 },
      { uOpacity: this.waterOpacity },
      { transparent: true },
    );
    this.water.mesh.visible = false;
    this.scene.add(this.water.mesh);

    this.spinSpeed = this.ctx.quality.reducedMotion ? 0 : 1;
    this.graph = new NodeGraph();
    this.scene.add(this.graph.group);
    this.measure();
    // Textures need the CJK webfont, so the graph arrives a beat late; the CSS
    // fallback holds the slot until it does and is then swapped out.
    void this.graph.build().then(() => {
      this.measure();
      document.body.classList.add('zhong-graph-3d');
    });
    // Late webfonts reflow the hero copy, which moves the slot under it.
    window.addEventListener('load', () => this.measure());

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
    // Only the motes ride the camera — the graph is pinned to its DOM slot and
    // stays put relative to the page while they parallax past it.
    tl.to(this.ctx.rig.position, { y: -0.8, z: 7.4 }, 0)
      .to(this.far.uniforms.uScroll, { value: 1 }, 0)
      .to(this.near.uniforms.uScroll, { value: 1 }, 0);

    // Arriving at the explorer section, the constellation swells and swings 学
    // over that section's panel. Both the move and the re-orientation read off
    // this one scrubbed value.
    if (this.card) {
      gsap.to(this.view, {
        focus: 1,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: '#explorer',
          start: 'top bottom',
          end: 'top 38%',
          scrub: this.ctx.scrub,
        },
      });
      // …and retires once the quiz section takes over, so an expanded
      // constellation never ends up drifting behind that section's copy.
      gsap.to(this.view, {
        fade: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#quizzes',
          start: 'top 92%',
          end: 'top 55%',
          scrub: this.ctx.scrub,
        },
      });
    }

    // The gems span far more than their own section: they start rising halfway
    // down the explorer, are fully up before the quizzes arrive, hold through
    // them, and only finish draining away halfway down the corpus. Hence the
    // explicit ranges rather than whileVisible's section-shaped window.
    gsap.fromTo(
      this.view,
      { gems: 0 },
      {
        gems: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '#explorer',
          start: 'center center',
          end: 'bottom 55%',
          scrub: this.ctx.scrub,
        },
      },
    );
    gsap.to(this.view, {
      gems: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#corpus',
        start: 'top 60%',
        end: 'center center',
        scrub: this.ctx.scrub,
      },
    });

    this.whileVisible('#corpus', this.gridOpacity, 'value');
    this.whileVisible('#platforms', this.waterOpacity, 'value');
  }

  /**
   * Ramp `target[key]` up as a section arrives and back down as it leaves, so
   * each flourish only costs anything while its own section is on screen.
   *
   * The windows are deliberately generous: the effect is fully up well before
   * the section is centred and does not start leaving until its bottom edge is
   * near the top of the screen. Tighter windows made it wink out while the
   * section was still being read, and — because scrubbing runs the same ranges
   * in reverse — arrive late when scrolling back up into it.
   */
  private whileVisible<T extends object>(selector: string, target: T, key: keyof T): void {
    const el = document.querySelector(selector);
    if (!el) return;
    const scrub = this.ctx.scrub;
    gsap.fromTo(
      target,
      { [key]: 0 },
      {
        [key]: 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 55%', scrub },
      },
    );
    gsap.to(target, {
      [key]: 0,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'bottom 42%', end: 'bottom top', scrub },
    });
  }

  update(dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    this.far.update(elapsed);
    this.near.update(elapsed);
    this.graph.update(elapsed, this.spinSpeed, this.view.focus, this.focusDir);
    this.graph.setOpacity(this.view.fade);
    this.placeGraph();

    this.gems.setOpacity(this.view.gems);
    this.gems.update(dt, elapsed, this.spinSpeed);
    this.grid.mesh.visible = this.gridOpacity.value > 0.004;
    this.water.mesh.visible = this.waterOpacity.value > 0.004;
    if (this.grid.mesh.visible) this.grid.update(elapsed, pointer);
    if (this.water.mesh.visible) this.water.update(elapsed, pointer);
  }

  resize(width: number, height: number): void {
    this.graph.resize(width, height);
    this.grid.resize(width, height);
    this.water.resize(width, height);
    this.measure();
  }

  /**
   * Cache both anchors' layout boxes, then solve the explorer-section pose.
   *
   * The graph never moves off the hero slot, so reaching 学 down to the panel
   * is purely a question of how big the sphere grows and which way that node
   * points. Both boxes are in document space and the graph scrolls with them,
   * so their separation is scroll-invariant: solving once here holds for the
   * whole transition.
   *
   * Keeping the target direction in the z = 0 plane — the plane the group's
   * centre already sits on — means the node's projected offset is exactly the
   * sphere's radius, with no perspective term to correct for. So the radius
   * simply *is* the distance to the target, and the direction is the unit
   * vector pointing at it.
   */
  private measure(): void {
    if (this.slot) this.slotBox = docBox(this.slot);
    if (this.card) this.cardBox = docBox(this.card);
    if (!this.slotBox.width || !this.cardBox.width) return;

    const cx = this.slotBox.left + this.slotBox.width / 2;
    const cy = this.slotBox.docTop + this.slotBox.height / 2;
    const dx = this.cardBox.left + this.cardBox.width / 2 - cx;

    // The disc scales with the sphere, so the gap it needs depends on the very
    // radius being solved for. Two passes is plenty — the gap moves the target
    // by ~100px against a ~500px drop, so the second pass is already stable.
    let gap = 60;
    let radius = 1;
    for (let pass = 0; pass < 2; pass++) {
      radius = Math.hypot(dx, cy - (this.cardBox.docTop - gap)) || 1;
      gap = NODE_HALF * radius + FOCUS_CLEARANCE;
    }
    this.focusRadiusPx = radius;
    // document y grows downward, world y upward
    this.focusDir.set(dx / radius, (cy - (this.cardBox.docTop - gap)) / radius, 0).normalize();
  }

  /**
   * Park the constellation between its two anchors. Both poses are expressed
   * as a centre and a radius in CSS pixels — the radius being where the
   * outermost shell lands — which are then converted to world units at the
   * graph's depth. Driven off the rig's base pose rather than the live camera,
   * so pointer sway still parallaxes the graph a little.
   *
   * The centre never leaves the hero slot; only the radius changes. Growing it
   * to `focusRadiusPx` is what carries 学 — swung onto `focusDir` by
   * `NodeGraph.update` — down to the gap above the definition panel.
   */
  private placeGraph(): void {
    if (!this.slot || this.slotBox.width === 0) return;
    const cam = this.ctx.rig.camera;
    const base = this.ctx.rig.position;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const worldH = 2 * Math.tan((cam.fov / 2) * THREE.MathUtils.DEG2RAD) * base.z;
    const worldW = worldH * cam.aspect;
    const scrollY = window.scrollY;

    // The hero slot is sized for the whole silhouette; convert that to the
    // outer shell's radius so both poses speak the same measurement.
    let radius = (this.slotBox.width / 2) * (OUTER_SHELL / DESIGN_RADIUS);
    const x = this.slotBox.left + this.slotBox.width / 2;
    const y = this.slotBox.docTop - scrollY + this.slotBox.height / 2;

    const t = this.view.focus;
    if (t > 0 && this.focusRadiusPx > 0) radius += (this.focusRadiusPx - radius) * t;

    this.graph.group.position.set(
      base.x + (x / vw - 0.5) * worldW,
      base.y - (y / vh - 0.5) * worldH,
      0,
    );
    this.graph.group.scale.setScalar((radius * (worldW / vw)) / OUTER_SHELL);
  }

  dispose(): void {
    this.graph.dispose();
    this.gems.dispose();
    super.dispose();
  }
}
