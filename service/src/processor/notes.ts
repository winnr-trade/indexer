import { EventSchema } from '@winnr-trade/common';
import { notes } from '@winnr-trade/common';
import { logger } from '../logger';

const noteKindMap: Record<string, 'create_account' | 'deposit' | 'withdraw'> = {
  CreateAccount: 'create_account',
  Deposit: 'deposit',
  Withdraw: 'withdraw',
  create_account: 'create_account',
  deposit: 'deposit',
  withdraw: 'withdraw',
};

function normalizeNoteKind(kind: any): 'create_account' | 'deposit' | 'withdraw' {
  let kindStr = '';
  if (typeof kind === 'string') {
    kindStr = kind;
  } else if (typeof kind === 'object' && kind !== null) {
    kindStr = Object.keys(kind)[0];
  }
  const normalized = noteKindMap[kindStr];
  if (!normalized) {
    throw new Error(`Unknown NoteKind: ${JSON.stringify(kind)}`);
  }
  return normalized;
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

export async function processNoteEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    try {
      const payload: any = event.value;
      const noteData = payload.Note || payload.note || payload;
      
      const kind = normalizeNoteKind(noteData.kind);
      const commitment = String(noteData.commitment);
      const nullifier = String(noteData.nullifier);
      const amount = Number(noteData.amount);
      const memo = formatMemo(noteData.memo);
      
      await db.insert(notes).values({
        kind,
        commitment,
        nullifier,
        amount,
        memo,
        timestamp: event.timestamp,
        tx_hash: event.txHash,
      });
      
      logger.info(`Note indexed: kind=${kind} commitment=${commitment} nullifier=${nullifier} amount=${amount}`);
    } catch (err) {
      logger.error(`Failed to process note event.`, err);
    }
  }
}
