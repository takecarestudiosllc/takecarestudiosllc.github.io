import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { QualityProfile } from './Quality';

gsap.registerPlugin(ScrollTrigger);

/**
 * Owns smooth scrolling (Lenis) and keeps GSAP's ScrollTrigger in sync with it.
 * The GSAP ticker is the single RAF loop for the whole app — Lenis, DOM
 * animations, and the WebGL render loop all hang off it.
 */
export class ScrollController {
  readonly lenis: Lenis | null = null;

  constructor(quality: QualityProfile) {
    // Respect reduced-motion: native scrolling, ScrollTrigger still works.
    if (!quality.reducedMotion) {
      this.lenis = new Lenis({
        autoRaf: false,
        lerp: 0.11,
        wheelMultiplier: 1,
      });
      this.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => this.lenis!.raf(time * 1000));
      // Lenis drives scroll every frame; GSAP's lag smoothing would fight it.
      gsap.ticker.lagSmoothing(0);
    }
  }

  /** Scrub value for scroll-driven timelines (instant under reduced motion). */
  scrub(quality: QualityProfile): boolean | number {
    return quality.reducedMotion ? true : 0.9;
  }
}
