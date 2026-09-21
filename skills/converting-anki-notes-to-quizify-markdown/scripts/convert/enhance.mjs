/* Quizify enhancement: put code sections behind a collapsible Quizify block
 * (``::: title ... :::``) so the Java "背诵模板" can be recalled first and
 * expanded afterwards.
 *
 * opts.onlyCodeTitled: only collapse sections whose heading looks like a code
 * section (Java/代码/模板/实现/code). Without it, every section containing a
 * fenced block is collapsed. */

const FENCE = /^`{3,}/;
const HEADING = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/;
const CODE_TITLE = /(java|code|代码|模板|实现)/i;

export function enhance(md, opts = {}) {
  const onlyCodeTitled = !!opts.onlyCodeTitled;
  const lines = md.split('\n');
  const sections = [];
  let cur = { level: null, title: null, body: [] };
  let inFence = false;
  for (const line of lines) {
    const fenceLine = FENCE.test(line);
    if (fenceLine) inFence = !inFence;
    if (!inFence && !fenceLine) {
      const m = HEADING.exec(line);
      if (m) {
        sections.push(cur);
        cur = { level: m[1].length, title: m[2].trim(), body: [] };
        continue;
      }
    }
    cur.body.push(line);
  }
  sections.push(cur);

  const out = [];
  for (const s of sections) {
    const body = s.body.join('\n').replace(/^\s+|\s+$/g, '');
    if (s.title == null) {
      if (body) out.push(body);
      continue;
    }
    const hasFence = FENCE.test(body) || /^`{3,}/m.test(body);
    const collapse = hasFence && (!onlyCodeTitled || CODE_TITLE.test(s.title));
    if (collapse) {
      out.push(`::: ${s.title}`);
      out.push(body.replace(/^-{3,}[ \t]*$/gm, '').replace(/\n{3,}/g, '\n\n').trim());
      out.push(':::');
    } else {
      out.push(`${'#'.repeat(s.level)} ${s.title}`);
      if (body) out.push(body);
    }
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '').replace(/\s+$/, '') + '\n';
}