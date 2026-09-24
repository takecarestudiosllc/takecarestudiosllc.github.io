import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** DOM and WebGL use the same chapter boundaries, with readable holds between transitions. */
export function initHomeAnimations(): void {
  const header = document.querySelector('.home-header');
  const links = document.querySelectorAll<HTMLAnchorElement>('.home-nav a[href^="#"]');
  ScrollTrigger.create({ start: 30, end: 'max', toggleClass: { targets: header, className: 'is-scrolled' } });
  gsap.to('.home-progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
  for (const section of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
    ScrollTrigger.create({
      trigger: section, start: 'top 45%', end: 'bottom 45%',
      onToggle: ({ isActive }) => {
        const link = [...links].find((a) => a.hash === `#${section.id}`);
        if (isActive) {
          links.forEach((a) => a.removeAttribute('aria-current'));
          link?.setAttribute('aria-current', 'location');
        } else link?.removeAttribute('aria-current');
      },
    });
  }
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    document.body.classList.add('home-motion');
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.home-title-line > span', { yPercent: 110, duration: 1.15, stagger: .12 }, .1)
      .from('[data-home-intro]', { y: 16, opacity: 0, duration: .9, stagger: .12 }, .25);
    gsap.to('.home-hero__copy', { y: -65, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.home-hero', start: 'top top', end: 'bottom 38%', scrub: .45 } });
    gsap.to('.home-orbit', { rotation: 0, scale: 1.2, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.home-hero', start: 'top top', end: 'bottom 20%', scrub: .6 } });
    for (const section of document.querySelectorAll<HTMLElement>('.home-chapter')) {
      gsap.from(section.querySelectorAll('[data-home-reveal]'), {
        y: 30, opacity: 0, duration: .8, stagger: .09, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 65%', toggleActions: 'play none none reverse' },
      });
    }
    return () => document.body.classList.remove('home-motion');
  });
  // Font metrics affect both sticky bounds and WebGL placement.
  void document.fonts.ready.then(() => ScrollTrigger.refresh());
}
