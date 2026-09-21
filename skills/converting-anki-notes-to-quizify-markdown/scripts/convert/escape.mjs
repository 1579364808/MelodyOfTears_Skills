// HTML-escape the field content for editor-safe storage in Anki.
// Quizify's render path unescapes these before Markdown parsing, so the rendered
// card is identical while the rich-text editor can no longer corrupt the content.
//
// Escape ONLY these three chars, in this order:
//   & -> &amp;   < -> &lt;   > -> &gt;
// (Leave quotes and everything else alone — they don't affect the editor round-trip.)

export function escapeForAnki(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Reverses escapeForAnki — must reproduce the input exactly (round-trip check).
export function unescapeFromAnki(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Guard: a field is editor-safe when it contains no bare <, >, or &.
export function hasBareHtmlChars(s) {
  return /[<>]/.test(s) || /&(?!amp;|lt;|gt;|quot;|#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z]+;)/.test(s);
}