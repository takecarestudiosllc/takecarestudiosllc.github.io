import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initTouchGrassAnimations(): void {
  const hero = document.querySelector<HTMLElement>('.tg-hero');
  if (hero) {
    const observer = new IntersectionObserver(([entry]) => document.body.classList.toggle('tg-scene-visible', entry.isIntersecting));
    observer.observe(hero);
  }
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    document.body.classList.add('tg-motion');
    gsap.from('[data-tg-intro]', { y: 15, opacity: 0, duration: .8, stagger: .07, ease: 'power3.out' });
    document.querySelectorAll('[data-tg-reveal]').forEach((el) => {
      gsap.from(el, { y: 25, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });
    return () => document.body.classList.remove('tg-motion');
  });
  void document.fonts.ready.then(() => ScrollTrigger.refresh());
}
