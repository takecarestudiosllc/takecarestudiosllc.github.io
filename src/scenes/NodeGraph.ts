import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * The Zhong app's node explorer, rebuilt for the marketing hero.
 *
 * Everything below is kept in the app's own unit system (orbit shell at 104,
 * discs drawn on a 256px canvas) so the proportions — disc size against orbit
 * radius, rim weight against disc — come across unchanged; the whole group is
 * then scaled once to fit its slot on the page. Discs are billboarded sprites,
 * exactly as in the app, which is what keeps the hanzi upright while the
 * constellation turns.
 */

type Role = 'center' | 'word' | 'char' | 'radical';

/** Node-role colours, straight from the app's palette table. */
const ROLE_COLOR: Record<Role, [number, number, number]> = {
  center: [30, 155, 110], // character nodes
  char: [30, 155, 110],
  word: [212, 163, 115],
  radical: [240, 200, 150],
};

/** Shell radii, as the app lays them out (radicals nudged out a little — the
 *  hero has no orbit controls to pull the centre apart with). */
const RAD_SHELL = 72;
const ORB_SHELL = 104;
export const OUTER_SHELL = ORB_SHELL + 46;
/** Half-extent of the whole constellation: outermost node plus its disc. */
export const DESIGN_RADIUS = OUTER_SHELL + 19;

const CJK_FONT =
  "'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC', 'Hiragino Sans GB', sans-serif";

/** 中 and its real neighbours, as the app's data files give them. */
const WORDS: { word: string; other: string }[] = [
  { word: '中国', other: '国' },
  { word: '中心', other: '心' },
  { word: '中文', other: '文' },
  { word: '中午', other: '午' },
  { word: '中学', other: '学' },
  { word: '集中', other: '集' },
  { word: '其中', other: '其' },
  { word: '高中', other: '高' },
];
const RADICALS = ['丨', '口'];
/** The node the page focuses on in the explorer section — 学, from 中学. */
const FOCUS_INDEX = WORDS.findIndex((w) => w.other === '学');
/** Half the focus node's rendered disc, as a fraction of the outer shell. */
export const NODE_HALF = 19 / OUTER_SHELL;

/**
 * Evenly spread `count` directions over a sphere (the app's own layout for its
 * shells). The golden-angle spiral avoids the clumping at the poles that naive
 * lat/long stepping produces.
 */
function fibSphere(count: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return out;
}

/**
 * Paint one node disc: near-black glass tinted with the role colour, four
 * concentric strokes stepping from a diffuse halo up to a sharp rim, then the
 * glyph — colour-glowed, black-outlined, white core. This is the app's
 * makeNodeSprite, minus the progress rings the website has no use for.
 */
function nodeTexture(text: string, role: Role): THREE.CanvasTexture {
  const S = 256;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const isCenter = role === 'center';
  const [cr, cg, cb] = ROLE_COLOR[role];
  const r = isCenter ? 90 : role === 'word' ? 88 : 74;
  const fontSize = isCenter ? 112 : text.length <= 2 ? 76 : 52;
  const cx = S / 2;
  const cy = S / 2;

  // dark glass fill, then the role-colour wash over it
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,11,10,0.93)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${cr},${cg},${cb},0.18)`;
  ctx.fill();

  // layered rim: widest/faintest first, sharp bright ring last
  const rim: [number, number][] = [
    [14, 0.18],
    [8, 0.38],
    [4, 0.65],
    [1.5, 1],
  ];
  for (const [lw, alpha] of rim) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.stroke();
  }

  ctx.font = `bold ${fontSize}px ${CJK_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // two glow passes, then a black outline so the glow can't bleed over it,
  // then the crisp white core
  ctx.shadowColor = `rgba(${cr},${cg},${cb},0.9)`;
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 10;
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/** Soft additive halo that sits behind a disc — the app's makeGlowSprite. */
function glowTexture(role: Role): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const [cr, cg, cb] = ROLE_COLOR[role];
  const grad = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, 120);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
  grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.18)`);
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}

export class NodeGraph {
  /** Add this to the scene; position/scale it to place the constellation. */
  readonly group = new THREE.Group();
  /**
   * Unit direction of the focus node (学). The page uses it to park that node
   * at the top of the sphere, and to know how far from the centre it sits.
   */
  readonly focusDir = new THREE.Vector3(0, 1, 0);
  /** Spun on its own so the group's transform stays free for page placement. */
  private spin = new THREE.Group();
  private qFree = new THREE.Quaternion();
  private qLock = new THREE.Quaternion();
  private qOrbit = new THREE.Quaternion();
  private eFree = new THREE.Euler();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private lines?: LineSegments2;
  /** Each fadeable material with the opacity it was authored at. */
  private fadeable: { mat: THREE.Material; base: number }[] = [];
  private opacity = 1;

  constructor() {
    this.group.add(this.spin);
    this.group.visible = false;
  }

  /**
   * Draw the constellation. The hanzi have to be painted with the real CJK
   * face — building before it loads bakes tofu into the textures — so this is
   * async and the caller reveals the group only once it resolves.
   */
  async build(): Promise<void> {
    await this.loadFont();

    const dirs = fibSphere(10);
    // Words take eight of the ten directions; the radicals take two from the
    // middle of the set so they don't both end up round the same pole.
    const wordDirs = [0, 1, 2, 3, 5, 6, 7, 8].map((i) => dirs[i]);
    const radDirs = [4, 9].map((i) => dirs[i]);

    const segments: number[] = [];
    const centre = new THREE.Vector3(0, 0, 0);

    this.addNode('中', 'center', centre);

    RADICALS.forEach((text, i) => {
      const pos = radDirs[i].clone().multiplyScalar(RAD_SHELL);
      this.addNode(text, 'radical', pos);
      segments.push(0, 0, 0, pos.x, pos.y, pos.z);
    });

    this.focusDir.copy(wordDirs[FOCUS_INDEX]);

    WORDS.forEach(({ word, other }, i) => {
      const pos = wordDirs[i].clone().multiplyScalar(ORB_SHELL);
      this.addNode(word, 'word', pos);
      segments.push(0, 0, 0, pos.x, pos.y, pos.z);

      // the word's other character continues straight out along the same ray,
      // the way the app hangs second-level nodes off their word — so centre,
      // word and character stay collinear and their two connectors read as one
      // unbroken spoke
      const outer = wordDirs[i].clone().multiplyScalar(OUTER_SHELL);
      this.addNode(other, 'char', outer);
      segments.push(pos.x, pos.y, pos.z, outer.x, outer.y, outer.z);
    });

    this.addLines(segments);
    this.group.visible = true;
  }

  private addNode(text: string, role: Role, pos: THREE.Vector3): void {
    const isCenter = role === 'center';

    const glowTex = glowTexture(role);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    const glowScale = isCenter ? 108 : 46;
    glow.scale.set(glowScale, glowScale, 1);
    glow.position.copy(pos);
    glow.renderOrder = 0;
    this.spin.add(glow);
    this.track(glowMat, glowTex);

    const tex = nodeTexture(text, role);
    // alphaTest lets near discs occlude far ones; kept low so the global fade
    // dissolves them instead of snapping them off at the threshold
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: 0.01 });
    const sprite = new THREE.Sprite(mat);
    // the app's sprite scales: a larger centre, every satellite the same size
    const s = isCenter ? 55 : 38;
    sprite.scale.set(s, s, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 2;
    this.spin.add(sprite);
    this.track(mat, tex);
  }

  private addLines(segments: number[]): void {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(segments);
    const mat = new LineMaterial({
      color: new THREE.Color('#5eecc8'), // the app's connector jade
      linewidth: 1.6,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });
    this.lines = new LineSegments2(geo, mat);
    this.lines.renderOrder = 1;
    this.spin.add(this.lines);
    this.materials.push(mat);
    this.fadeable.push({ mat, base: mat.opacity });
  }

  /** LineMaterial sizes its strokes in pixels, so it needs the viewport. */
  resize(width: number, height: number): void {
    (this.lines?.material as LineMaterial | undefined)?.resolution.set(width, height);
  }

  /**
   * `focus` blends the pose from the hero's free tumble (0) to the explorer
   * section's locked pose (1), which swings 学 onto `target` — a unit direction
   * the page computes so the node lands where it wants it on screen.
   *
   * The locked pose is still turning, but about `target` itself, and a rotation
   * about an axis leaves that axis fixed — so the constellation keeps orbiting
   * while 学 stays exactly where it was put.
   */
  update(elapsed: number, speed: number, focus: number, target: THREE.Vector3): void {
    const angle = elapsed * 0.16 * speed;
    this.eFree.set(Math.sin(elapsed * 0.11 * speed) * 0.22, angle, 0);
    this.qFree.setFromEuler(this.eFree);
    if (focus <= 0) {
      this.spin.quaternion.copy(this.qFree);
      return;
    }
    this.qLock.setFromUnitVectors(this.focusDir, target);
    this.qOrbit.setFromAxisAngle(target, angle);
    this.qLock.premultiply(this.qOrbit);
    this.spin.quaternion.copy(this.qFree).slerp(this.qLock, focus);
  }

  /**
   * Global fade, applied on top of each material's authored opacity. Used to
   * retire the constellation once the page has scrolled past the sections it
   * belongs to, rather than leaving it drifting behind later copy.
   */
  setOpacity(value: number): void {
    if (Math.abs(value - this.opacity) < 0.002) return;
    this.opacity = value;
    const visible = value > 0.004;
    this.fadeable.forEach(({ mat, base }) => {
      mat.opacity = base * value;
      mat.visible = visible;
    });
  }

  private track(material: THREE.Material, texture: THREE.Texture): void {
    this.materials.push(material);
    this.textures.push(texture);
    this.fadeable.push({ mat: material, base: material.opacity });
  }

  /**
   * Canvas text silently falls back to a default face if the webfont has not
   * arrived, so wait for it — and carry on regardless if it never does, since
   * a system CJK face still beats no graph.
   */
  private async loadFont(): Promise<void> {
    try {
      await Promise.all([
        document.fonts.load(`bold 112px ${CJK_FONT}`, '中'),
        document.fonts.load(`bold 76px ${CJK_FONT}`, '中国'),
      ]);
    } catch {
      /* fall through to whatever face the platform provides */
    }
  }

  dispose(): void {
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
    this.lines?.geometry.dispose();
  }
}
