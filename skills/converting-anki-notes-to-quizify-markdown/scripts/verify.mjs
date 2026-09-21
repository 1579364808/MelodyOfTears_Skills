// Verify an in-place note-type + field conversion against a saved snapshot.
// Re-reads every note in a deck and compares Front/Back byte-for-byte against
// an expected JSON file, then re-checks per-card scheduling against the
// pre-change baseline.
//
// Usage:
//   node verify.mjs <deckName> <expected.json> <baseline.json>
//
//   <expected.json>  : array of { id, front, back } — the exact content the fields should hold
//   <baseline.json>  : array of { nid, cid, type, queue, ivl } — captured BEFORE the change
//                      (see scripts/snapshot.mjs). Scheduling check is skipped if absent.

import { mcpCall } from './mcp.mjs';
import fs from 'node:fs';

const [deckName, expectedFile, baselineFile] = process.argv.slice(2);
if (!deckName || !expectedFile) {
  console.error('usage: node verify.mjs <deckName> <expected.json> [baseline.json]');
  process.exit(2);
}

const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));
const byId = new Map(expected.map((n) => [n.id, n]));

const found = await mcpCall('find_notes', { query: `deck:"${deckName}"`, limit: 200 });
const ids = found.noteIds || [];
console.log(`notes in "${deckName}": ${ids.length} | expected: ${expected.length}`);

const fieldBad = [];
let modelOk = 0;
for (let i = 0; i < ids.length; i += 25) {
  const info = await mcpCall('notes_info', { notes: ids.slice(i, i + 25) });
  for (const n of info.notes || []) {
    const exp = byId.get(n.noteId);
    if (n.modelName === 'Quizify Markdown') modelOk++;
    if (!exp) { fieldBad.push([n.noteId, 'missing-from-expected']); continue; }
    if (n.fields.Front.value.trim() !== exp.front.trim()) fieldBad.push([n.noteId, 'front', n.fields.Front.value.length, exp.front.length]);
    if (n.fields.Back.value.trim() !== exp.back.trim()) fieldBad.push([n.noteId, 'back', n.fields.Back.value.length, exp.back.length]);
  }
}
console.log(`model = Quizify Markdown: ${modelOk}`);
console.log(`field mismatches: ${fieldBad.length}`, JSON.stringify(fieldBad.slice(0, 5)));

// Scheduling comparison (only when a baseline was captured before the change).
let baseline = null;
if (baselineFile) {
  try { baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')); } catch { baseline = null; }
}
if (baseline) {
  const baseByCid = new Map(baseline.map((c) => [c.cid, c]));
  const stats = await mcpCall('cards_stats', { deck: deckName });
  const bad = [];
  for (const c of stats.cards || []) {
    const want = baseByCid.get(c.cid);
    if (!want) continue;
    if (want.type !== c.type || want.queue !== c.queue || want.ivl !== c.ivl) {
      bad.push([c.cid, `type ${want.type}->${c.type}`, `ivl ${want.ivl}->${c.ivl}`]);
    }
  }
  const present = baseline.filter((b) => (stats.cards || []).some((c) => c.cid === b.cid)).length;
  console.log(`cards still present: ${present}/${baseline.length}`);
  console.log(`scheduling mismatches: ${bad.length}`, JSON.stringify(bad.slice(0, 5)));
} else {
  console.log('(no baseline.json — skipped scheduling comparison)');
}