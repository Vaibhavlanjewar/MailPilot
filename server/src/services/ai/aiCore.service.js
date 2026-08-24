import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Defaults must name models that are actually still served. gemini-2.0-flash
// was retired by Google, and the whole cascade silently collapsed to "no AI
// provider available" on any deploy that didn't override this — the fallback
// existing is worthless if it points at something that 404s.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:0.5b';

const CLOUD_TIMEOUT_MS = Number(process.env.AI_CLOUD_TIMEOUT_MS) || 20_000;
const LOCAL_TIMEOUT_MS = Number(process.env.AI_LOCAL_TIMEOUT_MS) || 30_000;

function normalize(text) {
  return typeof text === 'string' ? text.trim() : '';
}

/** Without this an unreachable Ollama or a stalled upstream socket hangs the request forever. */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function parseModelJson(raw) {
  const text = normalize(raw);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // fall through to fenced-block extraction
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fenced?.[1]) return null;

  try {
    return JSON.parse(fenced[1]);
  } catch {
    return null;
  }
}

async function logLangsmithRunStart(runId, runName, inputData) {
  if (!env.ai.langsmith.tracing || !env.ai.langsmith.apiKey) return;
  try {
    await fetchWithTimeout(
      `${env.ai.langsmith.endpoint}/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ai.langsmith.apiKey,
        },
        body: JSON.stringify({
          id: runId,
          name: runName,
          run_type: 'llm',
          inputs: inputData,
          session_name: env.ai.langsmith.project,
          start_time: new Date().toISOString(),
        }),
      },
      5_000,
    );
  } catch (err) {
    logger.debug('Langsmith trace start error', { error: err.message });
  }
}

async function logLangsmithRunEnd(runId, rawOutput, errInfo, parsedOutput) {
  if (!env.ai.langsmith.tracing || !env.ai.langsmith.apiKey) return;
  try {
    await fetchWithTimeout(
      `${env.ai.langsmith.endpoint}/runs/${runId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ai.langsmith.apiKey,
        },
        body: JSON.stringify({
          outputs: parsedOutput ? { parsed: parsedOutput } : { raw: rawOutput },
          error: errInfo ? String(errInfo) : undefined,
          end_time: new Date().toISOString(),
        }),
      },
      5_000,
    );
  } catch (err) {
    logger.debug('Langsmith trace end error', { error: err.message });
  }
}

async function generateWithGemini(systemPrompt, userPrompt, runName) {
  const apiKey = normalize(env.ai.googleApiKey);
  if (!apiKey) return null;

  const runId = crypto.randomUUID();
  await logLangsmithRunStart(runId, runName, { system: systemPrompt, prompt: userPrompt });

  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      },
      CLOUD_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini call failed', { status: response.status, error: errText });
      await logLangsmithRunEnd(runId, null, errText);
      return null;
    }

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      await logLangsmithRunEnd(runId, null, 'Empty response from Gemini');
      return null;
    }

    const parsed = parseModelJson(rawContent);
    if (!parsed) {
      await logLangsmithRunEnd(runId, rawContent, 'Response was not valid JSON');
      return null;
    }

    await logLangsmithRunEnd(runId, rawContent, null, parsed);
    return parsed;
  } catch (err) {
    logger.error('Gemini processing error', { error: err.message });
    await logLangsmithRunEnd(runId, null, err.message);
    return null;
  }
}

async function generateWithOllama(systemPrompt, userPrompt) {
  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_URL}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          system: systemPrompt,
          prompt: userPrompt,
          format: 'json',
          stream: false,
          options: { temperature: 0.3 },
        }),
      },
      LOCAL_TIMEOUT_MS,
    );

    if (!response.ok) {
      logger.debug('Ollama call failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    return parseModelJson(data?.response);
  } catch (err) {
    logger.debug('Ollama unavailable', { error: err.message });
    return null;
  }
}

/** Groq and OpenAI share the chat-completions contract, so one caller serves both. */
function openAiCompatible({ label, url, apiKey, model }) {
  return async function generate(systemPrompt, userPrompt) {
    const key = normalize(apiKey());
    if (!key) return null;

    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: model(),
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        },
        CLOUD_TIMEOUT_MS,
      );

      if (!response.ok) {
        logger.error(`${label} call failed`, {
          status: response.status,
          error: await response.text(),
        });
        return null;
      }

      const data = await response.json();
      return parseModelJson(data?.choices?.[0]?.message?.content);
    } catch (err) {
      logger.error(`${label} processing error`, { error: err.message });
      return null;
    }
  };
}

const generateWithGroq = openAiCompatible({
  label: 'Groq',
  url: 'https://api.groq.com/openai/v1/chat/completions',
  apiKey: () => env.ai.groqApiKey,
  model: () => env.ai.groqModel,
});

const generateWithOpenAI = openAiCompatible({
  label: 'OpenAI',
  url: 'https://api.openai.com/v1/chat/completions',
  apiKey: () => env.ai.openaiApiKey,
  model: () => env.ai.openaiModel,
});

const PROVIDERS = [
  { name: 'gemini', run: generateWithGemini },
  { name: 'groq', run: generateWithGroq },
  { name: 'ollama', run: generateWithOllama },
  { name: 'openai', run: generateWithOpenAI },
];

/**
 * Walks the provider cascade until one returns parseable JSON that satisfies `isValid`.
 * Returns { data, provider } so callers can tell users which engine answered.
 */
export async function generateStructuredAi(
  systemPrompt,
  userPrompt,
  { isValid = (v) => Boolean(v), runName = 'structured_ai_response' } = {},
) {
  for (const provider of PROVIDERS) {
    const result = await provider.run(systemPrompt, userPrompt, runName);
    if (result && isValid(result)) {
      logger.info('AI response generated', { provider: provider.name });
      return { data: result, provider: provider.name };
    }
  }
  return { data: null, provider: null };
}
