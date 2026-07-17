import type { SceneBase, SceneContext } from '../scenes/SceneBase';
import { HomeScene } from '../scenes/HomeScene';
import { SixSevenScene } from '../scenes/SixSevenScene';
import { TouchGrassScene } from '../scenes/TouchGrassScene';

type SceneFactory = (ctx: SceneContext) => SceneBase;

/**
 * Maps a page id (<body data-page="...">) to the WebGL scene that backs it.
 * Pages with no entry (the legal pages) simply run without WebGL — they still
 * get smooth scrolling and DOM animations.
 *
 * To add a page: create the scene class, add one line here, set data-page in
 * the new HTML file.
 */
const registry: Record<string, SceneFactory> = {
  home: (ctx) => new HomeScene(ctx),
  sixseven: (ctx) => new SixSevenScene(ctx),
  touchgrass: (ctx) => new TouchGrassScene(ctx),
};

export function createSceneForPage(page: string, ctx: SceneContext): SceneBase | null {
  const factory = registry[page];
  return factory ? factory(ctx) : null;
}
