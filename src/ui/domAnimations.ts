import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { QualityProfile } from '../app/Quality';

gsap.registerPlugin(ScrollTrigger);

// The mobile URL bar showing/hiding fires resize events mid-scroll; refreshing
// on those makes scrubbed/pinned elements jump. Real size changes (rotation,
// desktop window resize) still trigger a refresh.
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * All DOM-side motion, driven by data attributes so pages stay declarative:
 *   data-split      — hero heading, split into words and staggered upward
 *   data-hero-fade  — hero elements faded/raised on load
 *   data-reveal     — sections revealed as they scroll into view
 *   data-parallax   — images drifted vertically while scrolling (value = depth)
 *   data-slide-in   — cards scrubbed in from off-screen right, settling centered
 *   data-finale     — copy that fades in over the last stretch of its pin-section
 * Under prefers-reduced-motion nothing animates; content is simply visible.
 */
export function initDomAnimations(quality: QualityProfile): void {
  document.body.classList.add('js');

  // Header gains a solid backdrop once the page is scrolled. (The home page
  // has no header — its hero stands alone.)
  if (document.querySelector('.site-header')) {
    ScrollTrigger.create({
      start: 30,
      end: 'max',
      toggleClass: { targets: '.site-header', className: 'is-scrolled' },
    });
  }

  if (quality.reducedMotion) return;

  // --- hero heading: word-by-word rise -------------------------------------
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    const text = (el.textContent ?? '').trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    // Split on whitespace except U+00A0 — a non-breaking space keeps the words
    // it joins inside a single mask, so they animate and wrap as one unit.
    text.split(/[^\S\u00A0]+/).forEach((word) => {
      const mask = document.createElement('span');
      mask.className = 'split-mask';
      mask.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'split-word';
      inner.textContent = word;
      mask.append(inner);
      el.append(mask, ' ');
    });
  });

  const splitWords = gsap.utils.toArray<HTMLElement>('.split-word');
  const heroFades = gsap.utils.toArray<HTMLElement>('[data-hero-fade]');
  if (splitWords.length || heroFades.length) {
    const intro = gsap.timeline({
      defaults: { ease: 'power4.out' },
      // The masks only need to clip during the rise; released after, they'd
      // otherwise crop the hero copy's white halo into rectangles.
      onComplete: () => {
        document.querySelectorAll<HTMLElement>('.split-mask').forEach((m) => {
          m.style.overflow = 'visible';
        });
      },
    });
    if (splitWords.length) intro.from(splitWords, { yPercent: 120, duration: 1.1, stagger: 0.09 }, 0.15);
    if (heroFades.length) intro.from(heroFades, { y: 28, opacity: 0, duration: 1, stagger: 0.12 }, 0.45);
  }

  // --- scroll cue: gone almost immediately once scrolling starts ------------
  const cue = document.querySelector<HTMLElement>('.scroll-cue');
  if (cue) {
    gsap.to(cue, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: { start: 10, end: 160, scrub: true },
    });
  }

  // --- scroll-in reveals ----------------------------------------------------
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 48,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // --- slide-in cards (scrubbed) --------------------------------------------
  // Each card rides a track in from off-screen right: it starts farther away
  // (smaller and raised) and travels inward toward the left along a path
  // tilted gently down-left, growing to full size as it arrives. Later cards
  // start farther out so they trail the first one.
  gsap.utils.toArray<HTMLElement>('[data-slide-in]').forEach((el, i) => {
    const startX = () => window.innerWidth * (1.05 + i * 0.3);
    const trackSlope = 0.08; // drop per px of leftward travel — the gentle tilt
    gsap.fromTo(
      el,
      {
        x: startX,
        y: () => -startX() * trackSlope,
        scale: 0.55,
        rotation: -4, // lean with the descending track, settling flat
      },
      {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section') ?? el,
          start: 'top bottom',
          end: 'center center',
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  });

  // --- finale copy (scrubbed to the tail of its pinned section) -------------
  document.querySelectorAll<HTMLElement>('[data-finale]').forEach((el) => {
    const section = el.closest('.pin-section') ?? el;
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
      })
      .to({}, { duration: 0.78 }) // wait for the bloom
      .fromTo(el, { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.22, ease: 'none' });
  });

  // --- image parallax (scrubbed, subtle) ------------------------------------
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const depth = parseFloat(el.dataset.parallax ?? '0.12');
    gsap.fromTo(
      el,
      { yPercent: depth * 100 },
      {
        yPercent: -depth * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement ?? el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}
