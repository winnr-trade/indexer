import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { notes } from '@winnr-trade/common';
import { eq, desc, and, gte, asc } from 'drizzle-orm';

export const notesRouter = new Hono();

// GET /api/v1/notes - List notes with filters
notesRouter.get('/', zValidator('query', z.object({
  kind: z.enum(['register_account', 'deposit', 'withdraw']).optional(),
  commitment: z.string().optional(),
  from_index: z.coerce.number().min(0).optional(),
  page: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(50),
})), async (c) => {
  const { kind, commitment, from_index, page, limit } = c.req.valid('query');
  const offset = page * limit;

  try {
    const conditions = [];
    if (kind) {
      conditions.push(eq(notes.kind, kind));
    }
    if (commitment) {
      conditions.push(eq(notes.commitment, commitment));
    }
    if (from_index !== undefined) {
      conditions.push(gte(notes.leaf_index, from_index));
    }

    const orderBy = from_index !== undefined ? asc(notes.leaf_index) : desc(notes.timestamp);

    const data = await db.inner.select()
      .from(notes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
    }, 500);
  }
});

// GET /api/v1/notes/leaves - Fetch only commitment and leaf_index sorted by leaf_index
notesRouter.get('/leaves', zValidator('query', z.object({
  page: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(5000).default(1000),
})), async (c) => {
  const { page, limit } = c.req.valid('query');
  const offset = page * limit;

  try {
    const data = await db.inner.select({
      commitment: notes.commitment,
      leaf_index: notes.leaf_index,
    })
    .from(notes)
    .orderBy(notes.leaf_index)
    .limit(limit)
    .offset(offset);

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to fetch tree leaves:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
    }, 500);
  }
});

// GET /api/v1/notes/commitment/:commitment - Fetch single note by commitment
notesRouter.get('/commitment/:commitment', async (c) => {
  const commitment = c.req.param('commitment');

  try {
    const data = await db.inner.select()
      .from(notes)
      .where(eq(notes.commitment, commitment))
      .limit(1);

    if (data.length === 0) {
      return c.json({
        success: false,
        error: 'Note not found',
      }, 404);
    }

    return c.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    console.error('Failed to fetch note by commitment:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
    }, 500);
  }
});
