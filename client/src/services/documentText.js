const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const MAMMOTH_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';

export const ACCEPTED_RESUME_TYPES = '.pdf,.docx,.txt';

const scriptPromises = new Map();

function loadScript(src) {
  if (scriptPromises.has(src)) return scriptPromises.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function loadPdfJs() {
  if (!window.pdfjsLib) {
    await loadScript(PDFJS_SRC);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  }
  return window.pdfjsLib;
}

async function loadMammoth() {
  if (!window.mammoth) await loadScript(MAMMOTH_SRC);
  return window.mammoth;
}

function readFile(file, as) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    if (as === 'text') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

async function parsePdf(arrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

async function parseDocx(arrayBuffer) {
  const mammoth = await loadMammoth();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

/**
 * Extracts plain text from a resume file in the browser.
 * Throws with a user-presentable message on unsupported or unreadable files.
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return String(await readFile(file, 'text')).trim();
  }

  if (name.endsWith('.pdf')) {
    const text = (await parsePdf(await readFile(file))).trim();
    if (!text) {
      throw new Error('No text found — this PDF looks like a scanned image.');
    }
    return text;
  }

  if (name.endsWith('.docx')) {
    const text = (await parseDocx(await readFile(file))).trim();
    if (!text) {
      throw new Error('No text found in this Word document.');
    }
    return text;
  }

  throw new Error('Unsupported format. Upload a .pdf, .docx, or .txt file.');
}
