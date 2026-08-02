/**
 * Pulls real listings from JSearch (RapidAPI) into the job board.
 * Run: npm run fetch:jobs -w server
 *
 * Idempotent: upserts by externalId, so re-running never duplicates. Keeps the
 * query list short — JSearch's free RapidAPI tier is ~150-200 requests/month,
 * and each query below costs one request.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Job } from '../models/Job.js';
import { searchJsearch, isJsearchConfigured } from '../services/jobs/jsearch.service.js';
import { logger } from '../utils/logger.js';

const QUERIES = [
  'backend engineer in Bengaluru',
  'frontend engineer in India',
  'full stack developer remote India',
  'devops engineer in Hyderabad',
  'data engineer in India',
];

async function run() {
  if (!isJsearchConfigured()) {
    logger.error('RAPIDAPI_JSEARCH_KEY is not set — nothing to fetch.');
    process.exit(1);
  }

  await mongoose.connect(env.mongodbUri);

  let upserted = 0;
  let fetched = 0;

  for (const query of QUERIES) {
    const jobs = await searchJsearch(query);
    fetched += jobs.length;

    for (const job of jobs) {
      const result = await Job.findOneAndUpdate(
        { externalId: job.externalId },
        { $set: job },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (result) upserted += 1;
    }

    logger.info('JSearch query complete', { query, results: jobs.length });
  }

  logger.info('External job fetch complete', { queries: QUERIES.length, fetched, upserted });
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error('External job fetch failed', { error: err.message });
  process.exit(1);
});
