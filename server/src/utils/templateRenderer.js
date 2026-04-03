function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRecipientNameParts(recipient) {
  const rawName = normalizeText(recipient?.name);
  const email = normalizeText(recipient?.email).toLowerCase();
  const fallback = email ? email.split('@')[0] : '';
  const displayName = rawName || fallback;
  const parts = displayName.split(/\s+/).filter(Boolean);
  return {
    name: displayName,
    firstName: parts[0] || fallback,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    email,
  };
}

/**
 * Replace simple recipient tokens in strings and HTML.
 * Supported tokens: {{name}}, {{full_name}}, {{first_name}}, {{last_name}}, {{email}}.
 * @param {string | undefined | null} template
 * @param {{ name?: string, email?: string } | null | undefined} recipient
 * @returns {string}
 */
export function renderRecipientTemplate(template, recipient) {
  const input = normalizeText(template);
  if (!input) return '';

  const vars = getRecipientNameParts(recipient);
  const lookup = {
    name: vars.name,
    full_name: vars.name,
    first_name: vars.firstName,
    last_name: vars.lastName,
    email: vars.email,
  };

  return input.replace(/{{\s*([a-z_]+)\s*}}/gi, (_match, token) => {
    const key = String(token || '').toLowerCase();
    return lookup[key] ?? '';
  });
}