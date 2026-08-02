import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Placeholder for a feature that is built but intentionally gated off until
 * it's verified end-to-end (see client/src/config/features.js).
 */
export default function ComingSoon({ title, description, note }) {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="rounded-2xl border border-surface-border bg-surface p-8 text-center">
        <span className="inline-block rounded-full bg-app-muted px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-app-muted">
          Coming soon
        </span>
        <h1 className="mt-4 text-xl font-bold text-app">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-app-muted">{description}</p>
        {note && (
          <p className="mx-auto mt-4 max-w-md rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-app-muted">
            {note}
          </p>
        )}
        <Link
          to="/app/interview-prep"
          className="mt-6 inline-block rounded-xl bg-app-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to Interview Prep
        </Link>
      </div>
    </div>
  );
}
