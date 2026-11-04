import { embeddedFiles } from './embedded';

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/desktop-health') return Response.json({ ok: true, embedded: true });
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = embeddedFiles[pathname as keyof typeof embeddedFiles] || embeddedFiles['/index.html'];
    const body = Buffer.from(file.data, 'base64');
    return new Response(body, {
      headers: {
        'Content-Type': file.type,
        'Cache-Control': pathname === '/index.html' ? 'no-cache' : 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
});

postMessage({ port: server.port });
