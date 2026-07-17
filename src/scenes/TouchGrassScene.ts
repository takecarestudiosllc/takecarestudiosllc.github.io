import * as THREE from 'three';
import gsap from 'gsap';
import { SceneBase } from './SceneBase';
import { Backdrop } from './Backdrop';
import { ParticleField } from './ParticleField';
import { shaders } from '../shaders';

const FIELD = { spreadX: 11, zNear: 7, zFar: -7 };

/**
 * Touch Grass VR page: an instanced grass field swaying in the wind under a
 * sunny meadow sky, with pollen motes floating through. Scroll glides the
 * camera forward and up, lifting the gaze toward the sky.
 */
export class TouchGrassScene extends SceneBase {
  private backdrop!: Backdrop;
  private pollen!: ParticleField;
  private grassUniforms!: {
    uTime: THREE.IUniform<number>;
    uWind: THREE.IUniform<number>;
    uBase: THREE.IUniform<THREE.Color>;
    uTip: THREE.IUniform<THREE.Color>;
    uFog: THREE.IUniform<THREE.Color>;
    uFogNear: THREE.IUniform<number>;
    uFogFar: THREE.IUniform<number>;
  };

  init(): void {
    this.backdrop = new Backdrop(shaders.meadowFrag, {
      a: 0x2e8c13, // lush green, low
      b: 0xa8e04b, // light lime sky, high
      c: 0xfff6c8, // sunlight patches
    });
    this.scene.add(this.backdrop.mesh);

    this.scene.add(this.createGround());
    this.scene.add(this.createGrass(Math.round(6500 * this.ctx.quality.density)));

    this.pollen = new ParticleField({
      count: Math.round(300 * this.ctx.quality.density),
      color: 0xfffbe8,
      size: 0.07,
      opacity: 0.4,
      sway: 0.5,
      rise: 0.12,
      parallax: 1.5,
      bounds: { x: 10, y: 5, zNear: 6, zFar: -6 },
    });
    this.pollen.points.position.y = 2.5; // hover above the field
    this.scene.add(this.pollen.points);

    // Start low, inside the grass, gazing slightly upward — blades silhouette
    // against the bright sky. Scroll rises up and out of the field.
    this.ctx.rig.position.set(0, 0.9, 9);
    this.ctx.rig.lookAt.set(0, 1.6, 0);
    this.ctx.rig.parallax.set(0.35, 0.2); // gentler sway close to the ground
  }

  /** Simple dark-green disc under the blades so gaps read as soil. */
  private createGround(): THREE.Mesh {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 24),
      new THREE.MeshBasicMaterial({ color: 0x1d6c0c }),
    );
    ground.rotation.x = -Math.PI / 2;
    return ground;
  }

  /** One instanced draw call for the whole field; wind runs in the vertex shader. */
  private createGrass(count: number): THREE.Mesh {
    // Tapered blade: a narrow 4-segment plane pinched toward the tip.
    const blade = new THREE.PlaneGeometry(0.09, 1, 1, 4);
    blade.translate(0, 0.5, 0); // origin at the root
    const pos = blade.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) * (1 - pos.getY(i) * 0.85));
    }

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = blade.index;
    geometry.setAttribute('position', blade.attributes.position);
    geometry.setAttribute('uv', blade.attributes.uv);
    geometry.instanceCount = count;

    const offsets = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const angles = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] = (Math.random() * 2 - 1) * FIELD.spreadX;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = THREE.MathUtils.lerp(FIELD.zNear, FIELD.zFar, Math.random());
      scales[i] = THREE.MathUtils.lerp(0.9, 1.9, Math.random());
      angles[i] = Math.random() * Math.PI * 2;
      seeds[i] = Math.random();
    }
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geometry.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

    this.grassUniforms = {
      uTime: { value: 0 },
      uWind: { value: 0.16 },
      uBase: { value: new THREE.Color(0x155607) },
      uTip: { value: new THREE.Color(0x7fd42f) },
      uFog: { value: new THREE.Color(0x5cbc2a) }, // blends into the meadow horizon
      // Fog starts past most of the field so near/mid blades keep contrast.
      uFogNear: { value: 10 },
      uFogFar: { value: 22 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: shaders.grassVert,
      fragmentShader: shaders.grassFrag,
      uniforms: this.grassUniforms,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // instances span the whole field
    return mesh;
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
    tl.to(this.ctx.rig.position, { y: 2.8, z: 5.2 }, 0)
      .to(this.ctx.rig.lookAt, { y: 2.2 }, 0) // rise above the field
      .to(this.backdrop.uniforms.uScroll, { value: 1 }, 0)
      .to(this.grassUniforms.uWind, { value: 0.24 }, 0) // breeze picks up
      .to(this.pollen.uniforms.uScroll, { value: 1 }, 0);
  }

  update(dt: number, elapsed: number, pointer: { x: number; y: number }): void {
    void dt;
    this.backdrop.update(elapsed, pointer);
    this.grassUniforms.uTime.value = elapsed;
    this.pollen.update(elapsed);
  }

  resize(width: number, height: number): void {
    this.backdrop.resize(width, height);
  }
}
