import { Link } from "react-router-dom";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function ContactUs() {
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
            <span className="text-base font-semibold tracking-tight">MailPilot</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" />
            <Link
              to="/"
              className="inline-flex rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm transition hover:shadow"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface)] p-6 shadow-app-elevated sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get in Touch</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)] sm:text-base">
            Have any questions or need more information?
          </p>

          <p className="mt-6 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            We&apos;re here to help! Whether you&apos;re looking for support, have a business inquiry, or just want to say hello, we&apos;d love to hear from you.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Our team is committed to responding to all queries at the earliest possible time.
          </p>

          <div className="mt-7 border-t border-[color:var(--surface-border)] pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Contact Information</h2>

            <div className="mt-4 space-y-5 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Email:</p>
                <a
                  href="mailto:mailpilot.io@gmail.com"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  mailpilot.io@gmail.com
                </a>
              </div>

              <div>
                <p className="font-medium text-[var(--text-primary)]">Address:</p>
                <address className="not-italic">
                  Veerannapalya (Near Nagawara / Manyata Tech Park),
                  <br />
                  Arabic College Post,
                  <br />
                  Bengaluru North Taluk,
                  <br />
                  Bengaluru - 560045,
                  <br />
                  Karnataka, India
                </address>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
