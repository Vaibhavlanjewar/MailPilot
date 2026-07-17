import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const AI_SYSTEM_PROMPT = `You are an expert cold email generator and HTML email designer.

Your task is to generate a professional, personalized cold email template in clean HTML format.

Inputs:
- User Prompt: {{user_prompt}}   (may include Job Description or instructions)

Instructions:
1. Understand the intent (job application, cold outreach, networking, etc.)
2. Extract:
   - Company name
   - Role
   - Skills required
3. Generate a highly personalized email.
4. Keep it concise (150-200 words).
5. Use placeholders where needed:
   - {{name}}
   - {{company}}
   - {{role}}
   - {{email}}

6. Output MUST be clean HTML:
   - Use <p>, <strong>, <ul>, <li>
   - Inline styles for email compatibility
   - No external CSS
   - No markdown

7. Also generate a strong subject line.

Output format STRICT JSON:
{
  "subject": "string",
  "body": "<html>clean email html</html>"
}`;

function normalize(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function extractCompany(prompt) {
  const input = normalize(prompt);
  const match = input.match(/\b(?:at|for|with)\s+([A-Z][A-Za-z0-9&.,' -]{1,60})/);
  return normalize(match?.[1]) || '{{company}}';
}

function extractRole(prompt) {
  const input = normalize(prompt);
  const match = input.match(/\b(role|position|opening)\s*(?:as|:)?\s*([A-Za-z][A-Za-z0-9/ +()-]{2,80})/i);
  if (match?.[2]) return normalize(match[2]);
  if (/software\s+engineer/i.test(input)) return 'Software Engineer';
  return '{{role}}';
}

const DEFAULT_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Express.js',
  'MongoDB',
  'SQL',
  'REST APIs',
  'Docker',
  'AWS',
];

const SKILL_PATTERNS = [
  { key: 'Go', re: /\b(golang|go)\b/i },
  { key: 'Java', re: /\bjava\b/i },
  { key: 'Python', re: /\bpython\b/i },
  { key: 'C++', re: /\bc\+\+\b/i },
  { key: 'C#', re: /\bc#\b/i },
  { key: 'JavaScript', re: /\bjavascript\b/i },
  { key: 'TypeScript', re: /\btypescript\b/i },
  { key: 'React', re: /\breact(\.js)?\b/i },
  { key: 'Next.js', re: /\bnext(\.js)?\b/i },
  { key: 'Angular', re: /\bangular\b/i },
  { key: 'Node.js', re: /\bnode(\.js)?\b/i },
  { key: 'Express.js', re: /\bexpress(\.js)?\b/i },
  { key: 'MongoDB', re: /\bmongodb\b/i },
  { key: 'SQL', re: /\b(sql|mysql|postgres|postgresql|sql server)\b/i },
  { key: 'REST APIs', re: /\b(rest api|restful)\b/i },
  { key: 'GraphQL', re: /\bgraphql\b/i },
  { key: 'AWS', re: /\baws\b/i },
  { key: 'Docker', re: /\bdocker\b/i },
  { key: 'Kubernetes', re: /\bkubernetes\b/i },
  { key: 'System Design', re: /\bsystem design\b/i },
];

function extractSkills(prompt) {
  const input = normalize(prompt);
  if (!input) return DEFAULT_SKILLS.slice(0, 8);

  const found = SKILL_PATTERNS.filter((row) => row.re.test(input)).map((row) => row.key);
  const unique = Array.from(new Set(found));
  return unique.length ? unique.slice(0, 10) : DEFAULT_SKILLS.slice(0, 8);
}

function toHtmlList(items) {
  return items.map((item) => `    <li>${item}</li>`).join('\n');
}

function buildProjectBullets(skills, role) {
  const s1 = skills[0] || 'modern web stack';
  const s2 = skills[1] || 'backend APIs';
  const s3 = skills[2] || 'cloud tooling';

  return [
    `<strong>${role} Platform:</strong> Built and delivered production-ready modules using ${s1} and ${s2}`,
    `<strong>Automation Workflow:</strong> Developed workflow automation and reusable services with ${s2}`,
    `<strong>Scalable Deployment:</strong> Improved reliability and deployment readiness using ${s3}`,
  ];
}

function fallbackTemplate(userPrompt) {
  const company = extractCompany(userPrompt);
  const role = extractRole(userPrompt);
  const skills = extractSkills(userPrompt);
  const projectBullets = buildProjectBullets(skills, role === '{{role}}' ? 'Software' : role);

  return {
    subject: `Application for ${role} Role at ${company}`,
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Application for ${role}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Dear {{name}},</p>

  <p>
    I am writing to express my strong interest in the <strong>${role}</strong> role at <strong>{{company}}</strong>.
    I bring hands-on experience building secure, scalable applications and delivering measurable engineering outcomes.
  </p>

  <p>
    Based on the role requirements, I can contribute through practical implementation, strong problem solving,
    and end-to-end ownership from design to deployment.
  </p>

  <h3>Technical Skills:</h3>
  <ul style="padding-left: 18px; margin: 12px 0;">
${toHtmlList(skills.map((skill) => `<strong>${skill}</strong>`))}
  </ul>

  <h3>Projects:</h3>
  <ul style="padding-left: 18px; margin: 12px 0;">
${toHtmlList(projectBullets)}
  </ul>

  <p>
    I have attached my resume for your review and would welcome the opportunity to contribute to your team.
  </p>

  <p>Thank you for your time and consideration.</p>

  <p>
    Best regards,<br />
    <strong>{{name}}</strong><br />
    MailPilot
  </p>
</body>
</html>`,
  };
}

function parseModelJson(raw) {
  const text = normalize(raw);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed?.subject && parsed?.body) return parsed;
  } catch {
    // continue to fenced JSON extraction
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fenced?.[1]) return null;

  try {
    const parsed = JSON.parse(fenced[1]);
    if (parsed?.subject && parsed?.body) return parsed;
  } catch {
    return null;
  }

  return null;
}

async function logLangsmithRunStart(runId, promptText) {
  try {
    const url = `${env.ai.langsmith.endpoint}/runs`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ai.langsmith.apiKey,
      },
      body: JSON.stringify({
        id: runId,
        name: 'generate_cold_email_template',
        run_type: 'llm',
        inputs: { prompt: promptText },
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

async function generateWithGemini(userPrompt) {
  const apiKey = normalize(env.ai.googleApiKey);
  if (!apiKey) return null;

  const runId = crypto.randomUUID();
  if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
    await logLangsmithRunStart(runId, userPrompt);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${AI_SYSTEM_PROMPT}\n\nUser Prompt/Input:\n${userPrompt}`,
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
      if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
        await logLangsmithRunEnd(runId, null, errText);
      }
      return null;
    }

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
        await logLangsmithRunEnd(runId, null, 'Empty parts response from Gemini');
      }
      return null;
    }

    const parsed = parseModelJson(rawContent);
    if (!parsed?.subject || !parsed?.body) {
      if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
        await logLangsmithRunEnd(runId, rawContent, 'Failed to parse JSON containing subject and body');
      }
      return null;
    }

    const result = {
      subject: normalize(parsed.subject),
      body: normalize(parsed.body),
    };

    if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
      await logLangsmithRunEnd(runId, rawContent, null, result);
    }

    logger.info('Successfully generated template via Gemini API');
    return result;
  } catch (err) {
    logger.error('Gemini processing error', { error: err.message });
    if (env.ai.langsmith.tracing && env.ai.langsmith.apiKey) {
      await logLangsmithRunEnd(runId, null, err.message);
    }
    return null;
  }
}

async function generateWithOllama(userPrompt) {
  try {
    const url = 'http://127.0.0.1:11434/api/generate';
    const payload = {
      model: 'qwen2.5-coder:0.5b',
      prompt: `${AI_SYSTEM_PROMPT}\n\nUser Prompt/Input:\n${userPrompt}`,
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
    if (!parsed?.subject || !parsed?.body) return null;

    logger.info('Successfully generated template via local Ollama (qwen2.5-coder:0.5b)');
    return {
      subject: normalize(parsed.subject),
      body: normalize(parsed.body),
    };
  } catch (err) {
    logger.error('Ollama processing error', { error: err.message });
    return null;
  }
}

async function generateWithOpenAI(userPrompt) {
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
          { role: 'system', content: AI_SYSTEM_PROMPT },
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
    if (!parsed?.subject || !parsed?.body) return null;

    return {
      subject: normalize(parsed.subject),
      body: normalize(parsed.body),
    };
  } catch (err) {
    logger.error('OpenAI processing error', { error: err.message });
    return null;
  }
}

export async function generateTemplateFromPrompt(userPrompt) {
  const prompt = normalize(userPrompt);
  if (!prompt) {
    return fallbackTemplate('');
  }

  // 1. Try Gemini first
  const geminiResult = await generateWithGemini(prompt);
  if (geminiResult?.subject && geminiResult?.body) {
    return geminiResult;
  }

  // 2. Try Ollama (qwen2.5-coder:0.5b) second
  const ollamaResult = await generateWithOllama(prompt);
  if (ollamaResult?.subject && ollamaResult?.body) {
    return ollamaResult;
  }

  // 3. Try OpenAI fallback
  const aiResult = await generateWithOpenAI(prompt);
  if (aiResult?.subject && aiResult?.body) {
    return aiResult;
  }

  // 4. Static fallback
  return fallbackTemplate(prompt);
}
