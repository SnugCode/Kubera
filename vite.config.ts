import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, 'data');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'kubera-file-store',
      configureServer(server) {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

        // ── Chat proxy — keeps ANTHROPIC_API_KEY server-side ─
        server.middlewares.use((req, res, next) => {
          if (req.url !== '/api/chat' || req.method !== 'POST') return next();
          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in your .env file.' }));
            return;
          }
          let body = '';
          req.on('data', chunk => { body += String(chunk); });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(payload),
              });
              if (payload.stream) {
                res.writeHead(upstream.status, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
                const reader = (upstream.body as unknown as ReadableStream<Uint8Array>).getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) { res.end(); break; }
                  res.write(value);
                }
              } else {
                const data = await upstream.json();
                res.writeHead(upstream.status, { 'content-type': 'application/json' });
                res.end(JSON.stringify(data));
              }
            } catch (err) {
              if (!res.headersSent) {
                res.writeHead(500, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: String(err) }));
              } else {
                res.end();
              }
            }
          });
        });

        // ── File store ────────────────────────────────────────
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '';
          if (!url.startsWith('/api/store/')) return next();

          // Only allow safe key names — letters, numbers, underscores
          const key = url.slice('/api/store/'.length).replace(/[^a-z0-9_]/gi, '');
          if (!key) return next();

          const file = join(DATA_DIR, `${key}.json`);

          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(existsSync(file) ? readFileSync(file, 'utf-8') : 'null');
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += String(chunk); });
            req.on('end', () => {
              try { writeFileSync(file, body, 'utf-8'); } catch (_) { /* ignore */ }
              res.statusCode = 200;
              res.end('ok');
            });
            return;
          }

          next();
        });
      },
    },
  ],
});
