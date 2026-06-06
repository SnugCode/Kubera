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
