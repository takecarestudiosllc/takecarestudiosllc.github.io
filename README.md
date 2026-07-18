# ONEGOD DIGITAL — takecarestudiosllc.github.io

Immersive WebGL marketing site for ONEGOD DIGITAL, the DBA of Take Care Studios LLC (Six Seven VR,
Touch Grass! VR Simulator). Multi-page Vite app: every top-level `.html`
file is a real page with its text in the DOM (SEO-friendly); Three.js renders
a scroll-driven backdrop behind it.

## Stack

- **TypeScript + Vite** — multi-page build (`vite.config.ts` lists every page)
- **Three.js** — WebGL rendering, custom GLSL shaders in `src/shaders/`
- **GSAP + ScrollTrigger** — scroll-scrubbed camera/uniform timelines and DOM reveals
- **Lenis** — smooth scrolling (disabled under `prefers-reduced-motion`)

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `dist/`
and publishes it to GitHub Pages.

**One-time setup:** repo → Settings → Pages → Build and deployment →
Source → **GitHub Actions**.

## Architecture

```
src/
├── main.ts               entry for every page (reads <body data-page>)
├── app/
│   ├── App.ts            composition root + render loop (single GSAP ticker)
│   ├── Renderer.ts       WebGLRenderer wrapper, DPR caps, resize
│   ├── CameraRig.ts      scroll-tweened base pose + pointer parallax
│   ├── SceneManager.ts   data-page → scene registry
│   ├── AssetLoader.ts    texture/GLTF manifest loader
│   ├── ScrollController.ts  Lenis ↔ ScrollTrigger sync
│   └── Quality.ts        device tiers: DPR, particle density, reduced motion
├── scenes/
│   ├── SceneBase.ts      scene contract (init / timeline / update / dispose)
│   ├── Backdrop.ts       fullscreen shader plane (clip-space, camera-independent)
│   ├── ParticleField.ts  GPU particle system (one draw call)
│   ├── HomeScene.ts      violet nebula + dust
│   ├── SixSevenScene.ts  molten lava + rising embers
│   └── TouchGrassScene.ts  instanced wind-blown grass field + pollen
├── shaders/              GLSL (imported as ?raw), chunks/ holds shared noise
├── ui/
│   ├── domAnimations.ts  data-attribute driven GSAP reveals/parallax
│   └── videoEmbeds.ts    click-to-play YouTube facade
└── styles/main.css       design tokens, themes via <body data-theme>
```

### Adding a page with a 3D scene

1. Copy an existing page's HTML, set `<body data-page="mypage" data-theme="...">`,
   add the file to `rollupOptions.input` in `vite.config.ts`.
2. Subclass `SceneBase` (see `HomeScene` for the minimal shape).
3. Register it in `src/app/SceneManager.ts`.

Pages without a registered scene (the legal pages) automatically skip WebGL
but keep smooth scrolling and styling.
