/* Post-processing pass over turndown output.
 *
 * IMPORTANT: turndown escapes text nodes, so in its RAW output
 *   source "\("  -> "\\(" (2 backslashes)      source "[" -> "\" + "[" (1 backslash)
 *   source "\["  -> "\\\[" (3 backslashes)     source "[[A]]" -> "\" + "[" + "\" + "[" + A ...
 * LaTeX must therefore be recognised BEFORE the doubled backslashes are collapsed,
 * otherwise turndown's escaped brackets ("dp\[i\]") are mistaken for math.
 *
 * Every regex below is built with new RegExp + String.fromCharCode so that no
 * escaping level can be lost while the file is edited.
 */
const BS = String.fromCharCode(92); // backslash
const DL = String.fromCharCode(36); // dollar
const LB = String.fromCharCode(91); // [
const RB = String.fromCharCode(93); // ]
const LP = String.fromCharCode(40); // (
const RP = String.fromCharCode(41); // )
const BT = String.fromCharCode(96); // backtick

const B = (n) => BS.repeat(n);
const ANY = '([^]+?)'; // any chars incl. newlines

// raw turndown forms
const reDispMathRaw = new RegExp(B(7) + LB + ANY + B(7) + RB, 'g'); // \[ ... \]
const reInlineMathRaw = new RegExp(B(5) + LP + ANY + B(5) + RP, 'g'); // \( ... \)
// escaped-bracket wiki links: \[\[A\]\] / \[\[A|B\]\]
const NOT_BR = '[^' + BS + LB + BS + RB + ']+?';
const reWikiEsc = new RegExp(BS + LB + BS + LB + '(' + NOT_BR + ')' + BS + RB + BS + RB, 'g');
const reWikiPlain = new RegExp(BS + LB + BS + LB + '(' + NOT_BR + ')' + BS + RB + BS + RB, 'g');
const reEmptyHeading = new RegExp('^#{1,6}[ ' + BS + 't]*(?=' + BS + 'n|' + DL + ')', 'gm');
const reHeadingCount = new RegExp('^(#{1,6})[ ' + BS + 't]+' + BS + 'S', 'gm');
const reHeadingShift = new RegExp('^(#{1,6})(?=[ ' + BS + 't]+' + BS + 'S)', 'gm');
const reLeadingNumber = new RegExp('^' + BS + 's*' + BS + 'd+');
const FENCE_LINE = /^`{3,}/;

export function splitFences(md) {
  const parts = [];
  const lines = md.split('\n');
  let cur = '';
  let inCode = false;
  let fenceMark = '';
  for (const line of lines) {
    if (!inCode && FENCE_LINE.test(line)) {
      inCode = true;
      fenceMark = line.match(/^`+/)[0];
      if (cur) { parts.push({ code: false, t: cur }); cur = ''; }
      cur = line + '\n';
    } else if (inCode && line.trim() === fenceMark) {
      cur += line + '\n';
      parts.push({ code: true, t: cur });
      cur = '';
      inCode = false;
      fenceMark = '';
    } else {
      cur += line + '\n';
    }
  }
  if (cur) parts.push({ code: inCode, t: cur });
  return parts;
}

function wikitext(x) {
  const parts = x.split('|');
  const chosen = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return chosen.split(BS).join('');
}

function shiftHeadings(s) {
  const levels = [...s.matchAll(reHeadingCount)].map((m) => m[1].length);
  if (!levels.length) return s;
  const delta = 2 - Math.min(...levels);
  return s.replace(reHeadingShift, (m, h) => '#'.repeat(Math.min(6, Math.max(1, h.length + delta))));
}

export function postFix(md) {
  return splitFences(md)
    .map((p) => {
      if (p.code) return p.t;
      let s = p.t;
      s = s.replace(reDispMathRaw, (m, x) => '\n' + DL + DL + '\n' + x.trim() + '\n' + DL + DL + '\n');
      s = s.replace(reInlineMathRaw, (m, x) => DL + x.trim() + DL);
      s = s.replace(reWikiEsc, (m, x) => wikitext(x));
      s = s.replace(reWikiPlain, (m, x) => wikitext(x));
      s = s.split(B(2)).join(BS); // collapse turndown's doubled backslashes
      s = s
        .split('\n')
        .map((line) => {
          if (reLeadingNumber.test(line) && line.slice(0, 24).includes(BS + '.')) return line;
          return line.split(BS + '.').join('.');
        })
        .join('\n');
      s = s.replace(reEmptyHeading, '');
      return shiftHeadings(s);
    })
    .join('');
}

export { BS, DL, LB, RB, LP, RP, BT };