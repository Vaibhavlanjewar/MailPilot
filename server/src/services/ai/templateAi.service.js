import { generateStructuredAi } from './aiCore.service.js';

const AI_SYSTEM_PROMPT = `You are an expert cold email writer and HTML email designer.

Write a professional, personalised cold email in clean HTML.

Steps:
1. Infer the intent (job application, cold outreach, networking, sales).
2. Extract the company name, role, and required skills from the input.
3. Write 150-200 words — concise, specific, no filler.
4. Use the placeholders {{name}}, {{company}}, {{role}}, {{email}} where a value is unknown.
5. Write a subject line that would actually get opened.

The body MUST be email-client-safe HTML: only <p>, <strong>, <ul>, <li>, <h3>, <br>, with
inline styles. No external CSS, no <script>, no markdown.

Respond with strictly this JSON and nothing else:
{ "subject": "string", "body": "<html>...</html>" }`;

function normalize(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function extractCompany(prompt) {
  const match = normalize(prompt).match(/\b(?:at|for|with)\s+([A-Z][A-Za-z0-9&.,' -]{1,60})/);
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
];

const SKILL_PATTERNS = [
  { key: 'Go', re: /\bgolang\b/i },
  { key: 'Java', re: /\bjava\b/i },
  { key: 'Python', re: /\bpython\b/i },
  { key: 'C++', re: /\bc\+\+/i },
  { key: 'C#', re: /\bc#/i },
  { key: 'JavaScript', re: /\bjavascript\b/i },
  { key: 'TypeScript', re: /\btypescript\b/i },
  { key: 'React', re: /\breact(\.js)?\b/i },
  { key: 'Next.js', re: /\bnext(\.js)?\b/i },
  { key: 'Angular', re: /\bangular\b/i },
  { key: 'Node.js', re: /\bnode(\.js)?\b/i },
  { key: 'Express.js', re: /\bexpress(\.js)?\b/i },
  { key: 'MongoDB', re: /\bmongodb\b/i },
  { key: 'SQL', re: /\b(sql|mysql|postgres|postgresql)\b/i },
  { key: 'REST APIs', re: /\b(rest api|restful)\b/i },
  { key: 'GraphQL', re: /\bgraphql\b/i },
  { key: 'AWS', re: /\baws\b/i },
  { key: 'Docker', re: /\bdocker\b/i },
  { key: 'Kubernetes', re: /\bkubernetes\b/i },
  { key: 'System Design', re: /\bsystem design\b/i },
];

function extractSkills(prompt) {
  const input = normalize(prompt);
  if (!input) return DEFAULT_SKILLS;

  const found = SKILL_PATTERNS.filter((row) => row.re.test(input)).map((row) => row.key);
  const unique = [...new Set(found)];
  return unique.length ? unique.slice(0, 10) : DEFAULT_SKILLS;
}

function toHtmlList(items) {
  return items.map((item) => `    <li>${item}</li>`).join('\n');
}

function fallbackTemplate(userPrompt) {
  const company = extractCompany(userPrompt);
  const role = extractRole(userPrompt);
  const skills = extractSkills(userPrompt);
  const label = role === '{{role}}' ? 'Software' : role;

  const projectBullets = [
    `<strong>${label} Platform:</strong> Built and shipped production modules using ${skills[0] || 'a modern web stack'} and ${skills[1] || 'backend APIs'}`,
    `<strong>Automation Workflow:</strong> Developed reusable services and workflow automation with ${skills[1] || 'backend APIs'}`,
    `<strong>Scalable Deployment:</strong> Improved reliability and deployment readiness using ${skills[2] || 'cloud tooling'}`,
  ];

  return {
    subject: `Application for ${role} Role at ${company}`,
    body: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Dear {{name}},</p>

  <p>
    I am writing to express my strong interest in the <strong>${role}</strong> role at <strong>{{company}}</strong>.
    I bring hands-on experience building secure, scalable applications and delivering measurable engineering outcomes.
  </p>

  <p>
    Based on the role requirements, I can contribute through practical implementation, strong problem solving,
    and end-to-end ownership from design to deployment.
  </p>

  <h3>Technical Skills</h3>
  <ul style="padding-left: 18px; margin: 12px 0;">
${toHtmlList(skills.map((skill) => `<strong>${skill}</strong>`))}
  </ul>

  <h3>Projects</h3>
  <ul style="padding-left: 18px; margin: 12px 0;">
${toHtmlList(projectBullets)}
  </ul>

  <p>I have attached my resume and would welcome the chance to contribute to your team.</p>

  <p>Thank you for your time and consideration.</p>

  <p>
    Best regards,<br />
    <strong>{{name}}</strong>
  </p>
</div>`,
  };
}

export async function generateTemplateFromPrompt(userPrompt) {
  const prompt = normalize(userPrompt);
  if (!prompt) {
    return { ...fallbackTemplate(''), provider: 'fallback' };
  }

  const { data, provider } = await generateStructuredAi(AI_SYSTEM_PROMPT, prompt, {
    isValid: (result) => Boolean(normalize(result.subject) && normalize(result.body)),
    runName: 'generate_cold_email_template',
  });

  if (data) {
    return {
      subject: normalize(data.subject),
      body: normalize(data.body),
      provider,
    };
  }

  return { ...fallbackTemplate(prompt), provider: 'fallback' };
}
