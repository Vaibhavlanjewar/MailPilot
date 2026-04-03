import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';

const plans = [
  {
    name: 'Free Dev',
    price: 'Rs 0 / month',
    note: 'Default pack - free while development is in process (2 weeks).',
    features: ['Up to 100 emails/month', 'Basic templates', 'Community support'],
    cta: 'Current default',
    variant: 'secondary',
    highlighted: true,
  },
  {
    name: 'Starter',
    price: 'Rs 100 / month',
    note: 'Good for early campaigns and small lists.',
    features: ['Up to 2,000 emails/month', 'Template library', 'Basic analytics'],
    cta: 'Choose Starter',
    variant: 'primary',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: 'Rs 500 / month',
    note: 'Best for scaling outreach and team usage.',
    features: ['Up to 20,000 emails/month', 'Advanced analytics', 'Priority support'],
    cta: 'Choose Growth',
    variant: 'primary',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader
          title="Pricing"
          description="Pick a plan for your workspace. Current default is Free Dev while the product is in development."
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.highlighted ? 'ring-2 ring-app-focus border-[color:var(--primary)]' : ''}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold text-app">{plan.name}</p>
              <p className="text-2xl font-bold text-app">{plan.price}</p>
              <p className="text-sm text-app-muted">{plan.note}</p>
              <ul className="space-y-2 text-sm text-app-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
              <div className="pt-2">
                <Button type="button" variant={plan.variant} size="sm" className="w-full">
                  {plan.cta}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
