import { parse } from 'csv-parse/sync';
import validator from 'validator';
import { AppError } from './AppError.js';

/**
 * Expected CSV columns: email (required), name (optional), company (optional).
 * @param {Buffer|string} buffer
 * @returns {{ email: string, name?: string, company?: string }[]}
 */
export function parseContactsCsv(buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new AppError('CSV file is empty', 400);
  }

  let rows;
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    throw new AppError('Invalid CSV format', 400);
  }

  if (!rows.length) {
    throw new AppError('No rows found in CSV', 400);
  }

  const normalized = [];
  const seen = new Set();

  for (const row of rows) {
    const emailKey = Object.keys(row).find(
      (k) => k.toLowerCase() === 'email'
    );
    const nameKey = Object.keys(row).find((k) => k.toLowerCase() === 'name');
    const companyKey = Object.keys(row).find((k) => k.toLowerCase() === 'company');

    const rawEmail = emailKey ? row[emailKey] : row.email || row.Email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (!email || !validator.isEmail(email)) {
      continue;
    }

    if (seen.has(email)) continue;
    seen.add(email);

    const name = nameKey ? String(row[nameKey] || '').trim() : '';
    const company = companyKey ? String(row[companyKey] || '').trim() : '';

    normalized.push({
      email,
      ...(name ? { name } : {}),
      ...(company ? { company } : {}),
    });
  }

  if (!normalized.length) {
    throw new AppError('No valid email addresses found in CSV', 400);
  }

  return normalized;
}
