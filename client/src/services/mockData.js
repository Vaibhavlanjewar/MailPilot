export const dashboardStats = {
  totalSent: 128_450,
  successRate: 98.2,
  failed: 2_341,
};

export const recentCampaigns = [
  {
    id: 'c1',
    name: 'Spring Product Launch',
    status: 'completed',
    sent: 12400,
    date: '2026-03-22',
  },
  {
    id: 'c2',
    name: 'Weekly Newsletter #42',
    status: 'sending',
    sent: 8200,
    date: '2026-03-25',
  },
  {
    id: 'c3',
    name: 'Re-engagement Drip',
    status: 'scheduled',
    sent: 0,
    date: '2026-03-29',
  },
  {
    id: 'c4',
    name: 'Black Friday Preview',
    status: 'draft',
    sent: 0,
    date: '2026-03-18',
  },
];

export const campaignsList = [
  ...recentCampaigns,
  {
    id: 'c5',
    name: 'Onboarding Sequence A',
    status: 'completed',
    sent: 45210,
    date: '2026-02-10',
  },
  {
    id: 'c6',
    name: 'Customer Win-back',
    status: 'failed',
    sent: 3100,
    date: '2026-01-28',
  },
];

export const contactsList = [
  { id: 'p1', email: 'alex.morgan@example.com', name: 'Alex Morgan', subscribed: true },
  { id: 'p2', email: 'jamie.lee@example.com', name: 'Jamie Lee', subscribed: true },
  { id: 'p3', email: 'sam.taylor@example.com', name: 'Sam Taylor', subscribed: false },
  { id: 'p4', email: 'riley.chen@example.com', name: 'Riley Chen', subscribed: true },
  { id: 'p5', email: 'casey.brown@example.com', name: 'Casey Brown', subscribed: true },
];

export const analyticsSummary = {
  openRate: 42.8,
  clickRate: 6.4,
  openSeries: [
    { label: 'Mon', value: 38 },
    { label: 'Tue', value: 41 },
    { label: 'Wed', value: 45 },
    { label: 'Thu', value: 44 },
    { label: 'Fri', value: 48 },
    { label: 'Sat', value: 36 },
    { label: 'Sun', value: 40 },
  ],
  clickSeries: [
    { label: 'Mon', value: 5.2 },
    { label: 'Tue', value: 6.1 },
    { label: 'Wed', value: 7.0 },
    { label: 'Thu', value: 6.4 },
    { label: 'Fri', value: 8.2 },
    { label: 'Sat', value: 4.9 },
    { label: 'Sun', value: 5.5 },
  ],
};

