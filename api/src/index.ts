import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { marketsRouter } from './routes/markets';
import { tradesRouter } from './routes/trades';
import { positionsRouter } from './routes/positions';
import { notesRouter } from './routes/notes';
import { stealthOrderMemosRouter } from './routes/stealthOrderMemos';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Health check
app.get('/status', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Mount Domains
app.route('/api/v1/markets', marketsRouter);
app.route('/api/v1/trades', tradesRouter);
app.route('/api/v1/positions', positionsRouter);
app.route('/api/v1/notes', notesRouter);
app.route('/api/v1/stealth-order-memos', stealthOrderMemosRouter);

console.log(`Server starting on port ${process.env.API_PORT || 4000}`);

export default {
  port: process.env.API_PORT || 4000,
  fetch: app.fetch,
};
