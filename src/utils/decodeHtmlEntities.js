/**
 * Decode HTML entities commonly returned by Open Trivia DB.
 * Handles: &amp; &lt; &gt; &quot; &#039; &apos; &rsquo; &lsquo; &mdash; &ndash; etc.
 */

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018',
  '&rdquo;': '\u201D',
  '&ldquo;': '\u201C',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&nbsp;': ' ',
  '&hellip;': '\u2026',
  '&eacute;': 'é',
  '&egrave;': 'è',
  '&aacute;': 'á',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&ccedil;': 'ç',
};

export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return text;
  let decoded = text;
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}
