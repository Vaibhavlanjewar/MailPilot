import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Card, { CardHeader } from './ui/Card';
import Button from './ui/Button';
import Input, { Label } from './ui/Input';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Shared feedback form, usable both signed in (Sidebar) and signed out
 * (Landing) — the backend attaches the account automatically when a valid
 * auth token is present, so this component only needs to ask for email when
 * there isn't one.
 */
export default function FeedbackModal({ onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    if (!user && !email.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/feedback', {
        email: user ? undefined : email.trim(),
        message: message.trim(),
        page: location.pathname,
      });
      toast.success("Thanks — we've got it.");
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not send feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <Card className="w-full max-w-lg">
        <CardHeader
          title="Send feedback"
          description="Bugs, ideas, anything — goes straight to the team."
        />
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!user && (
            <div>
              <Label htmlFor="feedback-email">Email</Label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="feedback-message">Message</Label>
            <textarea
              id="feedback-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={5000}
              required
              className="block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send feedback'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
