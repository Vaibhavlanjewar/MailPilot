export function formatNumber(n) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(n, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function statusLabel(status) {
  const map = {
    completed: 'Completed',
    sending: 'Sending',
    scheduled: 'Scheduled',
    draft: 'Draft',
    failed: 'Failed',
    pending: 'Pending',
    processing: 'Processing',
  };
  return map[status] || status;
}
