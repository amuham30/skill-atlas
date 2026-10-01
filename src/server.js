import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredRoots, scanInventory } from './scanner.js';
import { getSkillDetail } from './detail.js';
import { buildDiscoveryInventory } from './discovery.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(directory, '..', 'public');
const roots = configuredRoots();
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/search.js', ['search.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/detail.js', ['detail.js', 'text/javascript; charset=utf-8']],
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  if (request.method !== 'GET') {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  if (pathname === '/api/inventory') {
    try {
      const inventory = buildDiscoveryInventory(roots);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(inventory));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (pathname.startsWith('/api/skills/')) {
    const id = pathname.slice('/api/skills/'.length);
    if (!/^[a-f0-9]{16}$/.test(id)) {
      response.writeHead(404).end('Skill not found');
      return;
    }
    try {
      const skill = scanInventory(roots).skills.find((entry) => entry.id === id);
      if (!skill) {
        response.writeHead(404).end('Skill not found');
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify(getSkillDetail(skill, roots)));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (/^\/skill\/[a-f0-9]{16}$/.test(pathname)) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    fs.createReadStream(path.join(publicDirectory, 'detail.html')).pipe(response);
    return;
  }
  const asset = assets.get(pathname);
  if (!asset) {
    response.writeHead(404).end('Not found');
    return;
  }
  const [filename, contentType] = asset;
  response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(path.join(publicDirectory, filename)).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Skill Atlas: http://${host}:${port}`);
  console.log(`Scanning ${roots.length} root locations`);
});
