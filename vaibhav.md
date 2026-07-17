# MailPilot Status & Contributions Log (vaibhav.md)

Here is a summary of all changes made to the MailPilot project:

## 1. Registration / Authentication Flow Fixes
* **File Modified:** `server/src/services/email/gmailOtp.service.js`
* **Change Details:** Originally, MailPilot strictly demanded configured Gmail API credentials to complete the user registration/OTP email send. 
* **Fix & Design Decision:** Added a fallback chain. If Gmail API credentials are not found, the service attempts to use standard Nodemailer SMTP config. If that is also unconfigured, it logs the secure registration OTP directly to the node console (only in non-production environments). This removed registration/authentication blockers for local development.

## 2. Environment Setup
* **File Modified:** `server/.env` and `server/src/config/env.js`
* **Change Details:** Configured MongoDB, Redis (BullMQ), and API limits. Added secure session keys and encryption factors (`SMTP_CREDENTIALS_ENCRYPTION_KEY`).

## 3. AI Recruiter Outreach (Template Optimizer)
* **Frontend Component:** `client/src/pages/AiAssistant.jsx` (Registered on route `/app/ai-assistant` and linked via sidebar).
* **Backend Endpoint:** `/api/templates/ai-generate` (Handled by `server/src/services/ai/templateAi.service.js`).
* **Feature Scope:** Lets a user submit a target Job Description, optionally paste their Resume details or provide custom prompts, and optimizes a customized HTML pitch/cold introduction email that matches skills. This can then be named and saved into the user's templates cache.

## 4. AI Engine Briefing: Gemini vs. Ollama
We designed a priority-based model cascade:
1. **Primary Model - Gemini:** Calls Google's Gemini `1.5-flash` API. Traces are logged to the Langsmith workspace (`vaibhav-ai`) for observability.
2. **Secondary Model - Ollama:** Fallback targeting a local Ollama instance running `qwen2.5-coder:0.5b` over `http://127.0.0.1:11434`.
3. **Tertiary Fallback:** Offline regex-based parser when no AI models are available.

## 5. Job Search Dashboard Enhancements
* **Frontend Component:** `client/src/pages/JobSearch.jsx` (Registered on route `/app/job-search` and linked via sidebar).
* **Feature Scope:**
  - **Dynamic Keyword Search:** Search by titles, descriptions, and companies.
  - **Tech Stack Chips Filter:** Allows toggling filters for specific technologies (React.js, Node.js, Go, AWS, Docker, PyTorch etc.).
  - **Experience & Size Parameters:** Added quick filters for candidate experience levels (Entry-Level, Mid-Level, Senior/Lead) and target recruiter company sizes.
  - **Crawl Live Openings Simulator:** Crawls and matches open roles from LinkedIn, Naukri, and corporate career APIs, displaying diagnostic log outputs.
  - **Custom Location Adder:** Users can write in custom metropolitan hubs (like `"Berlin"`) to dynamically extend the filter parameters list.

## 6. Recruiter Job Posting Page
* **Frontend Component:** `client/src/pages/PostJob.jsx` (Registered on `/app/post-job` and linked on sidebar).
* **Feature Scope:** Dedicated portal for recruiters, agencies, or organizations. Let's them configure specific skill stack arrays, direct link paths, locations, experience criteria, and publish jobs using local persistence integration.

## 7. AI Interview Preparation Coach
* **Backend Endpoint:** `/api/ai/interview-prep` (Handled by `server/src/routes/ai.routes.js` and `server/src/services/ai/aiCore.service.js`).
* **Frontend Component:** `client/src/pages/InterviewPrep.jsx` (Registered on route `/app/interview-prep` and linked via sidebar with a graduation cap icon).
* **Feature Scope:** Users submit a job description and upload a resume (leveraging PDF.js/Mammoth.js parser). Gemini/Ollama reviews the alignment, generates review focus subjects, and builds customized test questions, answering tips, and customized star-method elevator speeches tailored to the resume.

## 8. Job Discussion Forum & Blog Page
* **Frontend Component:** `client/src/pages/Community.jsx` (Registered on route `/app/community` and linked via sidebar).
* **Feature Scope:** Dedicated chat, thread, and tech stack blogging network. Users can filter discussions by categories (Salary, Referrals, Tech Stack, Interview Tips, General). Supports writing posts, toggle likes, and submitting replies to threads with real-time feedback and client-side persistence.

## 9. Overleaf-Style Resume Builder & Firebase Cloud Uploader
* **Frontend Component:** `client/src/pages/ResumeBuilder.jsx` (Registered on route `/app/resume-builder` and linked via sidebar with a document-text icon).
* **Backend Endpoint:** `/api/resumes` (Routes and validations mapped in `server/src/routes/resume.routes.js` and `server/src/services/firebase/firebase.service.js`).
* **Feature Scope:**
  - **Firebase Admin SDK Storage & Firestore:** Initializes using correct user-provided Service Account credential parameters to manage candidate records.
  - **Size & Count Policies Enforcement:** Implements strict upload file size validation limit of **2MB max**. Automatically restricts users to maximum **2 resumes stored** in cloud at any time. When exceeding this limit, backend keeps the latest upload and autodeletes the oldest file entry.
  - **Overleaf-Style Splitted Layouts:** Choose between distinct styling schemas like `Modern Tech`, `Minimalist Border`, and `Executive Premium` that render live side-by-side with editor updates.
  - **Social & Coding Integrations:** Features dedicated fields for LinkedIn URL, GitHub profile, personal Portfolio, and LeetCode tracks.
  - **AI Optimization Bullet Generator:** Triggers the backend RAG/AI pipeline to optimize bullet points using STAR action-verbs.

## 10. Resume Semantic RAG & Chunking Copilot
* **Frontend Component:** `client/src/pages/ResumeRag.jsx` (Registered on route `/app/resume-rag` and linked via sidebar).
* **Backend Endpoint:** `/api/ai/rag/query` and `/api/ai/rag/chunks` (Handled by `server/src/routes/ai.routes.js` and `server/src/services/ai/rag.service.js`).
* **Feature Scope:**
  - **Document Text Chunking Grid:** Splits uploaded resume content into distinct overlapping word blocks and visualizes them dynamically.
  - **Cosine Similarity Vector Search:** Computes query relevance on term frequency mappings to fetch top matched passages.
  - **Citations & Grounded Context AI:** Synthesizes answer responses strictly grounded to resume context, highlighting matching source chunks and offering custom improvement advice.
  - **Cross-Component Navigation State:** Integrated deep-linking from Resume Builder cloud file manager directly into the RAG chat page.

## 11. Firebase Imports & Fallback Refactoring
* **File Modified:** `server/src/services/firebase/firebase.service.js`
* **Change Details:** Updated imports to match React/ES module conventions of modern firebase-admin (`firebase-admin/app` and `firebase-admin/firestore`), ensuring clean initialization without TypeError. Added dynamic try-catch safety fallbacks during database queries and collections execution index lookups to guarantee transparent client-side operations even when user credentials lack database permissions.

---

### Which model is being used?
* Google returned `API_KEY_INVALID` for the provided Gemini API key.
* Consequently, **Ollama (qwen2.5-coder:0.5b)** takes over and acts as the active backend LLM engine for your local development (e.g., for Template Optimization, Resume Bullet generation, AI Interview Prep, and Resume RAG Chat Query)!

### Langsmith Integration & Purpose
* **Is it used?** Yes, tracing is active via `LANGSMITH_TRACING=true`.
* **Purpose:** All agent calls run through the prompt cascade. Langsmith logs inputs, system instructions, and raw model output streams under the workspace project `"vaibhav-ai"` to evaluate response formatting structure, monitor latency profiles, and debug template optimization runs.



