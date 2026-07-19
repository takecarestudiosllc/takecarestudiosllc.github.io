import * as THREE from 'three';

/**
 * Analytic center-line of the track: a gentle two-frequency wave. The phone
 * rides exactly this curve (HomeScene sets its y from trackY(x) each frame).
 * Keep in sync with TRACK_GLSL below, which the mote shader uses to flow
 * particles along the same curve.
 */
export function trackY(x: number): number {
  return -0.3 + 0.45 * Math.sin(x * 0.5 + 1.2) + 0.18 * Math.sin(x * 1.1 + 4.2);
}
const TRACK_GLSL = /* glsl */ `
  float trackY(float x) {
    return -0.3 + 0.45 * sin(x * 0.5 + 1.2) + 0.18 * sin(x * 1.1 + 4.2);
  }
`;

export interface VaporTrackOptions {
  /** Half-extent in x the track spans (size to cover the crossing + margins). */
  halfWidth: number;
  /** Depth of the track's center plane (lines/motes weave ±0.7 around it). */
  z: number;
  lines?: number;
  motes?: number;
}

/** Soft violet palette — vapor on the paper-white field. */
const LINE_COLORS = ['#8b7dff', '#a99bff', '#6f7dd8', '#b9aefc', '#8f9be0'];

/**
 * Ethereal track for the phone crossing: a loose braid of wavy translucent
 * lines around the trackY curve, plus soft motes that drift along it and
 * twinkle. Everything animates in shaders off one shared uTime; tween
 * `uniforms.uReveal` 0 → 1 from a scroll timeline to fade the whole track
 * in and out with its beat.
 */
export class VaporTrack {
  readonly group = new THREE.Group();
  readonly uniforms: {
    uTime: THREE.IUniform<number>;
    uReveal: THREE.IUniform<number>;
  };

  constructor(opts: VaporTrackOptions) {
    const uTime = { value: 0 };
    const uReveal = { value: 0 };
    const uHalf = { value: opts.halfWidth };
    this.uniforms = { uTime, uReveal };

    // --- vapory lines: layered translucent tubes (gl lines are stuck at
    // 1px), each with its own offset, girth, phase, color, and opacity — the
    // stack reads as one soft braid of mist.
    const segments = 140;
    for (let l = 0; l < (opts.lines ?? 12); l++) {
      const offY = (Math.random() * 2 - 1) * 0.26;
      const offZ = (Math.random() * 2 - 1) * 0.7;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const x = -opts.halfWidth + (i / segments) * opts.halfWidth * 2;
        points.push(new THREE.Vector3(x, trackY(x) + offY, opts.z + offZ));
      }
      const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        segments,
        0.025 + Math.random() * 0.035, // tube radius — the line's thickness
        6,
        false,
      );
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime,
          uReveal,
          uHalf,
          uPhase: { value: Math.random() * Math.PI * 2 },
          uOpacity: { value: 0.1 + Math.random() * 0.22 },
          uColor: { value: new THREE.Color(LINE_COLORS[l % LINE_COLORS.length]) },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uPhase;
          uniform float uHalf;
          varying float vT;
          void main() {
            vec3 pos = position;
            pos.y += sin(uTime * 0.5 + pos.x * 0.9 + uPhase) * 0.11;
            pos.z += cos(uTime * 0.35 + pos.x * 0.6 + uPhase) * 0.16;
            vT = (pos.x + uHalf) / (2.0 * uHalf);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uReveal;
          varying float vT;
          void main() {
            float ends = smoothstep(0.0, 0.14, vT) * smoothstep(1.0, 0.86, vT);
            float a = uOpacity * ends * uReveal;
            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      });
      this.group.add(new THREE.Mesh(geometry, material));
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
      uniforms: {
        uTime,
        uReveal,
        uHalf,
        uSize: { value: 0.09 },
        uScale: { value: window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) },
        uColor: { value: new THREE.Color(0x8b7dff) },
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
          float y = trackY(x) + position.y + sin(uTime * (0.5 + aSeed) + aSeed * 40.0) * 0.12;
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

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
