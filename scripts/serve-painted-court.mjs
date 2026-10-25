import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const file = new URL('../dist/painted-court/index.html', import.meta.url);
const port = Number(process.env.COURTYARD_PORT || 8097);
createServer(async (request, response) => {
  if (request.url !== '/' && request.url !== '/index.html') { response.writeHead(404); response.end('Not found'); return; }
  try {
    const html = await readFile(file);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
  } catch {
    response.writeHead(503); response.end('Run node scripts/build-painted-court.mjs first.');
  }
}).listen(port, '0.0.0.0', () => console.log(`Courtyard review: http://localhost:${port}`));
