import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { marketsRouter } from './routes/markets';

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

console.log(`Server starting on port ${process.env.API_PORT || 4000}`);

export default {
  port: process.env.API_PORT || 4000,
  fetch: app.fetch,
};
