import http from 'node:http';
import { setDefaultResultOrder } from 'node:dns';
import { createApiRouter } from './api/router.js';
import supabaseAdmin from './lib/supabase-admin.js';
import { createExecutionContainer } from './container/createExecutionContainer.js';

setDefaultResultOrder('ipv4first');

const port = Number(process.env.IKAMVA_API_PORT || process.env.PORT || 4178);
const host = process.env.IKAMVA_API_HOST || '127.0.0.1';

const apiRouter = createApiRouter();
const startupContainer = createExecutionContainer({ supabaseAdmin });

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection Caught]:', reason instanceof Error ? reason.message : reason);
});

async function runStartupBackfill() {
  try {
    await startupContainer.resolve('embeddingService').backfill(startupContainer.resolve('repositoryFactory').forSystem().companyKnowledge);
  } catch (error) {
    console.warn('[Backfill Warning] Non-fatal network error during startup backfill:', error?.message || error);
  }
}

void runStartupBackfill();

const server = http.createServer(async (req, res) => {
  try {
    const handled = await apiRouter(req, res);
    if (!handled && !res.writableEnded) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (error) {
    console.error('[dev-api] Unhandled error:', error);
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(port, host, () => {
  console.log(`[dev-api] listening on http://${host}:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
