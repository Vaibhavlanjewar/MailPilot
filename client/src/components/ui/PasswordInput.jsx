import { useState } from 'react';
import Input from './Input';
import { cn } from '../../utils/cn';

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A8.9 8.9 0 0 1 12 6c6.5 0 10 6 10 6a17.2 17.2 0 0 1-3.3 4.2" />
      <path d="M6.6 6.7A17.5 17.5 0 0 0 2 12s3.5 6.5 10 6.5a9.8 9.8 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export default function PasswordInput({ className, inputClassName, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', inputClassName)}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-app-muted transition hover:text-app"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}
