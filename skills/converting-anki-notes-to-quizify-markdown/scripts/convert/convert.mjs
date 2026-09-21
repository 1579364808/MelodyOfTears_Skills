import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import domino from '@mixmark-io/domino';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

function makeService() {
  const td = new TurndownService({
    headingStyle: 'atx', hr: '---', bulletListMarker: '-', codeBlockStyle: 'fenced',
    emDelimiter: '*', strongDelimiter: '**', br: '\n', linkStyle: 'inlined',
  });
  td.use(gfm);
  td.addRule('codeBlock', {
    filter: (n) => n.nodeName === 'PRE',
    replacement: (c, n) => {
      const text = (n.textContent || '').replace(/\s+$/, '');
      const lang = n.getAttribute('data-qz-lang') || '';
      const fence = text.includes('```') ? '````' : '```';
      return `\n\n${fence}${lang}\n${text}\n${fence}\n\n`;
    },
  });
  td.addRule('coloredSpan', {
    filter: (n) => n.nodeName === 'SPAN' && /color\s*:/.test(n.getAttribute?.('style') || ''),
    replacement: (c) => (c.trim() ? `==${c.trim()}==` : c),
  });
  td.addRule('layoutTable', {
    filter: (n) => n.nodeName === 'TABLE' && !n.querySelector('th'),
    replacement: (c) => c,
  });
  td.addRule('deadLink', {
    filter: (n) => n.nodeName === 'A' && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(n.getAttribute('href') || ''),
    replacement: (c) => c,
  });
  td.addRule('centerUnwrap', { filter: ['center'], replacement: (c) => c });
  td.addRule('fontUnwrap', { filter: ['font'], replacement: (c) => c });
  return td;
}

const STRUCTURAL = ['PRE', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'CENTER', 'CODE'];
const LANG_RE = /language-([a-zA-Z0-9+#-]+)/;

export function extractCode(html) {
  const doc = domino.createDocument(`<body>${html}</body>`);
  const body = doc.body;
  const codeBlocks = [];

  const textOf = (el) => {
    const clone = el.cloneNode(true);
    Array.from(clone.querySelectorAll('br') || []).forEach((br) => br.replaceWith(doc.createTextNode('\n')));
    return decodeEntities(clone.textContent).replace(/\u00a0/g, ' ');
  };
  const langOf = (el) => {
    const cands = [el, ...Array.from(el.querySelectorAll('code') || [])];
    for (const c of cands) {
      const m = LANG_RE.exec((c.getAttribute && c.getAttribute('class')) || '');
      if (m) return m[1];
    }
    return '';
  };
  const isLayoutTable = (t) => t && t.nodeName === 'TABLE' && !t.querySelector('th');
  const looksJava = (t) => t.split('\n').length >= 2 && /[;{}]/.test(t) && /(class |public |private |protected |int |void |boolean |String |List<|Map<|return |new |if \(|for \(|while \()/.test(t);

  const canonicalize = (start) => {
    let wrapper = start;
    while (wrapper.parentElement) {
      const p = wrapper.parentElement;
      if (p.nodeName === 'BODY') break;
      if (!STRUCTURAL.includes(p.nodeName)) break;
      if (p.nodeName === 'TABLE' && !isLayoutTable(p)) break;
      wrapper = p;
    }
    const pres = Array.from(start.querySelectorAll('pre') || []);
    const text = (pres.length ? pres.map((p) => textOf(p).replace(/\s+$/, '')).join('\n') : textOf(start)).replace(/\s+$/, '');
    const lang = langOf(wrapper) || langOf(start) || (looksJava(text) ? 'java' : '');
    const canon = doc.createElement('pre');
    canon.setAttribute('data-qz-lang', lang);
    canon.textContent = text;
    codeBlocks.push({ text, lang });
    wrapper.replaceWith(canon);
  };

  for (const hl of Array.from(body.querySelectorAll('div.highlight') || [])) canonicalize(hl);

  const allPres = Array.from(body.querySelectorAll('pre') || []);
  const topPres = allPres.filter((p) => !(p.parentElement && p.parentElement.closest('pre')));
  for (const pre of topPres) {
    if (pre.querySelector('div.highlight') || pre.querySelector('table')) canonicalize(pre);
  }
  for (const pre of Array.from(body.querySelectorAll('pre') || [])) {
    if (!pre.hasAttribute('data-qz-lang')) {
      const txt = pre.textContent || '';
      pre.setAttribute('data-qz-lang', langOf(pre) || (looksJava(txt) ? 'java' : ''));
    }
    Array.from(pre.querySelectorAll('br') || []).forEach((br) => br.replaceWith(doc.createTextNode('\n')));
    pre.textContent = decodeEntities(pre.textContent).replace(/\u00a0/g, ' ').replace(/\s+$/, '');
  }
  return { body, codeBlocks };
}

function cleanup(md) {
  return md.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/^\s+|\s+$/g, '') + '\n';
}

export function convertBack(html) {
  const { body } = extractCode(html);
  return cleanup(makeService().turndown(body.innerHTML));
}

export function convertFront(html) {
  const { body } = extractCode(html);
  return cleanup(makeService().turndown(body.innerHTML));
}