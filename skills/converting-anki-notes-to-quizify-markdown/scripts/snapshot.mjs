// Capture a deck's full state BEFORE any in-place conversion, to be used as:
//   1. a backup (every note's raw field content), and
//   2. the baseline for scripts/verify.mjs's scheduling comparison.
//
// Usage:
//   node snapshot.mjs <deckName>
// Writes snapshot.json in the current directory:
//   { notes: [{id, model, tags, front, back}], cards: [{nid, cid, type, queue, ivl}] }

import { mcpCall } from './mcp.mjs';
import fs from 'node:fs';

const deckName = process.argv[2];
if (!deckName) {
  console.error('usage: node snapshot.mjs <deckName>');
  process.exit(2);
}

const found = await mcpCall('find_notes', { query: `deck:"${deckName}"`, limit: 200 });
const ids = found.noteIds || [];
console.log(`notes: ${ids.length}`);

const notes = [];
for (let i = 0; i < ids.length; i += 25) {
  const info = await mcpCall('notes_info', { notes: ids.slice(i, i + 25) });
  for (const n of info.notes || []) {
    notes.push({
      id: n.noteId,
      model: n.modelName,
      tags: n.tags,
      front: n.fields.Front?.value,
      back: n.fields.Back?.value,
    });
  }
}

const stats = await mcpCall('cards_stats', { deck: deckName });
const cards = (stats.cards || []).map((c) => ({ nid: c.nid, cid: c.cid, type: c.type, queue: c.queue, ivl: c.ivl }));

fs.writeFileSync('snapshot.json', JSON.stringify({ notes, cards }, null, 2));
console.log(`wrote snapshot.json: ${notes.length} notes, ${cards.length} cards`);