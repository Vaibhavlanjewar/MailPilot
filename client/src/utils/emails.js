const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Extract unique valid emails from pasted text or CSV-like content.
 * @param {string} text
 * @returns {string[]}
 */
export function extractEmailsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const parts = text.split(/[\n,;\t]+/).map((s) => s.trim().toLowerCase());
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    if (!p || !EMAIL_RE.test(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/**
 * Merge unique emails from existing text and new CSV text (one per line in result).
 * @param {string} existingRaw
 * @param {string} csvRaw
 * @returns {string}
 */
export function mergeEmailLists(existingRaw, csvRaw) {
  const merged = [
    ...new Set([
      ...extractEmailsFromText(existingRaw),
      ...extractEmailsFromText(csvRaw),
    ]),
  ];
  return merged.join('\n');
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
