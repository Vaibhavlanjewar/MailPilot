const STORAGE_KEY = 'mailpilot_campaign_draft_v1';

/**
 * Session-scoped (not localStorage) so a stale draft from days ago never
 * silently reappears, but a redirect to My Resume or the Template Editor and
 * back within the same tab doesn't lose anything the user already typed.
 */
export function loadCampaignDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCampaignDraft(draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable (private browsing) — draft just won't persist.
  }
}

export function clearCampaignDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
