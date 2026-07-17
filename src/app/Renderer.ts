import * as THREE from 'three';
import type { QualityProfile } from './Quality';

// This site is stylized shader art, not physically-based rendering: authored
// hex colors should hit the screen unchanged. Disable the sRGB→linear
// working-space conversion (and the matching output transform below) so
// ShaderMaterial and built-in materials agree on what a color means.
THREE.ColorManagement.enabled = false;

/**
 * Thin wrapper around WebGLRenderer: owns the fixed background canvas,
 * pixel-ratio capping, and resize plumbing.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;

  constructor(quality: QualityProfile) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'webgl-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(this.canvas);

    this.gl = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: quality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.gl.setPixelRatio(quality.dpr);
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace; // no output transform — WYSIWYG colors
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.render(scene, camera);
  }

  /** Fade the canvas in once the first frame exists (avoids a flash of black). */
  reveal(): void {
    this.canvas.classList.add('is-ready');
  }

  dispose(): void {
    this.gl.dispose();
    this.canvas.remove();
  }
}
