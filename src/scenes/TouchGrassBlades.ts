import * as THREE from 'three';
import type { TouchGrassScenery } from './TouchGrassScenery';
import vertexShader from '../shaders/meadowBlades.vert?raw';
import fragmentShader from '../shaders/meadowBlades.frag?raw';

/**
 * Independent blade meshes layered over the capture, placed in image coordinates
 * so their roots follow the same cover crop on desktop, phones, and rotation.
 */
export class TouchGrassBlades {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

  constructor(scenery: TouchGrassScenery, density: number) {
    // Four bendable segments, pinched to a sharp tip like the game grass.
    const blade = new THREE.PlaneGeometry(1, 1, 1, 4);
    blade.translate(0, .5, 0);
    const positions = blade.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const height = positions.getY(i);
      positions.setX(i, positions.getX(i) * (1 - height * height * .98));
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = blade.index;
    geometry.setAttribute('position', positions);
    geometry.setAttribute('uv', blade.getAttribute('uv'));
    const count = Math.round(1800 * density);
    const roots = new Float32Array(count * 2);
    const sizes = new Float32Array(count * 2);
    const seeds = new Float32Array(count);
    // Stable placement avoids a different arrangement on every visit or resize.
    let state = 41729;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const y = -.035 + Math.pow(random(), 1.2) * .32;
      const near = 1 - Math.max(0, y) / .32;
      roots.set([random(), y], i * 2);
      sizes.set([
        (.0025 + random() * .006) * (.55 + near * .9),
        (.025 + random() * .055) * (.55 + near),
      ], i * 2);
      seeds[i] = random();
    }
    geometry.setAttribute('aRoot', new THREE.InstancedBufferAttribute(roots, 2));
    geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.instanceCount = count;
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      // Share only timing, interaction, image/crop inputs; this is a separate draw.
      uniforms: scenery.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }
}
