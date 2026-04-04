import { env } from '../../config/env.js';

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

async function generateWithOpenAI(userPrompt) {
  const apiKey = normalize(env.ai.openaiApiKey);
  if (!apiKey) return null;

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
}

export async function generateTemplateFromPrompt(userPrompt) {
  const prompt = normalize(userPrompt);
  if (!prompt) {
    return fallbackTemplate('');
  }

  const aiResult = await generateWithOpenAI(prompt);
  if (aiResult?.subject && aiResult?.body) {
    return aiResult;
  }

  return fallbackTemplate(prompt);
}
