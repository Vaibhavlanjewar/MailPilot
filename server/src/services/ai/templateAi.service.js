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

const CHAT_SYSTEM_PROMPT = `You are an expert cold email editor, making a targeted change to an
EXISTING email template through conversation — not writing a new one from scratch.

Rules, in order of importance:
1. Return the COMPLETE updated subject and body, not a diff or just the changed part.
2. Any existing "{{token}}" placeholder (e.g. {{name}}, {{company}}, {{first_name}}) must be
   preserved exactly, character for character. Never invent new placeholders.
3. Any existing "<!-- MAILPILOT:...:START -->" / "<!-- MAILPILOT:...:END -->" HTML comment and
   everything between a matching START/END pair (signature block, projects block) must be copied
   through byte-for-byte, in the same position. These are machine-managed sections — do not
   reword, reformat, reorder, remove, or move their contents, even if asked to "shorten" or
   "improve" the email. If the user's request genuinely requires changing what's inside one of
   these blocks, leave the block untouched anyway and mention in your reply that they should use
   the "Insert signature" / "Insert project links" buttons instead, which regenerate it safely.
4. Never alter, remove, or invent any "<a href=...>" link that already exists outside those
   blocks either — real URLs must never be touched by a wording edit.
5. Apply ONLY the requested change. Do not rewrite unrelated sentences.
6. The body must stay email-client-safe HTML — only tags already used in the input, plus <p>,
   <strong>, <em>, <ul>, <li>, <h3>, <br>, with inline styles. No external CSS, no <script>.

Respond with strictly this JSON and nothing else:
{
  "subject": "the full updated subject line",
  "body": "the full updated HTML body",
  "reply": "One or two sentences describing what you changed, addressed to the user."
}`;

/**
 * Conversational editing of a template draft. Stateless and keyed on the
 * current subject/body rather than a saved template id, so it works while
 * creating a brand new template too, before anything has been saved.
 */
export async function chatAboutTemplate({ subject, body, message, history }) {
  const recent = Array.isArray(history)
    ? history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content || '').slice(0, 600)}`)
        .join('\n')
    : '';

  const userPrompt = `
[CURRENT SUBJECT]
${subject || '(empty)'}

[CURRENT BODY]
${body || '(empty)'}
${recent ? `\n[EARLIER IN THIS CONVERSATION]\n${recent}` : ''}

[REQUESTED CHANGE]
${message}
`.trim();

  const { data, provider } = await generateStructuredAi(CHAT_SYSTEM_PROMPT, userPrompt, {
    isValid: (v) =>
      typeof v?.subject === 'string' && typeof v?.body === 'string' && typeof v?.reply === 'string',
    runName: 'template_chat_edit',
  });

  return { data, provider };
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
