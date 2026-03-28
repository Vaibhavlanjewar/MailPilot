/**
 * Map API campaign.status to dashboard Badge variant + label key.
 * @param {{ status: string, scheduledAt?: string | null }} campaign
 * @returns {{ variant: string, label: string }}
 */
export function campaignUiStatus(campaign) {
  const { status, scheduledAt } = campaign;
  if (status === 'processing') {
    return { variant: 'sending', label: 'Processing' };
  }
  if (status === 'completed') {
    return { variant: 'completed', label: 'Completed' };
  }
  if (status === 'pending' && scheduledAt) {
    const t = new Date(scheduledAt).getTime();
    if (!Number.isNaN(t) && t > Date.now()) {
      return { variant: 'scheduled', label: 'Scheduled' };
    }
  }
  return { variant: 'draft', label: 'Pending' };
}

/**
 * @param {object} c — lean campaign from API
 */
export function mapCampaignToTableRow(c) {
  const { variant, label } = campaignUiStatus(c);
  const date = c.updatedAt || c.createdAt;
  return {
    id: c._id,
    name: c.name,
    status: variant,
    statusLabel: label,
    sent: c.stats?.sent ?? 0,
    date: typeof date === 'string' ? date : date?.toISOString?.() || '',
  };
}
