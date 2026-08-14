/**
 * Deterministic insertion of a Projects section and a signature block into
 * campaign/template HTML.
 *
 * Why marker comments instead of parsing the HTML to find an existing
 * "Projects" heading or sign-off line: text-pattern matching ("Thanks and
 * Regards", an <h3>Projects</h3>) breaks the moment a user rewords anything,
 * and a real DOM parse has to handle both HTML fragments (most templates)
 * and full <!DOCTYPE html> documents (the default template) differently.
 * Owning the boundary with an HTML comment sidesteps both problems: comments
 * are invisible in every mail client and in the preview, and finding/
 * replacing a known literal string is unambiguous. It also makes the action
 * idempotent — clicking "Insert" again updates the existing block in place
 * instead of appending a duplicate.
 */

const PROJECTS_START = '<!-- MAILPILOT:PROJECTS:START -->';
const PROJECTS_END = '<!-- MAILPILOT:PROJECTS:END -->';
const SIGNATURE_START = '<!-- MAILPILOT:SIGNATURE:START -->';
const SIGNATURE_END = '<!-- MAILPILOT:SIGNATURE:END -->';

const LINK_LABELS = { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', leetcode: 'LeetCode' };
const LINK_ORDER = ['linkedin', 'github', 'portfolio', 'leetcode'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Same rules the resume routes enforce server-side — kept in sync deliberately. */
export function isSafeHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(url.trim());
}

export function buildProjectsBlock(projectLinks) {
  const valid = (projectLinks || []).filter(
    (p) => p?.title?.trim() && isSafeHttpUrl(p.url),
  );
  if (!valid.length) return '';

  const items = valid
    .map(
      (p) =>
        `    <li><strong><a href="${escapeHtml(p.url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title.trim())}</a></strong></li>`,
    )
    .join('\n');

  return `${PROJECTS_START}\n  <h3>Projects</h3>\n  <ul style="padding-left: 18px; margin: 12px 0;">\n${items}\n  </ul>\n  ${PROJECTS_END}`;
}

export function buildSignatureBlock(senderName, links) {
  const name = (senderName || '').trim();
  const pills = LINK_ORDER
    .map((key) => ({ key, url: (links?.[key] || '').trim() }))
    .filter((row) => isSafeHttpUrl(row.url))
    .map(
      (row) =>
        `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${LINK_LABELS[row.key]}</a>`,
    );

  const nameLine = name ? `<strong>${escapeHtml(name)}</strong><br>\n    ` : '';
  const linksLine = pills.join(' - ');

  return `${SIGNATURE_START}\n  <p style="margin-top: 20px;">\n    Thanks and Regards,<br>\n    ${nameLine}${linksLine}\n  </p>\n  ${SIGNATURE_END}`;
}

/**
 * Replaces the marked block if one exists, otherwise inserts the new block
 * right before `anchorMarker` (if that's present), else before `</body>`
 * (full-document templates), else at the very end.
 */
function replaceOrInsert(html, startMarker, endMarker, block, anchorMarker) {
  const source = html || '';
  const startIdx = source.indexOf(startMarker);
  if (startIdx !== -1) {
    const endIdx = source.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
      return source.slice(0, startIdx) + block + source.slice(endIdx + endMarker.length);
    }
  }

  if (!block) return source; // nothing existing to remove, nothing new to add

  if (anchorMarker) {
    const anchorIdx = source.indexOf(anchorMarker);
    if (anchorIdx !== -1) {
      return `${source.slice(0, anchorIdx)}${block}\n  ${source.slice(anchorIdx)}`;
    }
  }

  const bodyCloseIdx = source.search(/<\/body\s*>/i);
  if (bodyCloseIdx !== -1) {
    return `${source.slice(0, bodyCloseIdx)}${block}\n  ${source.slice(bodyCloseIdx)}`;
  }

  return `${source.trimEnd()}\n${block}`;
}

/** Inserted before an existing signature block when both are present, so content reads: body -> projects -> sign-off. */
export function insertProjectsSection(html, projectLinks) {
  return replaceOrInsert(html, PROJECTS_START, PROJECTS_END, buildProjectsBlock(projectLinks), SIGNATURE_START);
}

export function insertSignature(html, senderName, links) {
  return replaceOrInsert(html, SIGNATURE_START, SIGNATURE_END, buildSignatureBlock(senderName, links), null);
}

export function hasProjectsBlock(html) {
  return typeof html === 'string' && html.includes(PROJECTS_START);
}

export function hasSignatureBlock(html) {
  return typeof html === 'string' && html.includes(SIGNATURE_START);
}
