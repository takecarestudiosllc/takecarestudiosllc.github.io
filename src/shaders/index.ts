/**
 * Central shader exports. Fragment shaders that use fbm() get the shared
 * noise chunk prepended here so the .frag files stay focused on their look.
 */
import noise from './chunks/noise.glsl?raw';
import backdropVert from './backdrop.vert?raw';
import nebulaFrag from './nebula.frag?raw';
import paperFrag from './paper.frag?raw';
import lavaFrag from './lava.frag?raw';
import meadowFrag from './meadow.frag?raw';
import particlesVert from './particles.vert?raw';
import particlesFrag from './particles.frag?raw';
import grassVert from './grass.vert?raw';
import grassFrag from './grass.frag?raw';

export const shaders = {
  backdropVert,
  nebulaFrag: noise + nebulaFrag,
  paperFrag,
  lavaFrag: noise + lavaFrag,
  meadowFrag: noise + meadowFrag,
  particlesVert,
  particlesFrag,
  grassVert,
  grassFrag,
} as const;
