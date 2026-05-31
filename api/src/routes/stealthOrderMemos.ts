import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { stealthOrderMemos } from '@winnr-trade/common';
import { inArray } from 'drizzle-orm';

export const stealthOrderMemosRouter = new Hono();

/**
 * GET /api/v1/stealth-order-memos
 *
 * Query stealth order memos by one or more detection tags.
 * Detection tags are passed as a comma-separated query param.
 *
 * Example:
 *   GET /api/v1/stealth-order-memos?detection_tags=0xabc,0xdef
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       "0xabc": { commitment, stealth_address, detection_tag, timestamp, tx_hash },
 *       "0xdef": null,
 *     }
 *   }
 */
stealthOrderMemosRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      detection_tags: z
        .string()
        .min(1, 'At least one detection tag is required')
        .transform((val) =>
          val
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ),
    }),
  ),
  async (c) => {
    const { detection_tags } = c.req.valid('query');

    try {
      const rows = await db.inner
        .select()
        .from(stealthOrderMemos)
        .where(inArray(stealthOrderMemos.detection_tag, detection_tags));

      // Index rows by detection tag — one memo per tag at most
      const rowByTag = new Map(rows.map((row) => [row.detection_tag, row]));

      // Preserve all requested keys; null when no memo exists for that tag
      type MemoRow = (typeof rows)[number];
      const data: Record<string, MemoRow | null> = Object.fromEntries(
        detection_tags.map((tag) => [tag, rowByTag.get(tag) ?? null]),
      );

      return c.json({ success: true, data });
    } catch (error) {
      console.error('Failed to fetch stealth order memos:', error);
      return c.json({ success: false, error: 'Internal Server Error' }, 500);
    }
  },
);

