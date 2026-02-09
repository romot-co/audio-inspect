#!/usr/bin/env node

import http from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 4173;
const DEFAULT_ENTRY = '/examples/index.html';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const requestedPort = Number(process.argv[2] ?? process.env.PORT ?? DEFAULT_PORT);
const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_PORT;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return contentTypes[ext] ?? 'application/octet-stream';
}

function toSafePath(urlPathname) {
  const normalized = path.normalize(urlPathname).replace(/^[/\\]+/, '');
  return path.resolve(projectRoot, normalized);
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

async function warnIfDistMissing() {
  try {
    await access(path.join(projectRoot, 'dist', 'index.js'));
  } catch {
    // The "demo" script runs build first, but "demo:serve" may be used directly.
    console.warn('[audio-inspect] dist/index.js not found. Run "npm run build" first.');
  }
}

await warnIfDistMissing();

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    send(res, 400, 'Bad Request');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  try {
    const parsed = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`);
    const requestedPath = parsed.pathname === '/' ? DEFAULT_ENTRY : parsed.pathname;
    const absolutePath = toSafePath(requestedPath);

    const relative = path.relative(projectRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      send(res, 403, 'Forbidden');
      return;
    }

    let targetPath = absolutePath;
    const info = await stat(targetPath).catch(() => null);

    if (info?.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }

    let fileInfo = await stat(targetPath).catch(() => null);

    // Fall back to dist/ so library default paths (e.g. /core/realtime/processor.js)
    // resolve to the built output without requiring dist/ in the URL.
    if (!fileInfo?.isFile()) {
      const distPath = toSafePath('/dist' + requestedPath);
      const distRel = path.relative(projectRoot, distPath);
      if (!distRel.startsWith('..') && !path.isAbsolute(distRel)) {
        const distInfo = await stat(distPath).catch(() => null);
        if (distInfo?.isFile()) {
          targetPath = distPath;
          fileInfo = distInfo;
        }
      }
    }

    if (!fileInfo?.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }

    const data = await readFile(targetPath);
    const headers = {
      'Content-Type': getContentType(targetPath),
      'Cache-Control': 'no-store'
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    res.end(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    send(res, 500, `Internal Server Error\n${message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[audio-inspect] Demo server running at http://127.0.0.1:${port}/`);
  console.log(`[audio-inspect] Open http://127.0.0.1:${port}${DEFAULT_ENTRY}`);
});
