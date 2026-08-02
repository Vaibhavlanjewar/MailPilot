/**
 * Seeds the job board with realistic listings.
 * Run: npm run seed:jobs -w server
 *
 * Idempotent: seeded rows are replaced, user-posted jobs are never touched.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Job } from '../models/Job.js';
import { logger } from '../utils/logger.js';

const COMPANIES = [
  ['Razorpay', 'Bengaluru'],
  ['Zerodha', 'Bengaluru'],
  ['Swiggy', 'Bengaluru'],
  ['Flipkart', 'Bengaluru'],
  ['Zoho', 'Chennai'],
  ['Freshworks', 'Chennai'],
  ['Postman', 'Bengaluru'],
  ['Atlassian', 'Bengaluru'],
  ['Microsoft', 'Hyderabad'],
  ['Google', 'Hyderabad'],
  ['Amazon', 'Hyderabad'],
  ['Salesforce', 'Hyderabad'],
  ['Persistent Systems', 'Pune'],
  ['Bajaj Finserv', 'Pune'],
  ['Mastercard', 'Pune'],
  ['Zeta', 'Mumbai'],
  ['CRED', 'Bengaluru'],
  ['Paytm', 'Noida'],
  ['Adobe', 'Noida'],
  ['HCLTech', 'Noida'],
  ['PhonePe', 'Bengaluru'],
  ['Groww', 'Bengaluru'],
  ['Meesho', 'Bengaluru'],
  ['Uber', 'Hyderabad'],
  ['Walmart Global Tech', 'Bengaluru'],
];

const ROLES = [
  {
    title: 'Backend Engineer',
    skills: ['Node.js', 'PostgreSQL', 'Docker', 'REST APIs'],
    description:
      'Design and own backend services end to end. You will build APIs that handle high request volumes, model relational data carefully, and take services from design through deployment and on-call.',
  },
  {
    title: 'Frontend Engineer',
    skills: ['React', 'TypeScript', 'CSS', 'Testing Library'],
    description:
      'Build accessible, fast user interfaces. You will work closely with design, own component architecture, and care about bundle size, correctness and real-world performance.',
  },
  {
    title: 'Full Stack Engineer',
    skills: ['React', 'Node.js', 'MongoDB', 'AWS'],
    description:
      'Work across the stack shipping features from database to UI. Suits engineers who like owning a problem end to end rather than a single layer.',
  },
  {
    title: 'Data Engineer',
    skills: ['Python', 'SQL', 'Airflow', 'Spark'],
    description:
      'Build and maintain batch and streaming pipelines feeding analytics and ML. Strong SQL and a bias for data correctness are essential.',
  },
  {
    title: 'DevOps Engineer',
    skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD'],
    description:
      'Own build and deploy infrastructure. You will improve pipeline reliability, manage Kubernetes workloads, and reduce time from merge to production.',
  },
  {
    title: 'Machine Learning Engineer',
    skills: ['Python', 'PyTorch', 'MLOps', 'SQL'],
    description:
      'Take models from notebook to production: feature pipelines, training infrastructure, evaluation harnesses and serving.',
  },
  {
    title: 'QA Automation Engineer',
    skills: ['Playwright', 'JavaScript', 'CI/CD', 'API Testing'],
    description:
      'Build automated test coverage that engineers actually trust. You will own the end-to-end suite and keep it fast and non-flaky.',
  },
  {
    title: 'Mobile Engineer (React Native)',
    skills: ['React Native', 'TypeScript', 'iOS', 'Android'],
    description:
      'Ship cross-platform mobile features, own release trains for both stores, and keep crash-free sessions high.',
  },
];

const LEVELS = [
  { experienceLevel: 'Fresher', salaryRange: '₹6-10 LPA', prefix: 'Associate ' },
  { experienceLevel: 'Junior', salaryRange: '₹10-18 LPA', prefix: '' },
  { experienceLevel: 'Mid', salaryRange: '₹18-32 LPA', prefix: '' },
  { experienceLevel: 'Senior', salaryRange: '₹32-55 LPA', prefix: 'Senior ' },
  { experienceLevel: 'Lead', salaryRange: '₹55-80 LPA', prefix: 'Lead ' },
];

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Full-time', 'Full-time', 'Contract', 'Internship'];

function buildJobs() {
  const jobs = [];
  let n = 0;

  for (const [company, location] of COMPANIES) {
    // Exactly two openings per company: 25 companies -> 50 listings, matching
    // a realistic "up to 50 live roles" board size.
    for (let i = 0; i < 2; i += 1) {
      const role = ROLES[(n + i) % ROLES.length];
      const level = LEVELS[(n + i * 2) % LEVELS.length];
      const workMode = WORK_MODES[(n + i) % WORK_MODES.length];
      // Interns are always Fresher level; everyone else follows the level rotation.
      const employmentType =
        level.experienceLevel === 'Fresher'
          ? EMPLOYMENT_TYPES[(n + i) % EMPLOYMENT_TYPES.length]
          : 'Full-time';

      jobs.push({
        title: `${level.prefix}${role.title}`,
        company,
        location: workMode === 'Remote' ? 'Remote (India)' : location,
        workMode,
        employmentType,
        experienceLevel: level.experienceLevel,
        salaryRange: level.salaryRange,
        skills: role.skills,
        description: role.description,
        applyUrl: `https://careers.${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        recruiterName: '',
        recruiterEmail: '',
        recruiterLinkedIn: `https://www.linkedin.com/company/${company
          .toLowerCase()
          .replace(/[^a-z]/g, '')}/people/`,
        seeded: true,
        active: true,
      });
      n += 1;
    }
  }
  return jobs;
}

async function run() {
  await mongoose.connect(env.mongodbUri);

  const jobs = buildJobs();
  const removed = await Job.deleteMany({ seeded: true });
  const inserted = await Job.insertMany(jobs);

  logger.info('Job board seeded', {
    removedSeeded: removed.deletedCount,
    inserted: inserted.length,
  });

  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error('Seeding failed', { error: err.message });
  process.exit(1);
});
