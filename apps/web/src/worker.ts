import { handle } from '@astrojs/cloudflare/handler';

/**
 * Worker entry: Astro's handler, with HTML pages compressed here instead of at the Cloudflare edge.
 *
 * HTML goes out with `Cache-Control: no-transform` so that Cloudflare does not inject scripts into
 * the pages (JavaScript Detections under /cdn-cgi/challenge-platform/), which the CSP would block.
 * `no-transform` also stops the edge from compressing, so the Worker sends the pages gzipped and
 * the edge passes them through unchanged. `run_worker_first` in wrangler.toml routes the pages here.
 */
export default {
  async fetch(request, env, context) {
    const response = await handle(request, env, context);
    const type = response.headers.get('Content-Type') ?? '';
    if (!type.startsWith('text/html') || !response.body) return response;

    const headers = new Headers(response.headers);
    const cacheControl = headers.get('Cache-Control');
    if (!cacheControl?.includes('no-transform'))
      headers.set('Cache-Control', cacheControl ? `${cacheControl}, no-transform` : 'no-transform');
    if (!request.headers.get('Accept-Encoding')?.includes('gzip'))
      return new Response(response.body, { status: response.status, headers });

    headers.set('Content-Encoding', 'gzip');
    headers.delete('Content-Length');
    return new Response(response.body.pipeThrough(new CompressionStream('gzip')), {
      status: response.status,
      headers,
      encodeBody: 'manual',
    });
  },
} satisfies ExportedHandler<Env>;
