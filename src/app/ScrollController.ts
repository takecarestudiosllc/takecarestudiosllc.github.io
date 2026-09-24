import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { QualityProfile } from './Quality';

gsap.registerPlugin(ScrollTrigger);

/** One clock for smooth scrolling, DOM transitions, and the WebGL scene. */
export class ScrollController {
  lenis: Lenis | null = null;
  private readonly tick = (time: number) => this.lenis?.raf(time * 1000);

  constructor(quality: QualityProfile) {
    this.setSmoothing(!quality.reducedMotion);
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
      this.setSmoothing(!event.matches);
      ScrollTrigger.refresh();
    });
  }

  private setSmoothing(enabled: boolean): void {
    if (this.lenis) {
      gsap.ticker.remove(this.tick);
      this.lenis.destroy();
      this.lenis = null;
    }
    if (!enabled) return;
    this.lenis = new Lenis({ autoRaf: false, lerp: .11, wheelMultiplier: 1, anchors: true });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(this.tick);
    gsap.ticker.lagSmoothing(0);
  }

  scrub(quality: QualityProfile): boolean | number {
    return quality.reducedMotion ? true : .9;
  }
}
