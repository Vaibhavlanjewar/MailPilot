import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

function normalize(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function parseModelJson(raw) {
  const text = normalize(raw);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    // continue
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fenced?.[1]) return null;

  try {
    const parsed = JSON.parse(fenced[1]);
    return parsed;
  } catch {
    return null;
  }
}

async function logLangsmithRunStart(runId, runName, inputData) {
  try {
    if (!env.ai.langsmith.tracing || !env.ai.langsmith.apiKey) return;
    const url = `${env.ai.langsmith.endpoint}/runs`;
    await fetch(url, {
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
    });
  } catch (err) {
    logger.debug('Langsmith trace start error', { error: err.message });
  }
}

async function logLangsmithRunEnd(runId, rawOutput, errInfo, parsedOutput) {
  try {
    if (!env.ai.langsmith.tracing || !env.ai.langsmith.apiKey) return;
    const url = `${env.ai.langsmith.endpoint}/runs/${runId}`;
    await fetch(url, {
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
    });
  } catch (err) {
    logger.debug('Langsmith trace end error', { error: err.message });
  }
}

async function generateWithGemini(systemPrompt, userPrompt) {
  const apiKey = normalize(env.ai.googleApiKey);
  if (!apiKey) return null;

  const runId = crypto.randomUUID();
  await logLangsmithRunStart(runId, 'structured_ai_response', { prompt: userPrompt });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nUser Input:\n${userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini API call failed', { status: response.status, error: errText });
      await logLangsmithRunEnd(runId, null, errText);
      return null;
    }

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      await logLangsmithRunEnd(runId, null, 'Empty parts response from Gemini');
      return null;
    }

    const parsed = parseModelJson(rawContent);
    if (!parsed) {
      await logLangsmithRunEnd(runId, rawContent, 'Failed to parse structured JSON');
      return null;
    }

    await logLangsmithRunEnd(runId, rawContent, null, parsed);
    logger.info('Successfully generated structured response via Gemini API');
    return parsed;
  } catch (err) {
    logger.error('Gemini processing error', { error: err.message });
    await logLangsmithRunEnd(runId, null, err.message);
    return null;
  }
}

async function generateWithOllama(systemPrompt, userPrompt) {
  try {
    const url = 'http://127.0.0.1:11434/api/generate';
    const payload = {
      model: 'qwen2.5-coder:0.5b',
      prompt: `${systemPrompt}\n\nUser Input:\n${userPrompt}`,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.3,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error('Ollama API call failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    const rawContent = data?.response;
    if (!rawContent) return null;

    const parsed = parseModelJson(rawContent);
    if (!parsed) return null;

    logger.info('Successfully generated structured response via local Ollama (qwen2.5-coder:0.5b)');
    return parsed;
  } catch (err) {
    logger.error('Ollama processing error', { error: err.message });
    return null;
  }
}

async function generateWithOpenAI(systemPrompt, userPrompt) {
  const apiKey = normalize(env.ai.openaiApiKey);
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.ai.openaiModel || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseModelJson(content);
    return parsed;
  } catch (err) {
    logger.error('OpenAI processing error', { error: err.message });
    return null;
  }
}

export async function generateCoreStructuredAi(systemPrompt, userPrompt) {
  // 1. Try Gemini
  const gem = await generateWithGemini(systemPrompt, userPrompt);
  if (gem) return gem;

  // 2. Try Ollama (qwen2.5-coder:0.5b)
  const oll = await generateWithOllama(systemPrompt, userPrompt);
  if (oll) return oll;

  // 3. Try OpenAI
  const oai = await generateWithOpenAI(systemPrompt, userPrompt);
  if (oai) return oai;

  return null;
}
