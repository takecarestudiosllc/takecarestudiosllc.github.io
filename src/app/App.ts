import { detectQuality, supportsWebGL } from './Quality';
import { ScrollController } from './ScrollController';
import { initHomeAnimations } from '../ui/homeAnimations';
import { initDomAnimations } from '../ui/domAnimations';
import { initVideoEmbeds } from '../ui/videoEmbeds';
import { initContactForms } from '../ui/contactForm';

/** Pages that have a WebGL scene registered in SceneManager. Others (legal
 *  pages) stay DOM-only and never download the Three.js chunk. */
const WEBGL_PAGES = new Set(['home', 'sixseven', 'touchgrass', 'zhong', 'support']);

/**
 * Composition root. One App per page load (this is a multi-page site).
 * Order matters: scroll control first (registers ScrollTrigger), then DOM
 * animations, then — lazily — the WebGL layer if this page has a scene.
 */
export class App {
  constructor() {
    const page = document.body.dataset.page ?? 'legal';
    const quality = detectQuality();
    const scroll = new ScrollController(quality);

    if (page === 'home') initHomeAnimations();
    else initDomAnimations(quality);
    initVideoEmbeds();
    initContactForms();

    const canRender = WEBGL_PAGES.has(page) && supportsWebGL();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let booted = false;
    const boot = () => {
      if (!canRender || booted || (page === 'home' && motion.matches)) return;
      booted = true;
      const activeQuality = detectQuality();
      if (page === 'home') activeQuality.dpr = Math.min(activeQuality.dpr, 1.5);
      import('./webgl')
        .then(({ bootWebGL }) => bootWebGL(page, activeQuality, scroll.scrub(activeQuality)))
        .catch((err) => {
          document.body.classList.remove('home-motion');
          console.error('WebGL layer failed to start:', err);
        });
    };
    boot();
    if (page === 'home') {
      motion.addEventListener('change', boot);
      if (!canRender) document.body.classList.remove('home-motion');
    }
    // Home reduced motion and WebGL fallback retain all four illustrations in normal flow.
  }
}
