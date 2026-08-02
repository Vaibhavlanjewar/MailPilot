import Card, { CardHeader } from "../components/ui/Card";
import { LinkButton } from "../components/ui/Button";

const outreachSteps = [
  {
    title: "1. Add your resume",
    description:
      "One resume powers everything — AI-personalised emails, interview prep, and your roadmap. Upload a PDF/Word file or paste text.",
    to: "/app/resume",
    action: "Add resume",
  },
  {
    title: "2. Set up sending",
    description:
      "Connect Gmail with one click, or add a Gmail App Password — either lets campaigns send as you. Nothing sends until this is done.",
    to: "/app/settings?section=gmail",
    action: "Set up sending",
  },
  {
    title: "3. Add recipients",
    description:
      "Upload a CSV (download the template if you're not sure of the format) or add people one by one from Recipients.",
    to: "/app/contacts",
    action: "Manage recipients",
  },
  {
    title: "4. Write or generate a template",
    description:
      "Write from scratch, or paste a job description and generate a template with AI — it automatically pulls in your saved resume.",
    to: "/app/templates",
    action: "Open templates",
  },
  {
    title: "5. Build a campaign",
    description:
      "A 5-step wizard: name it, pick recipients, add content, review, and choose send now or schedule.",
    to: "/app/campaigns/new",
    action: "Create campaign",
  },
  {
    title: "6. Track delivery",
    description:
      "Watch sent/failed counts live from the Dashboard, or dig into opens and per-recipient status under Delivery & Opens and Analytics.",
    to: "/app/analytics",
    action: "View analytics",
  },
];

const careerSteps = [
  {
    title: "1. Ask questions about your resume",
    description:
      "Open-ended chat grounded in your actual resume — ask what to emphasise, how to phrase a bullet, or anything else.",
    to: "/app/resume-chat",
    action: "Ask my resume",
  },
  {
    title: "2. Prepare for an interview",
    description:
      "Paste a job description to get staged practice questions, chat live with a coach that escalates difficulty as you improve, and run real code in the built-in sandbox (Python/JS free forever; C/C++/Java need Docker running locally).",
    to: "/app/interview-prep",
    action: "Open interview prep",
  },
  {
    title: "3. Build a learning roadmap",
    description:
      "Describe a target role and get a staged, roadmap.sh-style path — automatically tailored to skip what your resume shows you already know.",
    to: "/app/roadmap",
    action: "Build a roadmap",
  },
  {
    title: "4. Browse jobs",
    description:
      "Search and filter real listings, save the ones you like, or post an opening if you're hiring.",
    to: "/app/jobs",
    action: "Open job board",
  },
  {
    title: "5. Join the community",
    description:
      "Share referrals, interview experiences, and salary data. Everything you post is yours — edit or delete any time.",
    to: "/app/community",
    action: "Open community",
  },
];

function FlowBlock({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-surface-border bg-app-surface px-3 py-3 text-center shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </p>
      <p className="mt-1 text-sm text-app">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-lg text-app-muted">→</div>;
}

function StepGrid({ steps }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {steps.map((step) => (
        <div
          key={step.title}
          className="rounded-xl border border-surface-border bg-app-surface p-4 shadow-soft"
        >
          <p className="text-sm font-semibold text-app">{step.title}</p>
          <p className="mt-1 text-sm text-app-muted">{step.description}</p>
          <div className="mt-3">
            <LinkButton to={step.to} variant="secondary" size="sm">
              {step.action}
            </LinkButton>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HowToUse() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-app-gradient p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">How To Use MailPilot</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
          Two tracks: send cold outreach, and get ready for the interviews it leads to. Your
          resume is the one thing that powers both.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Outreach flow"
          description="From adding your resume to tracking who opened your email."
        />
        <div className="space-y-5">
          <div className="rounded-2xl border border-surface-border bg-default-bg p-4">
            <p className="mb-3 text-sm font-semibold text-app">System flow</p>

            <div className="hidden gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
              <FlowBlock title="Resume" subtitle="Powers personalisation" />
              <Arrow />
              <FlowBlock title="Send setup" subtitle="Connect Gmail or app password" />
              <Arrow />
              <FlowBlock title="Recipients" subtitle="CSV or manual" />
              <Arrow />
              <FlowBlock title="Template" subtitle="Written or AI-generated" />
              <Arrow />
              <FlowBlock title="Campaign" subtitle="Queue + worker send" />
              <Arrow />
              <FlowBlock title="Tracking" subtitle="Dashboard & Analytics" />
            </div>

            <div className="space-y-2 lg:hidden">
              <FlowBlock title="Resume" subtitle="Powers personalisation" />
              <Arrow />
              <FlowBlock title="Send setup" subtitle="Connect Gmail or app password" />
              <Arrow />
              <FlowBlock title="Recipients" subtitle="CSV or manual" />
              <Arrow />
              <FlowBlock title="Template" subtitle="Written or AI-generated" />
              <Arrow />
              <FlowBlock title="Campaign" subtitle="Queue + worker send" />
              <Arrow />
              <FlowBlock title="Tracking" subtitle="Dashboard & Analytics" />
            </div>
          </div>

          <StepGrid steps={outreachSteps} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Career flow"
          description="Prep for the interviews your outreach lands, using the same resume."
        />
        <StepGrid steps={careerSteps} />
      </Card>

      <Card>
        <CardHeader title="Good to know" />
        <ul className="space-y-2 text-sm text-app-muted">
          <li>
            • <span className="font-semibold text-app">One resume at a time.</span> Uploading a
            new one replaces the old — its search index and any attached file are replaced too,
            nothing piles up.
          </li>
          <li>
            • <span className="font-semibold text-app">AI features degrade, never break.</span>{" "}
            Every AI-backed page falls back automatically if a provider is down — you'll see which
            engine answered, or a keyword-search fallback for resume search specifically.
          </li>
          <li>
            • <span className="font-semibold text-app">Free by default.</span> The code sandbox's
            Python and JavaScript run entirely in your browser — no server, no limits, ever. C/C++/
            Java need a local Docker sandbox running (<code className="rounded bg-default-bg px-1 py-0.5 text-xs">npm run docker:up</code>).
          </li>
        </ul>
      </Card>
    </div>
  );
}
