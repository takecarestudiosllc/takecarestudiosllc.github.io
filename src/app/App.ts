import { detectQuality, supportsWebGL } from './Quality';
import { ScrollController } from './ScrollController';
import { initDomAnimations } from '../ui/domAnimations';
import { initVideoEmbeds } from '../ui/videoEmbeds';

/** Pages that have a WebGL scene registered in SceneManager. Others (legal
 *  pages) stay DOM-only and never download the Three.js chunk. */
const WEBGL_PAGES = new Set(['home', 'sixseven', 'touchgrass']);

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

    initDomAnimations(quality);
    initVideoEmbeds();

    if (WEBGL_PAGES.has(page) && supportsWebGL()) {
      // Dynamic import keeps Three.js out of the shared bundle.
      import('./webgl')
        .then(({ bootWebGL }) => bootWebGL(page, quality, scroll.scrub(quality)))
        .catch((err) => console.error('WebGL layer failed to start:', err));
    }
    // Without WebGL the CSS fallback backgrounds carry the look.
  }
}
