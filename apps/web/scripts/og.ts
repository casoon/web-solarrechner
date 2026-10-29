import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

/** A Satori element tree: `{ type, props: { style, children } }`. */
export interface OgNode {
  type: string;
  props: Record<string, unknown>;
}

/**
 * Render a 1200x630 layout to PNG with Satori (HTML to SVG) and resvg (SVG to PNG).
 * Runs in Node at build time. Fonts are Inter at the given weights.
 */
export async function renderOgImage(
  tree: OgNode,
  fonts: { weight: 400 | 600 | 700; data: Buffer }[]
): Promise<Uint8Array> {
  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: fonts.map(({ weight, data }) => ({ name: 'Inter', data, weight, style: 'normal' })),
  });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
