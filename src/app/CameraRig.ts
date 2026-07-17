import * as THREE from 'three';
import type { QualityProfile } from './Quality';

/**
 * Camera on a rig. Scroll timelines tween `position` and `lookAt` (the rig's
 * base pose); pointer parallax is layered on top every frame so the two never
 * fight each other.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Base pose — tween these from scene scroll timelines. */
  readonly position = new THREE.Vector3(0, 0, 9);
  readonly lookAt = new THREE.Vector3(0, 0, 0);
  /** How far the pointer sways the camera, in world units. Scenes may override. */
  parallax = new THREE.Vector2(0.5, 0.3);

  private swayCurrent = new THREE.Vector2();
  private enabled: boolean;

  constructor(quality: QualityProfile) {
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.enabled = !quality.touch && !quality.reducedMotion;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** pointer is normalized to [-1, 1] on both axes. */
  update(pointer: { x: number; y: number }, dt: number): void {
    if (this.enabled) {
      // Exponential smoothing that is frame-rate independent.
      const k = 1 - Math.exp(-3 * dt);
      this.swayCurrent.x += (pointer.x * this.parallax.x - this.swayCurrent.x) * k;
      this.swayCurrent.y += (-pointer.y * this.parallax.y - this.swayCurrent.y) * k;
    }
    this.camera.position.set(
      this.position.x + this.swayCurrent.x,
      this.position.y + this.swayCurrent.y,
      this.position.z,
    );
    this.camera.lookAt(this.lookAt);
  }
}
