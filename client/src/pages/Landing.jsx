import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "../components/ui/ThemeToggle";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    title: "AI-Powered Personalized Cold Emails",
    text: "Designed an AI-powered system to generate personalized cold emails, improving outreach efficiency for job seekers and marketers.",
  },
  {
    title: "Scalable Bulk Email Automation",
    text: "Built a scalable bulk email module with CSV import and dynamic templating, enabling automated and customized campaigns at scale.",
  },
  {
    title: "Secure High-Deliverability Sending",
    text: "Integrated API-based email delivery (OAuth/AWS SES) with SPF/DKIM authentication, ensuring secure communication, high deliverability, and reduced spam rates.",
  },
];

const testimonials = [
  {
    quote:
      "MailPilot transformed my cold outreach—helped me connect with recruiters and land a Software Engineer opportunity at Deutsche Bank. Simple, structured, and highly effective. Huge thanks to the team!",
    name: "Vaibhav Lanjewar",
    role: "Deutsche Bank Opportunity",
  },
  {
    quote:
      "MailPilot played a key role in my internship journey—helped me land a Software Engineer Intern role at Holtec Asia through targeted cold emails. Saves time, boosts responses, and makes outreach seamless. Highly recommended!",
    name: "Pankaj Shahare",
    role: "Holtec Asia Internship",
  },
];

const upcomingFeatures = [
  {
    title: "Email open tracking",
    text: "Track which recipient opened your email and how many times each email was opened.",
  },
  {
    title: "Document and link tracking",
    text: "Track whether shared documents (like resumes) and links were opened or clicked.",
  },
  {
    title: "Follow-up reminders",
    text: "Get smart reminders for pending follow-ups so no important lead goes cold.",
  },
  {
    title: "Per-campaign analytics dashboard",
    text: "View campaign-level analytics with clear performance insights for every send.",
  },
];

const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSff_YjvIVpgc6umn0zl3mihp7dvTYztqREbj_HElb70wCpXaw/viewform?usp=publish-editor';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const velocityRef = useRef(null);
  const [velocityAnimCycle, setVelocityAnimCycle] = useState(0);

  function handleUpcomingCardClick(title) {
    if (title !== "Email open tracking") return;
    if (!isAuthenticated) return;
    navigate("/app/email-tracking");
  }

  useEffect(() => {
    const node = velocityRef.current;
    if (!node) return;

    let wasVisible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wasVisible) {
          setVelocityAnimCycle((n) => n + 1);
          wasVisible = true;
        }
        if (!entry.isIntersecting) {
          wasVisible = false;
        }
      },
      {
        threshold: 0.35,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.24)_0%,_rgba(34,211,238,0.08)_45%,_transparent_72%)]" />
        <div className="absolute right-[-8rem] top-[24rem] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,_rgba(34,211,238,0.16)_0%,_transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-[color:var(--surface-border)]/70 bg-[color:var(--bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-app-gradient text-sm font-semibold text-white shadow-app-soft">
              MP
            </span>
            <span className="text-base font-semibold tracking-tight">
              MailPilot
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--text-secondary)] md:flex">
            <a
              href="#features"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Features
            </a>
            <a
              href="#upcoming"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Upcoming
            </a>
            <a
              href="#testimonials"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Testimonials
            </a>
            <a
              href={googleFormUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Feedback
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" />
            <Link
              to={isAuthenticated ? "/app" : "/login"}
              className="hidden rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm transition hover:shadow md:inline-flex"
            >
              {isAuthenticated ? "Open app" : "Log in"}
            </Link>
            <Link
              to={isAuthenticated ? "/app" : "/register"}
              className="inline-flex rounded-xl bg-app-gradient px-4 py-2 text-sm font-semibold text-white shadow-app-soft transition hover:-translate-y-0.5 hover:brightness-110"
            >
              {isAuthenticated ? "Go to dashboard" : "Start free"}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:pt-24">
          <div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Land More Opportunities with Smarter Cold Emails
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
              MailPilot empowers job seekers to create, personalize, and track
              high-impact outreach effortlessly—helping you connect with
              recruiters faster and turn conversations into real opportunities.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? "/app/campaigns/new" : "/register"}
                className="inline-flex rounded-2xl bg-app-gradient px-5 py-3 text-sm font-semibold text-white shadow-app-elevated transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Launch your first campaign
              </Link>
              <Link
                to={isAuthenticated ? "/app/analytics" : "/login"}
                className="inline-flex rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
              >
                View live demo
              </Link>
            </div>
          </div>

          <div
            ref={velocityRef}
            className="animate-velocity-card rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] p-5 shadow-app-elevated sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Campaign Velocity</p>
              <p className="rounded-full bg-[color:rgba(var(--secondary-rgb),0.14)] px-3 py-1 text-xs font-semibold text-[var(--secondary)]">
                Realtime
              </p>
            </div>
            <div className="space-y-3">
              {[78, 64, 92, 70, 88].map((v, i) => (
                <div key={`${velocityAnimCycle}-${i}`} className="animate-velocity-row" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Week {i + 1}</span>
                    <span>{v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[color:var(--surface-border)]/70">
                    <div
                      className="animate-velocity-bar h-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"
                      style={{ width: `${v}%`, animationDelay: `${200 + i * 120}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Core Features
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] p-6 shadow-app-soft transition hover:-translate-y-0.5 hover:shadow-app-elevated"
              >
                <h3 className="text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="upcoming"
          className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Upcoming Features
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingFeatures.map((item) => (
              <article
                key={item.title}
                className="relative rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] p-6 shadow-app-soft transition hover:-translate-y-0.5 hover:shadow-app-elevated"
                onClick={() => handleUpcomingCardClick(item.title)}
                role={item.title === "Email open tracking" && isAuthenticated ? "button" : undefined}
                tabIndex={item.title === "Email open tracking" && isAuthenticated ? 0 : undefined}
                onKeyDown={(event) => {
                  if (item.title !== "Email open tracking" || !isAuthenticated) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate("/app/email-tracking");
                  }
                }}
                aria-label={
                  item.title === "Email open tracking" && isAuthenticated
                    ? "Open Email Tracking dashboard"
                    : undefined
                }
                style={{
                  cursor:
                    item.title === "Email open tracking" && isAuthenticated
                      ? "pointer"
                      : "default",
                }}
              >
                <span
                  className={[
                    'absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    item.title === 'Email open tracking'
                      ? 'border-[color:rgba(var(--secondary-rgb),0.45)] bg-[color:rgba(var(--secondary-rgb),0.14)] text-[var(--secondary)]'
                      : 'border-[color:rgba(var(--primary-rgb),0.4)] bg-[color:rgba(var(--primary-rgb),0.12)] text-[var(--primary)]',
                  ].join(' ')}
                >
                  <span className="relative inline-flex h-2 w-2">
                    {item.title === 'Email open tracking' ? (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                    ) : null}
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                  </span>
                  {item.title === 'Email open tracking' ? 'Live-Now' : 'Coming-Soon'}
                </span>
                <h3 className="pr-28 text-lg font-semibold tracking-tight">
                  <span>{item.title}</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="testimonials"
          className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Testimonials
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {testimonials.map((item) => (
              <blockquote
                key={item.name}
                className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] p-6 shadow-app-soft transition hover:-translate-y-0.5 hover:shadow-app-elevated"
              >
                <p className="text-base leading-relaxed">{item.quote}</p>
                <footer className="mt-5 text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {item.name}
                  </span>
                  <span> - {item.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--surface-border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[var(--text-secondary)]">
            Copyright © {new Date().getFullYear()} MailPilot Team. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
