# MailPilot: AI-Powered Smart Outreach & Recruitment Platform

Welcome to the comprehensive technical documentation and system registry of **MailPilot**. 

MailPilot is a premium, full-stack recruitment outreach and document indexing intelligence ecosystem. It integrates local database containers (MongoDB + Redis), Firebase Cloud architecture, client-side text crawlers, and a cascaded LLM prompt framework to automate candidate resume building, semantic RAG queries, job preparation, and automated campaign tracking workflows.

---

## 🎨 System Architecture Design
Below is the deployment workspace configuration showing dynamic front-end actions, local database queues, and semantic LLM synthesis boundaries.

![MailPilot System Architecture Diagram](file:///C:/Users/vlanj/.gemini/antigravity/brain/9ef93f21-cb18-4eb7-8083-633d73dc3501/mailpilot_architecture_diagram_1784317491152.png)

---

## 👥 Who Is MailPilot For?
* **Job Seekers / Active Candidates:** Optimize resume summary points, structure PDF layouts, query profile details via custom Semantics RAG, and practice job-specific technical interview alignment.
* **Agency Recruiters / Headhunters:** Manage multiple portfolios, post target open roles, organize dynamic CSV contact lists, and deploy high-volume recruiter outreach email campaigns.
* **Sales Outreach Coordinators:** Build personalized pitches using structured AI template optimizes and track email delivery statistics (views, responses, and queuing latency).

---

## 🚀 Why MailPilot is Best in Class
1. **Priority-Based AI Cascades:** Never fails. If the primary cloud engine (Gemini 1.5-flash) experiences rate limitations or invalid credentials, the system automatically routes jobs to local dev backends (**Ollama Qwen2.5-coder**), before utilizing keyword fallback processors.
2. **Client-First Text Extraction:** Instantly extracts raw text from PDF & DOCX resumes in the browser using `pdf.js` and `mammoth.js` from CDN streams, avoiding expensive server-side conversion libraries and heavy document traffic.
3. **Local DB Development Stack:** Integrates Redis-backed **BullMQ** service for async email campaign scheduling and MongoDB for structured settings persistence.
4. **Structured Overleaf-Style Builder:** Interactive forms render change indicators side-by-side with templates (`Modern Tech`, `Executive Premium`, `Minimalist Border`) in real time.

---

## 📁 Project Directory Structure
```
MailPilot/
├── client/                     # Vite + React Frontend APP
│   ├── public/                 # Static asset nodes
│   └── src/
│       ├── assets/             # Styling/Image resources
│       ├── components/
│       │   └── layout/         # Sidebar, Navbar and AppLayout grids
│       ├── pages/              # Core page modules
│       │   ├── Landing.jsx     # Branding landing page
│       │   ├── Dashboard.jsx   # Metrics stats widgets panel
│       │   ├── Campaigns.jsx   # Bulk email campaign manager
│       │   ├── Contacts.jsx    # Recipient CSV details list
│       │   ├── Templates.jsx   # Pitch template manager
│       │   ├── AiAssistant.jsx # Recruiter cold-pitch optimizer
│       │   ├── JobSearch.jsx   # Live search board & tech filter chips
│       │   ├── InterviewPrep.jsx# Custom coach aligned with job roles
│       │   ├── Community.jsx   # Moderated discussions board
│       │   ├── ResumeBuilder.jsx# Multi-scheme Overleaf resume builder
│       │   └── ResumeRag.jsx   # Semantic search chunking helper
│       ├── services/           # Axios server APIs
│       └── App.jsx             # React Routers selector
├── server/                     # Express + Node.js Backend API Engine
│   ├── src/
│   │   ├── config/             # Databases, Env and Firebase configs
│   │   ├── jobs/               # Async workers (BullMQ)
│   │   ├── middlewares/        # JWT Authentication & error catch guides
│   │   ├── queues/             # Redis active connection adapters
│   │   ├── routes/             # Express API router controllers
│   │   ├── services/
│   │   │   ├── ai/             # RAG tf-idf matcher, Ollama/Gemini cascades
│   │   │   ├── email/          # Nodemailer, Gmail OAuth API otp senders
│   │   │   └── firebase/       # Firebase Admin Firestore handlers
│   │   ├── utils/              # Logger outputs, Rate limiters
│   │   ├── app.js              # Express app definitions
│   │   └── server.js           # Server listen port and clean shutdowns
├── docker-compose.yml          # Local Mongo + Redis container service
└── package.json                # Workspaces configurations settings
```

---

## 🛠️ Stack Technologies Overview

### 1. Database (MongoDB)
* **Purpose:** Stores user sessions, auth nodes, campaigns definitions, recruiter job listings, contacts metrics, and discussion posts.
* **Driver:** Mongoose schema validators.

### 2. High-Performance Queueing (Redis + BullMQ)
* **Purpose:** Scheduled batch campaigns, tracking delivery logs, and managing retries.
* **Queue Name:** `email` queue.
* **Rates:** Enforces 1 job per second (custom rate-limiting metrics).

### 3. Cloud Document Core (Firebase / Firestore)
* **Purpose:** Uploaded CVs file base64 buffers store and dynamic built resume sheets storage.
* **Rules & Policies:**
  - Strict **2MB limit** payload check.
  - Maximum **2 resumes** kept per candidate account.
  - Active oldest item deletion queue on threshold excesses.

### 4. AI Engine Briefing & Cascade Rules
```mermaid
graph TD
    Start[User Query] --> A[Priority 1: Gemini 1.5 Flash]
    A -->|Failure / Invalid Keys| B[Priority 2: Local Ollama qwen2.5-coder:0.5b]
    B -->|Offline| C[Priority 3: Keyword Matrix Fallback]
```
* **Langsmith Tracing:** Monitored under project `"vaibhav-ai"`. Logs token latency, prompt templates, and structuring parses.

### 5. Document RAG (Retrieval-Augmented Generation) & Visual Chunker
* **Chunking System:** Splits text strings into overlapping sectors of 400 words density (100 words boundary overlap) to preserve contextual links.
* **Indices Matcher:** Computes query tf-idf cosine similarity matching scores to find candidate document segment keys.
* **Client Highlights:** Highlights matched sources dynamically in the Document Grid and returns AI answers citation tags.

---

## 🏁 Setup & Installation Guide

### Prerequisites
1. **Node.js:** Ensure Node.js (version 18 or above) is installed.
2. **Docker Desktop:** Required to launch database containers (Redis, Mongo).

### 1. Clone & Dependencies Installation
Clone the folder into your local repository workspace and run install:
```bash
# Clone the repository
git clone https://github.com/Vaibhavlanjewar/MailPilot.git
cd MailPilot

# Install root dependencies and setup workspace linking
npm install
```

### 2. Startup Database Containers
In the root directory of the project, start MongoDB and Redis database containers:
```bash
npm run docker:up
```

### 3. Server Configuration (.env)
Create a `.env` file inside the `server/` directory:
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

MONGO_URI=mongodb://localhost:27017/mailpilot
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

JWT_SECRET=vaibhav_mailpilot_development_secret_factor_9x
SMTP_CREDENTIALS_ENCRYPTION_KEY=vaibhav_encryption_32_chars_long_key_9x

# Google Gemini Cloud API
GOOGLE_API_KEY=your_gemini_api_key_here

# Langsmith Observability (Optional)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT=vaibhav-ai

# Firebase Client configuration (Optional - fallback is memory cache)
FIREBASE_PROJECT_ID="mailpilot-e0424"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@mailpilot-e0424.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 4. Running the Application
Run both client and backend server instances concurrently from the root directory:
```bash
# Launch Vite client and Express server
npm run dev
```
* Backend starts listening on: `http://localhost:4000`
* Frontend client opens on: `http://localhost:5173`

---

## ⚠️ System Limitations
* **Local Embedding Fallback:** TF-IDF Cosine Similarity operates in-memory and does not leverage a persistent Vector Database, making it suited only for resume-level document query lengths (under 50,000 characters).
* **Firestore API Dependency:** If the target project Firestore API is not activated or lacks rules clearance, the workspace falls back to transient in-memory queues (does not persist built profiles after server restarts).
* **Ollama Latency:** Processing complex optimizations on local fallbacks requires GPU acceleration; CPU inference times may experience delays up to 10 seconds.
