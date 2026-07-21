/**
 * Central shader exports. Fragment shaders that use fbm() get the shared
 * noise chunk prepended here so the .frag files stay focused on their look.
 */
import noise from './chunks/noise.glsl?raw';
import chroma from './chunks/chroma.glsl?raw';
import backdropVert from './backdrop.vert?raw';
import nebulaFrag from './nebula.frag?raw';
import paperFrag from './paper.frag?raw';
import lavaFrag from './lava.frag?raw';
import meadowFrag from './meadow.frag?raw';
import particlesVert from './particles.vert?raw';
import particlesFrag from './particles.frag?raw';
import starsVert from './stars.vert?raw';
import starsFrag from './stars.frag?raw';
import grassVert from './grass.vert?raw';
import grassFrag from './grass.frag?raw';
import gemVert from './gem.vert?raw';
import gemFrag from './gem.frag?raw';
import gridFrag from './grid.frag?raw';
import jadeWaterFrag from './jadewater.frag?raw';

export const shaders = {
  backdropVert,
  nebulaFrag: noise + nebulaFrag,
  paperFrag: noise + chroma + paperFrag,
  lavaFrag: noise + lavaFrag,
  meadowFrag: noise + meadowFrag,
  particlesVert,
  particlesFrag,
  starsVert,
  starsFrag: chroma + starsFrag,
  grassVert,
  grassFrag,
  gemVert,
  gemFrag,
  gridFrag,
  // needs the noise chunk only for hash21, which seeds the bubbles
  jadeWaterFrag: noise + jadeWaterFrag,
} as const;
