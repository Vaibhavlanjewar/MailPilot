import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Python/JS run free in the browser (Pyodide + Web Worker) — this route only
 * serves the compiled languages, which need a real toolchain. Piston's public
 * API went whitelist-only and self-hosting it needs a privileged Docker
 * container (see docker-compose.yml's old `piston` service), which doesn't
 * fit a standard Render web service. Judge0 CE via RapidAPI runs them hosted
 * instead — same RapidAPI account already used for JSearch, just needs the
 * free Judge0 CE plan subscribed on that account.
 */
const JUDGE0_HOST = 'judge0-ce.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_JSEARCH_KEY || '';
const EXEC_TIMEOUT_MS = 15_000;
const MAX_SOURCE_CHARS = 20_000;

const SUPPORTED_LANGUAGES = {
  c: { languageId: 50, label: 'C (GCC 9.2.0)' },
  cpp: { languageId: 54, label: 'C++ (GCC 9.2.0)' },
  java: { languageId: 62, label: 'Java (OpenJDK 13.0.1)' },
};

const execLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many code runs. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(authenticate);

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

router.get('/runtimes', (_req, res) => {
  res.json({
    success: true,
    languages: Object.entries(SUPPORTED_LANGUAGES).map(([label, cfg]) => ({ label, ...cfg })),
  });
});

router.post('/execute', execLimiter, async (req, res, next) => {
  try {
    const { language: label, source, stdin = '' } = req.body;
    const config = SUPPORTED_LANGUAGES[label];

    if (!config) {
      throw new AppError(`Unsupported language. Use one of: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}.`, 422);
    }
    if (!source?.trim()) {
      throw new AppError('source is required.', 422);
    }
    if (source.length > MAX_SOURCE_CHARS) {
      throw new AppError(`Source exceeds ${MAX_SOURCE_CHARS} characters.`, 413);
    }
    if (!RAPIDAPI_KEY) {
      throw new AppError('The C/C++/Java sandbox is not configured.', 503);
    }

    let response;
    try {
      response = await fetchWithTimeout(
        `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': JUDGE0_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY,
          },
          body: JSON.stringify({
            language_id: config.languageId,
            source_code: source,
            stdin: String(stdin).slice(0, 4_000),
          }),
        },
        EXEC_TIMEOUT_MS,
      );
    } catch (err) {
      logger.warn('Judge0 unreachable', { error: err.message });
      throw new AppError('The C/C++/Java sandbox is temporarily unavailable.', 503);
    }

    if (!response.ok) {
      const text = await response.text();
      logger.warn('Judge0 execution failed', { status: response.status, error: text.slice(0, 300) });
      throw new AppError('Code execution service rejected the request.', 502);
    }

    const result = await response.json();
    // status.id: 3 = Accepted (ran fine, exit code may still be non-zero).
    // 6 = Compilation Error (compile_output holds the compiler's stderr).
    // Anything else (TLE, runtime error, etc.) surfaces via status.description.
    const statusId = result.status?.id;
    const runtimeError =
      statusId && statusId !== 3 && statusId !== 6 ? result.status?.description || '' : '';

    res.json({
      success: true,
      run: {
        stdout: result.stdout || '',
        stderr: [result.stderr, runtimeError].filter(Boolean).join('\n'),
        code: result.exit_code ?? null,
      },
      compile: result.compile_output ? { stdout: '', stderr: result.compile_output } : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
