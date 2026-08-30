import * as THREE from 'three';

/**
 * Analytic center-line of the track: a diagonal from bottom-left to
 * top-right with a gentle two-frequency wave laid over it. The phone rides
 * exactly this curve (HomeScene sets its y from trackY(x) each frame).
 * Keep in sync with TRACK_GLSL below, which the mote shader uses to flow
 * particles along the same curve.
 */
export function trackY(x: number): number {
  return 0.42 * x - 0.15 + 0.3 * Math.sin(x * 0.5 + 1.2) + 0.14 * Math.sin(x * 1.1 + 4.2);
}
const TRACK_GLSL = /* glsl */ `
  float trackY(float x) {
    return 0.42 * x - 0.15 + 0.3 * sin(x * 0.5 + 1.2) + 0.14 * sin(x * 1.1 + 4.2);
  }
`;

export interface VaporTrackOptions {
  /** Half-extent in x the track spans (size to cover the crossing + margins). */
  halfWidth: number;
  /** Depth of the track's center plane (shards/motes sit within ±0.7 of it). */
  z: number;
  lines?: number;
  motes?: number;
}

/** Light yellow-gold palette — additive shards glow on the dark field. */
const LINE_COLORS = ['#f0d98c', '#e8c96a', '#f5e6a8', '#ddb955', '#f8eec2'];

/** Default convergence point for the shard tips, in world units: the
 *  camera→phone sight line extended back to the shard plane at the design
 *  aspect (camera (0, 0.4, 9), phone rest (1.2, 0, 4), shard plane
 *  z = 2.4). The phone's rest x compresses on narrow screens, so callers
 *  retarget via setFocus() — a baked-in x would drift off-screen right in
 *  portrait. */
const FOCUS_X = 1.58;
const FOCUS_Y = -0.13;

/**
 * Geometric backdrop for the phone crossing: flat triangular shards of
 * light — thin at the tip, wide at the far end — whose tips all meet near
 * a point behind the phone's resting spot, like a pane of glass shattered
 * around an impact. Additive blending makes overlapping shards bloom.
 * Soft motes still drift along the trackY curve the phone rides.
 * Everything animates in shaders off one shared uTime; tween
 * `uniforms.uReveal` 0 → 1 from a scroll timeline to fade the whole track
 * in and out with its beat.
 */
export class VaporTrack {
  readonly group = new THREE.Group();
  readonly uniforms: {
    uTime: THREE.IUniform<number>;
    uReveal: THREE.IUniform<number>;
  };
  /** All shards live here with their tips at the local origin, so moving
   *  this group moves the convergence point (see setFocus). */
  private shards = new THREE.Group();

  constructor(opts: VaporTrackOptions) {
    const uTime = { value: 0 };
    const uReveal = { value: 0 };
    const uHalf = { value: opts.halfWidth };
    this.uniforms = { uTime, uReveal };

    // --- glass shards: flat triangles radiating from the focus, tips in,
    // wide ends out, spread around the full circle with jittered angles and
    // sizes so the layout reads as fracture, not a tidy star.
    this.shards.position.set(FOCUS_X, FOCUS_Y, opts.z);
    this.group.add(this.shards);
    const lines = opts.lines ?? 10;
    for (let l = 0; l < lines; l++) {
      const angle = (l / lines) * Math.PI * 2 + (Math.random() * 2 - 1) * 0.28;
      const length = 3.5 + Math.random() * (opts.halfWidth - 3.5);
      const farHalfWidth = 0.45 + Math.random() * 0.85; // wide outer end
      // Every tip sits at exactly the same point so the shards visibly
      // converge; depthWrite is off, so the coplanar overlap is harmless.
      const tip = new THREE.Vector3(0, 0, 0);
      const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const perp = new THREE.Vector3(-dir.y, dir.x, 0);
      const far = tip.clone().addScaledVector(dir, length);
      const cornerA = far.clone().addScaledVector(perp, -farHalfWidth);
      const cornerB = far.clone().addScaledVector(perp, farHalfWidth);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([
            tip.x, tip.y, tip.z,
            cornerA.x, cornerA.y, cornerA.z,
            cornerB.x, cornerB.y, cornerB.z,
          ]),
          3,
        ),
      );
      // uv.x runs tip → wide end, uv.y runs across the width (tip sits at
      // the middle) — the shader uses these for the edge glow and fades.
      geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array([0, 0.5, 1, 0, 1, 1]), 2),
      );
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Additive: overlapping shards brighten each other, so the cluster
        // of tips behind the phone blooms light yellow-gold.
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime,
          uReveal,
          uPhase: { value: Math.random() * Math.PI * 2 },
          uOpacity: { value: 0.16 + Math.random() * 0.18 },
          uColor: { value: new THREE.Color(LINE_COLORS[l % LINE_COLORS.length]) },
          // Staggered entrance: each shard claims its own slice of the
          // shared uReveal ramp. The stride shuffle spreads consecutive
          // delays around the fan so neighbors don't appear in sequence.
          uDelay: { value: (((l * 7) % lines) / lines) * 0.6 + Math.random() * 0.05 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uReveal;
          uniform float uTime;
          uniform float uPhase;
          uniform float uDelay;
          varying vec2 vUv;
          void main() {
            // This shard's own slice of the shared reveal ramp: it sits out
            // the first uDelay of uReveal, then fades in over the next 0.4
            // — every shard has a different uDelay, so they arrive
            // staggered as the user scrolls.
            float r = smoothstep(uDelay, uDelay + 0.4, uReveal);
            // Materialize tip-first: a soft wipe sweeps from the tip to the
            // wide end as r ramps (grow overshoots so r = 1 shows it all).
            float grow = r * 1.3;
            float wipe = smoothstep(grow, grow - 0.3, vUv.x);
            // Faint glassy fill, brightest at the tip, dissolving toward
            // the wide end; crisp bright rims along the two long edges.
            float fill = mix(1.0, 0.3, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
            float rim = smoothstep(0.16, 0.0, min(vUv.y, 1.0 - vUv.y)) * smoothstep(1.0, 0.88, vUv.x);
            // A light pulse sweeps tip → edge, energy radiating outward.
            float pulse = pow(0.5 + 0.5 * sin((vUv.x - uTime * 0.045) * 12.566 + uPhase), 6.0);
            float a = uOpacity * r * wipe * (fill * (0.45 + 0.9 * pulse) + rim * 0.85);
            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor * (0.85 + 0.9 * pulse), a);
          }
        `,
      });
      this.shards.add(new THREE.Mesh(geometry, material));
    }

    // --- motes: soft dots flowing along the curve, each on its own lap.
    const count = opts.motes ?? 120;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * opts.halfWidth; // start x
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 0.4; // y jitter off the curve
      positions[i * 3 + 2] = opts.z + (Math.random() * 2 - 1) * 0.7;
      seeds[i] = Math.random();
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    moteGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const moteMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // same glow treatment as the beams
      uniforms: {
        uTime,
        uReveal,
        uHalf,
        uSize: { value: 0.09 },
        uScale: { value: window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) },
        uColor: { value: new THREE.Color(0xe8c96a) },
      },
      vertexShader: /* glsl */ `
        ${TRACK_GLSL}
        attribute float aSeed;
        uniform float uTime;
        uniform float uHalf;
        uniform float uSize;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          // Drift along the track, wrapping at the ends; fade near them so
          // the wrap never pops.
          float x = mod(position.x + uTime * (0.15 + aSeed * 0.35) + uHalf, 2.0 * uHalf) - uHalf;
          // Fan out wide toward the bottom-left end, gather toward top-right.
          float spread = mix(1.7, 0.35, (x + uHalf) / (2.0 * uHalf));
          float y = trackY(x) + position.y * spread + sin(uTime * (0.5 + aSeed) + aSeed * 40.0) * 0.12;
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 1.4) + aSeed * 21.0);
          vAlpha = twinkle * smoothstep(1.0, 0.85, abs(x) / uHalf);
          vec4 mv = modelViewMatrix * vec4(x, y, position.z, 1.0);
          gl_PointSize = uSize * (0.5 + aSeed) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uReveal;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.08, d) * vAlpha * uReveal * 0.55;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    motes.frustumCulled = false; // motes flow in the shader
    this.group.add(motes);
  }

  /** Move the shard convergence point (x/y at the shard plane). Call on
   *  resize so the focus tracks the phone's aspect-compressed rest spot. */
  setFocus(x: number, y: number): void {
    this.shards.position.x = x;
    this.shards.position.y = y;
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
