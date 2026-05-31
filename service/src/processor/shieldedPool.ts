import { EventSchema } from '@winnr-trade/common';
import { notes } from '@winnr-trade/common';
import type { NoteEventPayload } from '../types/events';
import { logger } from '../logger';
import { EventModule, ShieldedPoolEventType } from '../configs/constants';

function normalizeNoteKind(kind: unknown): 'register_account' | 'deposit' | 'withdraw' {
  if (kind === 'register_account' || kind === 'deposit' || kind === 'withdraw') {
    return kind;
  }
  throw new Error(`Unknown NoteKind: ${JSON.stringify(kind)}`);
}

function formatMemo(memo: unknown): string {
  if (Array.isArray(memo)) {
    return '0x' + Buffer.from(memo).toString('hex');
  }
  if (typeof memo === 'string') {
    if (memo.startsWith('0x')) {
      return memo;
    }
    if (/^[0-9a-fA-F]+$/.test(memo)) {
      return '0x' + memo;
    }
    return '0x' + Buffer.from(memo, 'utf8').toString('hex');
  }
  if (Buffer.isBuffer(memo)) {
    return '0x' + memo.toString('hex');
  }
  return '';
}

export async function processShieldedPoolEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    if (event.module !== EventModule.SHIELDED_POOL) { continue; }

    const payload: any = event.value;

    if (event.key === ShieldedPoolEventType.NOTE) {
      const noteData = payload.Note || payload.note || payload;
      await processNoteEvent(db, noteData as NoteEventPayload, event);
    } else {
      logger.warn(`Unknown shielded pool event type: ${event.key}`);
    }
  }
}

async function processNoteEvent(
  db: any,
  payload: NoteEventPayload,
  event: EventSchema
) {
  try {
    const kind = normalizeNoteKind(payload.kind);
    const commitment = String(payload.commitment);
    const nullifier = String(payload.nullifier);
    const amount = Number(payload.amount);
    const leaf_index = Number(payload.leaf_index);
    const memo = formatMemo(payload.memo);

    await db.insert(notes).values({
      kind,
      commitment,
      nullifier,
      amount,
      leaf_index,
      memo,
      timestamp: Number(payload.timestamp),
      tx_hash: event.txHash,
    });

    logger.info(`Note indexed: kind=${kind} commitment=${commitment} nullifier=${nullifier} amount=${amount} leaf_index=${leaf_index}`);
  } catch (err) {
    logger.error(`Failed to process note event.`, err);
  }
}
