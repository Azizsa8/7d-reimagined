import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true } as any);
dotenv.config({ quiet: true } as any);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  // Importing the app validates the knowledge base; a schema error throws here
  // and the process exits with the message (Phase 2 acceptance #1).
  const { createApp, injectNonce } = await import('./server/index.ts');
  const app = await createApp();
  const express = (await import('express')).default;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    app.get(/^(?!\/api\/).*/, async (req, res, next) => {
      try {
        const raw = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(injectNonce(html));
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(injectNonce(indexHtml));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Savannah listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Savannah failed to start:\n', err?.message || err);
  process.exit(1);
});
