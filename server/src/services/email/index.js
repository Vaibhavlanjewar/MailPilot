import { env } from '../../config/env.js';
import { NodemailerProvider } from './nodemailer.provider.js';
import { SesEmailProvider } from './ses.provider.js';

let singleton;

export function getEmailProvider() {
  if (!singleton) {
    singleton =
      env.email.provider === 'ses'
        ? new SesEmailProvider()
        : new NodemailerProvider();
  }
  return singleton;
}

export function resetEmailProviderForTests() {
  singleton = undefined;
}
