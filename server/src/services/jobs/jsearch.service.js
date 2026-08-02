import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const JSEARCH_HOST = 'jsearch.p.rapidapi.com';
const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isJsearchConfigured() {
  return Boolean(env.jobs.rapidApiJsearchKey);
}

function mapEmploymentType(raw) {
  const map = {
    FULLTIME: 'Full-time',
    PARTTIME: 'Part-time',
    CONTRACTOR: 'Contract',
    INTERN: 'Internship',
  };
  return map[raw] || 'Full-time';
}

function mapWorkMode(job) {
  if (job.job_is_remote) return 'Remote';
  return 'On-site';
}

function mapExperienceLevel(job) {
  const text = `${job.job_title || ''} ${job.job_description || ''}`.toLowerCase();
  if (/\b(intern|internship)\b/.test(text)) return 'Fresher';
  if (/\b(senior|staff|principal|lead)\b/.test(text)) return 'Senior';
  if (/\b(junior|entry.level|associate)\b/.test(text)) return 'Junior';
  return 'Mid';
}

function mapSalaryRange(job) {
  if (!job.job_min_salary && !job.job_max_salary) return '';
  const currency = job.job_salary_currency || '';
  const period = job.job_salary_period ? `/${job.job_salary_period.toLowerCase()}` : '';
  const min = job.job_min_salary ? Math.round(job.job_min_salary).toLocaleString() : '';
  const max = job.job_max_salary ? Math.round(job.job_max_salary).toLocaleString() : '';
  if (min && max) return `${currency} ${min}-${max}${period}`;
  return `${currency} ${min || max}${period}`;
}

/** Pulls the top handful of keywords out of the description as a skills proxy. */
function extractSkillsGuess(description) {
  const KNOWN_SKILLS = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST', 'Kafka',
    'SQL', 'Machine Learning', 'PyTorch', 'TensorFlow',
  ];
  const text = description || '';
  return KNOWN_SKILLS.filter((skill) => new RegExp(`\\b${skill.replace(/[.+]/g, '\\$&')}\\b`, 'i').test(text)).slice(0, 8);
}

function mapJob(job) {
  const location = job.job_is_remote
    ? 'Remote'
    : [job.job_city, job.job_country].filter(Boolean).join(', ') || 'Not specified';

  return {
    externalId: job.job_id,
    externalSource: 'jsearch',
    title: job.job_title || 'Untitled role',
    company: job.employer_name || 'Unknown company',
    location,
    workMode: mapWorkMode(job),
    // job_employment_type is a display string with an en-dash ("Full–time"),
    // unreliable to parse — job_employment_types[0] is the stable enum value.
    employmentType: mapEmploymentType(job.job_employment_types?.[0]),
    experienceLevel: mapExperienceLevel(job),
    salaryRange: mapSalaryRange(job),
    skills: extractSkillsGuess(job.job_description),
    description: (job.job_description || '').slice(0, 2000),
    applyUrl: job.job_apply_link || '',
    recruiterName: '',
    recruiterEmail: '',
    recruiterLinkedIn: '',
    seeded: false,
    active: true,
  };
}

/**
 * @param {string} query e.g. "backend engineer in Bengaluru"
 * @returns {Promise<object[]>} mapped, Job-schema-shaped listings (not yet saved)
 */
export async function searchJsearch(query) {
  const key = env.jobs.rapidApiJsearchKey;
  if (!key) {
    logger.warn('JSearch not configured — RAPIDAPI_JSEARCH_KEY missing');
    return [];
  }

  // search-v2, not search — the plain /search endpoint 404s for this account's
  // subscription. num_pages/country/date_posted match the account's own
  // documented example request (RapidAPI → JSearch → Endpoints → Job Search).
  const url = `https://${JSEARCH_HOST}/search-v2?query=${encodeURIComponent(query)}&num_pages=1&country=in&date_posted=all`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': JSEARCH_HOST,
          'x-rapidapi-key': key,
        },
      },
      TIMEOUT_MS,
    );

    if (!response.ok) {
      const text = await response.text();
      logger.warn('JSearch request failed', { status: response.status, error: text.slice(0, 300) });
      return [];
    }

    const body = await response.json();
    // search-v2's real shape is { data: { jobs: [...] } }, not { data: [...] }.
    const results = Array.isArray(body?.data?.jobs) ? body.data.jobs : [];
    return results.map(mapJob).filter((j) => j.externalId);
  } catch (err) {
    logger.warn('JSearch request errored', { error: err.message });
    return [];
  }
}
