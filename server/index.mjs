import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.mjs';
import { createApi } from './api.mjs';

export async function startServer({ port = 5178, databasePath = 'data/siesie.sqlite', dev = false, testMode = false } = {}) {
  const db = openDatabase(databasePath);
  const api = createApi(db, { testMode });
  let vite = null;
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    if (req.url?.split('?')[0].startsWith('/api/')) return api(req, res);
    if (vite) return vite.middlewares(req, res);
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
      const file = await stat(path).then((s) => s.isFile() ? path : resolve(root, 'index.html')).catch(() => resolve(root, 'index.html'));
      const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png', '.jpg':'image/jpeg' };
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Run npm run build before preview.'); }
  });
  if (dev) vite = await (await import('vite')).createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  return { server, db, close: async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)); await vite?.close(); db.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === 'production' && process.env.SIESIE_TEST_MODE !== '0') throw new Error('Do not expose demonstration sign-in in production.');
  const app = await startServer({ port: Number(process.env.PORT || 5178), databasePath: process.env.SIESIE_DB_PATH || 'data/siesie.sqlite', dev: process.argv.includes('--dev'), testMode: process.env.SIESIE_TEST_MODE === '1' || (process.env.SIESIE_TEST_MODE !== '0' && process.argv.includes('--test-mode')) });
  console.log(`Siesie running at http://127.0.0.1:${app.server.address().port} (local test slice)`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
