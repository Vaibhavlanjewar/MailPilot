import Card, { CardHeader } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';

const steps = [
  {
    title: '1. Connect Gmail from profile menu',
    description:
      'Open the top-right profile menu, use the Connect with Gmail item above Log out, and watch the red or green status bullet.',
    to: '/app',
    action: 'Open dashboard',
  },
  {
    title: '2. Set sender details',
    description:
      'In Settings, choose your Gmail address and sender name for campaign emails, then save sender settings.',
    to: '/app/settings',
    action: 'Open settings',
  },
  {
    title: '3. Add audience',
    description:
      'Import contacts from CSV or add clients manually from Contacts page.',
    to: '/app/contacts',
    action: 'Manage contacts',
  },
  {
    title: '4. Create template',
    description:
      'Create reusable email templates with placeholders like {{name}} and {{email}}.',
    to: '/app/templates',
    action: 'Open templates',
  },
  {
    title: '5. Build campaign',
    description:
      'Create a campaign, select contacts, compose content, and review recipients before sending.',
    to: '/app/campaigns/new',
    action: 'Create campaign',
  },
  {
    title: '6. Send and track',
    description:
      'Send now or schedule. Track sent and failed counts from Dashboard, Campaigns, and Analytics.',
    to: '/app/analytics',
    action: 'View analytics',
  },
];

function FlowBlock({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-surface-border bg-white px-3 py-3 text-center shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{title}</p>
      <p className="mt-1 text-sm text-slate-700">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-lg text-slate-400">-&gt;</div>;
}

export default function HowToUse() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="How To Use MailPilot"
          description="Step-by-step product guide with flow diagram: connect email, create campaign, send, and track results."
        />

        <div className="space-y-5">
          <div className="rounded-2xl border border-surface-border bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">System flow diagram</p>

            <div className="hidden gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <FlowBlock title="Account" subtitle="Profile menu + sender settings" />
              <Arrow />
              <FlowBlock title="Email Connect" subtitle="Profile menu status bullet + Gmail OAuth" />
              <Arrow />
              <FlowBlock title="Audience" subtitle="Contacts from CSV / manual" />
              <Arrow />
              <FlowBlock title="Campaign" subtitle="Template + recipients + send" />
            </div>

            <div className="hidden gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr]">
              <FlowBlock title="Queue + Worker" subtitle="Jobs process sends and retries" />
              <Arrow />
              <FlowBlock title="Tracking" subtitle="Dashboard, Campaign status, Analytics" />
            </div>

            <div className="space-y-2 lg:hidden">
              <FlowBlock title="Account" subtitle="Profile menu + sender settings" />
              <Arrow />
              <FlowBlock title="Email Connect" subtitle="Profile menu status bullet + Gmail OAuth" />
              <Arrow />
              <FlowBlock title="Audience" subtitle="Contacts from CSV / manual" />
              <Arrow />
              <FlowBlock title="Campaign" subtitle="Template + recipients + send" />
              <Arrow />
              <FlowBlock title="Queue + Worker" subtitle="Jobs process sends and retries" />
              <Arrow />
              <FlowBlock title="Tracking" subtitle="Dashboard, Campaign status, Analytics" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((step) => (
              <div key={step.title} className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                <div className="mt-3">
                  <LinkButton to={step.to} variant="secondary" size="sm">
                    {step.action}
                  </LinkButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
