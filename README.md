# MailPilot

A career platform for job seekers: run personalised cold-email outreach at scale, and prepare for
the interviews that outreach lands you — resume analysis, AI coaching, a live code sandbox, and 1:1
video mock interviews.

**Live:** https://mailpilot-zv26.onrender.com

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [Why this shape](#3-why-this-shape)
4. [Data stores — who owns what](#4-data-stores--who-owns-what)
5. [MongoDB collections](#5-mongodb-collections)
6. [Firebase — auth only](#6-firebase--auth-only)
7. [The AI layer](#7-the-ai-layer)
8. [External APIs](#8-external-apis)
9. [Email delivery pipeline](#9-email-delivery-pipeline)
10. [Live Practice Room (WebRTC)](#10-live-practice-room-webrtc)
11. [API surface](#11-api-surface)
12. [Security model](#12-security-model)
13. [Tech stack](#13-tech-stack)
14. [Running locally](#14-running-locally)
15. [Environment variables](#15-environment-variables)
16. [Deployment](#16-deployment)
17. [Known limitations](#17-known-limitations)

---

## 1. What it does

**Outreach**
- Import contacts manually or by CSV
- Reusable templates with `{{name}}` / `{{company}}` placeholders
- AI-assisted template writing, grounded in your actual resume
- Queued bulk sending with deliberate pacing, retries, and per-recipient logs
- Optional resume PDF attached per campaign
- Open tracking via a signed tracking pixel

**Career preparation**
- One resume per account, chunked and embedded for semantic retrieval
- Ask My Resume — RAG chat over your own resume
- Career Fit — AI analysis of strengths, gaps, and target roles
- Interview Prep — generated questions, coach chat, and a live code sandbox
- Learning Roadmap — staged plan with real linked resources
- Job Board — aggregated external listings plus recruiter-posted jobs
- Live Practice Room — 1:1 WebRTC video mock interviews, schedulable with calendar invites
- Community — discussion threads

**Recruiter mode**
- AI-assisted job posting flow, with posting management

---

## 2. Architecture at a glance

```
                            ┌────────────────────────────┐
                            │   Browser (React SPA)      │
                            │   Firebase Auth SDK        │
                            └────────────┬───────────────┘
                                         │
                  ┌──────────────────────┼──────────────────────┐
                  │ HTTPS (Bearer ID token)                     │ WSS
                  │                                             │ /ws/mock-interview
                  ▼                                             ▼
        ┌───────────────────────────────────────────────────────────────┐
        │        Render Web Service — single origin, single process     │
        │                                                               │
        │   Express API  ·  static React build  ·  ws signaling server  │
        │   BullMQ workers (email + meeting reminders) in-process       │
        └───┬───────────────┬───────────────┬───────────────┬───────────┘
            │               │               │               │
            ▼               ▼               ▼               ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │  MongoDB   │  │   Redis    │  │  Firebase  │  │  External    │
     │   Atlas    │  │  (Upstash) │  │   Admin    │  │  APIs        │
     │            │  │            │  │            │  │              │
     │ all app    │  │ BullMQ     │  │ verify ID  │  │ Gemini/Groq  │
     │ data +     │  │ queues,    │  │ tokens     │  │ Gmail, JSearch│
     │ resume PDF │  │ delayed    │  │ ONLY       │  │ Judge0, TURN │
     └────────────┘  └────────────┘  └────────────┘  └──────────────┘

     Video/audio never touches the server — it flows browser ↔ browser (P2P),
     relayed by an external TURN server only when a direct path is blocked.
```

**Request lifecycle**

1. Browser signs in with Firebase Auth (Google or email/password) and receives an ID token.
2. Every API call sends `Authorization: Bearer <token>`; axios refreshes it transparently.
3. `authenticate` middleware verifies the token with Firebase Admin, then upserts/loads the
   matching Mongo user and sets `req.userId`.
4. Route handlers work purely against MongoDB. Firebase is never consulted again.
5. Long-running work (sending email, meeting reminders) is pushed to Redis-backed BullMQ
   instead of blocking the request.

---

## 3. Why this shape

Decisions that aren't obvious, and the reasoning behind them:

**Single origin, one process.** The API, the built React app, and the WebSocket signaling server
all run in one Render Web Service. This removes CORS complexity, avoids cross-domain WebSocket
issues, and keeps Firebase Auth's redirect flow working (see below). Serverless platforms cannot
hold persistent WebSocket connections, which the mock interview feature needs.

**Firebase for identity, MongoDB for everything else.** Firebase gives battle-tested auth
(Google sign-in, password reset, token refresh) for free. But application data lives in Mongo,
where it can be queried and related properly. Firestore is deliberately not used.

**Resume binaries live in MongoDB, not object storage.** Firebase Storage was never provisioned
for this project, and the upload path failed silently — writing a pointer to a file that was never
stored, so campaign attachments came out empty while the UI reported success. Storing the bytes in
Mongo removed the whole class of failure. Resume PDFs are small and single-per-user, so this is a
reasonable trade; it would need revisiting for larger files.

**Gmail API over SMTP.** Render (like most cloud hosts) blocks outbound SMTP ports 587/465 as an
anti-spam measure. Campaigns appeared to send but silently timed out. The Gmail API works over
HTTPS/443, so it bypasses the block entirely. Per-user Gmail app passwords were removed for the
same reason — they can only work over SMTP.

**Peer-to-peer video.** With exactly two participants, an SFU is unnecessary infrastructure. P2P
keeps media off the server, so free-tier bandwidth limits are irrelevant. TURN is bought rather
than built, because Render exposes a single HTTP port and no UDP — self-hosting coturn is impossible.

---

## 4. Data stores — who owns what

| Store | Hosted | Holds | Notably does *not* hold |
|---|---|---|---|
| **MongoDB** | Atlas | All application data, resume PDFs, embedding vectors | — |
| **Redis** | Upstash (TLS) | BullMQ job queues, delayed reminder jobs | Nothing durable — safe to flush |
| **Firebase** | Google | User identity, credentials, sessions | No app data, no files, no Firestore |

Firebase and MongoDB are joined on `email` / `firebaseUid`. A Mongo `User` document is created
on first authenticated request, so there is no separate registration write path to keep in sync.

---

## 5. MongoDB collections

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Account + sending identity | `email`, `firebaseUid`, `role`, `smtpUser`, `gmailRefreshTokenEnc` |
| `resumes` | Resume text, links, embeddings | `content`, `embedding.chunks[].vector`, `fileName` |
| `resumefiles` | The raw PDF/DOCX bytes | `data` (Buffer), `mimeType`, `size` |
| `contacts` | Outreach recipients | `email`, `name`, `company`, `subscribed` |
| `templates` | Reusable email bodies | `subject`, `body`, `textContent` |
| `campaigns` | A send job | `subject`, `content`, `status`, `attachResume`, `stats` |
| `emaillogs` | Per-recipient delivery + opens | `status`, `trackingToken`, `openCount`, `openHistory` |
| `jobs` | Recruiter posts + external listings | `externalSource`, `applyUrl`, `skills`, `postedBy` |
| `roadmaps` | Generated learning plans | `stages[].topics[]`, `resources` |
| `careerfits` | Career Fit analyses | `strengths`, `skillGaps`, `targetRoles` |
| `discussions` | Community threads | `title`, `body`, `replies[]`, `upvotes` |
| `mockinterviewrooms` | Video rooms + scheduled meetings | `code`, `scheduledAt`, `expiresAt`, `participants[]` |
| `feedback` | In-app feedback | `message`, `page`, `status` |

Two TTL/expiry details worth knowing:
- `mockinterviewrooms` expire via an explicit `expiresAt` derived from `scheduledAt + duration`,
  recomputed on save. An earlier `createdAt`-relative TTL would have deleted any meeting booked
  more than 24h ahead *before it happened*.
- `resumes` are unique per user — re-uploading replaces the document wholesale, so stale chunks
  and vectors cannot survive.

---

## 6. Firebase — auth only

**Used for**
- Email/password sign-in and registration
- Google sign-in (`signInWithRedirect`)
- Password reset
- ID token issue and refresh
- Server-side token verification via Firebase Admin

**Not used for:** Firestore, Storage, Functions, Hosting, Analytics.

Server-side, the entire Firebase surface is two functions: `getFirebaseAdmin()` and
`verifyFirebaseToken()`.

### The auth-domain proxy

Google sign-in initially failed in production. Firebase's redirect flow resolves its result through
a hidden iframe pointed at `authDomain`. When `authDomain` is on a different origin than the app,
browser storage partitioning blocks that iframe — so sign-in silently never completed.

The fix follows Firebase's own guidance: `VITE_FIREBASE_AUTH_DOMAIN` is set to the app's own domain,
and `/__/auth/*` is reverse-proxied to `<project>.firebaseapp.com` ([app.js](server/src/app.js)).
Auth then runs same-origin and partitioning never applies. This also requires
`https://<your-domain>/__/auth/handler` to be registered as an authorised redirect URI in Google
Cloud Console.

---

## 7. The AI layer

Every AI feature routes through one function, `generateStructuredAi()` in
[aiCore.service.js](server/src/services/ai/aiCore.service.js), which tries providers in order and
falls through on failure:

```
Gemini  →  Groq  →  Ollama (local)  →  OpenAI
```

The cascade means a missing or rate-limited key degrades the feature rather than breaking it. Local
Ollama sits third so self-hosted runs keep working offline; its longer timeout is why the client's
HTTP timeout is 35s.

| Provider | Model (default) | Role |
|---|---|---|
| Gemini | `gemini-2.0-flash` | Primary — generation and embeddings |
| Groq | configurable | Fast cloud fallback |
| Ollama | `qwen2.5-coder:0.5b` | Local/offline fallback |
| OpenAI | configurable | Last resort |

**Features built on it:** template generation, resume analysis, Career Fit, interview questions,
coach chat, learning roadmaps, AI job-post drafting.

### Retrieval (RAG)

Resume text is chunked (~400 chars, 100 overlap) and embedded with Gemini embeddings, stored inline
on the resume document. Queries embed and rank by cosine similarity.

When embeddings are unavailable, vectors are **omitted rather than faked**, and retrieval falls back
to a hand-rolled TF-IDF lexical search ([rag.service.js](server/src/services/ai/rag.service.js)).
Quality degrades; the feature keeps working.

---

## 8. External APIs

| Service | Used for | Env var | Failure mode |
|---|---|---|---|
| **Firebase Auth** | Identity, token verification | `FIREBASE_*` | Auth routes return 503 |
| **Gemini** | AI generation + embeddings | `GOOGLE_API_KEY` | Cascades to Groq |
| **Groq** | AI fallback | `GROQ_API_KEY` | Cascades to Ollama |
| **OpenAI** | AI last resort | `OPENAI_API_KEY` | Cascade exhausted → error |
| **Ollama** | Local AI | `OLLAMA_URL` | Skipped if unreachable |
| **Gmail API** | Sending campaign email | `GMAIL_CLIENT_ID/SECRET` | Falls back to SMTP config |
| **JSearch** (RapidAPI) | External job listings | `RAPIDAPI_JSEARCH_KEY` | Board shows internal jobs only |
| **Judge0 CE** (RapidAPI) | Running sandbox code | `RAPIDAPI_KEY` | Sandbox returns a clear error |
| **ExpressTURN** | WebRTC relay | `TURN_URLS/USERNAME/CREDENTIAL` | Degrades to STUN-only |
| **MongoDB Atlas** | Database | `MONGODB_URI` | Server exits on boot |
| **Upstash Redis** | Queues | `REDIS_*` | Server exits on boot |

Every integration degrades deliberately rather than crashing, except the two data stores — those
fail fast at boot with an explicit message, because running without them is meaningless.

---

## 9. Email delivery pipeline

```
Create campaign
      │
      ▼
Campaign + one EmailLog per recipient written to Mongo
      │
      ▼
Jobs pushed to BullMQ ─────► Redis
      │
      ▼
Email worker (1 job/sec, concurrency 1)
      │
      ├─ render {{placeholders}} per recipient
      ├─ inject signed tracking pixel
      ├─ attach resume PDF (if campaign opted in)
      │
      ▼
sendCampaignMail()
      │
      ├─ 1. Gmail API (OAuth, HTTPS)      ← the real path in production
      └─ 2. SMTP (self-hosting / local dev)
      │
      ▼
EmailLog updated: sent | failed + provider message id
```

Throughput is intentionally throttled (`EMAIL_RATE_LIMIT_MAX=1`/sec) — this is outreach, not bulk
marketing, and Gmail enforces its own limits.

**Open tracking.** Each email embeds a 1×1 pixel at `/track?token=<jwt>`. The JWT is signed and
scoped to a single `EmailLog`, so opens can't be forged by guessing an id. The endpoint records
open count and history, and is rate-limited.

---

## 10. Live Practice Room (WebRTC)

```
Browser A                    Server                    Browser B
    │                          │                           │
    │──── WSS /ws/mock-interview (Firebase token in query) ─┤
    │                          │                           │
    │◄──── offer / answer / ICE candidates relayed ────────►│
    │                          │                           │
    │══════════ media flows directly, P2P ═════════════════│
    │                                                       │
    └───────── or via TURN relay if a direct path fails ────┘
```

The server relays signalling only; it never sees audio or video.

**Details that matter**
- The room creator is a **fixed** initiator — deriving it from connection order is racy under
  reconnects and React StrictMode double-invokes.
- ICE candidates arriving before `setRemoteDescription` resolves are **queued and flushed**, not
  dropped — dropping them starves ICE and the call silently never connects.
- TURN credentials are served per-session from `/api/mock-interview/ice-servers`, never bundled
  into the client.
- `getUserMedia` degrades: video+audio → audio-only → video-only, so a device without a webcam
  still joins.
- Room state is in-memory, which assumes a single server process. Horizontal scaling would need
  Redis pub/sub.

**Scheduling.** Meetings can be booked ahead, with an optional `.ics` calendar invite emailed via
the same Gmail path, and a reminder queued through BullMQ. The join window opens 10 minutes before
the start and closes 30 minutes after the scheduled end.

---

## 11. API surface

All routes are under `/api` and require `Authorization: Bearer <firebase-id-token>` unless noted.

| Mount | Responsibility |
|---|---|
| `/api/users` | Settings, profile, Gmail OAuth connect + callback |
| `/api/contacts` | CRUD, CSV import, unsubscribe |
| `/api/templates` | CRUD + AI enhance |
| `/api/campaign` | Create, send, status, per-recipient results |
| `/api/resumes` | Upload, replace, fetch, delete (4 MB JSON limit) |
| `/api/ai` | Interview prep, coach chat, generic generation |
| `/api/career` | Career Fit analysis |
| `/api/roadmaps` | Learning roadmap generation |
| `/api/jobs` | Job board, recruiter posting |
| `/api/mock-interview` | Rooms, scheduled meetings, ICE servers |
| `/api/discussions` | Community threads and replies |
| `/api/code` | Judge0 sandbox execution |
| `/api/analytics` | Dashboard aggregates |
| `/api/email-tracking` | Open reporting |
| `/api/feedback` | Feedback (auth optional) |
| `/track` | Tracking pixel (public, token-scoped) |
| `/ws/mock-interview` | WebRTC signalling (WebSocket) |

---

## 12. Security model

- **Auth**: Firebase ID tokens verified server-side on every request. No hand-rolled sessions.
- **Secrets at rest**: Gmail refresh tokens are encrypted with **AES-256-GCM** before storage
  ([secretCrypto.js](server/src/utils/secretCrypto.js)); production requires a 64-hex-char key.
- **Tracking tokens**: JWTs scoped to a single EmailLog, expiring in 7 days.
- **Headers**: Helmet with an explicit CSP allow-list for Google auth, cdnjs (pdf.js/mammoth),
  jsDelivr (Pyodide), and `wasm-unsafe-eval`.
- **Rate limiting**: global API limiter plus tighter per-feature limits on room creation and
  tracking-pixel hits.
- **Authorisation**: recruiter-only routes gated by `requireRecruiter`; every query is scoped
  by `req.userId`, so cross-tenant reads aren't possible by id guessing.
- **Uploads**: type and size constrained; resume bytes stored in Mongo, never on disk.

---

## 13. Tech stack

**Frontend** — React 18, Vite, React Router, Tailwind CSS, axios, react-toastify, Firebase JS SDK

**Backend** — Node.js 22, Express, Mongoose, BullMQ, ioredis, `ws`, Helmet, Winston,
firebase-admin, googleapis, nodemailer, multer, express-validator

**Infrastructure** — Render (web service), MongoDB Atlas, Upstash Redis, Firebase Auth,
ExpressTURN, Docker Compose (local Mongo + Redis)

---

## 14. Running locally

**Prerequisites:** Node.js 22.x, Docker (or your own Mongo + Redis), a Firebase project.

```bash
git clone https://github.com/Vaibhavlanjewar/MailPilot.git
cd MailPilot
npm install
```

Start Mongo and Redis:

```bash
npm run docker:up
```

Create `.env` in the repo root (see [Environment variables](#15-environment-variables)), then:

```bash
npm run dev
```

Client on `http://localhost:5173`, API on `http://localhost:4000`.

Other scripts:

```bash
npm run build          # build the client
npm start              # serve the built client + API from Express
npm run docker:down    # stop local Mongo/Redis
```

> **Working against production data?** Set `RUN_EMAIL_WORKER=false` locally. Otherwise your machine
> competes with the deployed worker for the same Redis queue and will process real user campaigns.

---

## 15. Environment variables

### Required

```bash
MONGODB_URI=mongodb+srv://...
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false                 # true for Upstash

JWT_SECRET=<random-string>

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=      # your own domain in prod, see §6
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
```

### Email sending

```bash
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=https://<host>/api/users/gmail/callback
SMTP_CREDENTIALS_ENCRYPTION_KEY=  # exactly 64 hex chars

RUN_EMAIL_WORKER=true
EMAIL_WORKER_CONCURRENCY=1
EMAIL_RATE_LIMIT_MAX=1
```

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### AI (all optional — the cascade skips what's missing)

```bash
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GROQ_API_KEY=
OPENAI_API_KEY=
OLLAMA_URL=http://127.0.0.1:11434
```

### Feature integrations (optional)

```bash
RAPIDAPI_KEY=                   # Judge0 code sandbox
RAPIDAPI_JSEARCH_KEY=           # external job listings

TURN_URLS=turn:host:3478,turn:host:3478?transport=tcp
TURN_USERNAME=
TURN_CREDENTIAL=
```

---

## 16. Deployment

Deployed to Render as a **single Web Service** via [render.yaml](render.yaml). Pushing to `main`
auto-deploys.

```yaml
buildCommand: npm install --include=dev && npm run build
startCommand: npm start
```

Platform specifics that were learned the hard way:

| Issue | Resolution |
|---|---|
| `vite: not found` at build | `NODE_ENV=production` makes npm skip devDependencies — `--include=dev` is required |
| MongoDB TLS handshake failure | Node 24 default broke Atlas TLS; pinned to 22.20.0 via `.node-version`, `engines`, and `NODE_VERSION` |
| Atlas connection refused | Render has no static egress IP — Atlas Network Access needs `0.0.0.0/0` |
| Campaigns "sent" but never delivered | Render blocks outbound SMTP; must use the Gmail API |
| Google sign-in never completing | Storage partitioning — needs the `/__/auth` proxy (§6) |
| `ERR_HTTP_HEADERS_SENT` on every page | `res.sendFile`'s callback fires on success too; only call `next(err)` when `err` is set |

Secrets are never committed. Every `sync: false` var in `render.yaml` is filled from the Render
dashboard.

---

## 17. Known limitations

- **Free-tier sleep.** The instance sleeps after ~15 minutes idle. First request takes ~50s, and
  BullMQ delayed jobs (meeting reminders) don't fire while asleep — they run when it next wakes.
  An external uptime pinger on `/api/health` is the practical fix.
- **Single process assumption.** WebRTC room state is in-memory; horizontal scaling needs Redis
  pub/sub.
- **No TURN over TLS/443.** Networks blocking UDP *and* non-standard TCP ports may still fail.
- **Resume binaries in MongoDB.** Fine at one small file per user; object storage would be the
  right answer for larger uploads.
- **Client bundle is ~1 MB.** No code splitting yet.
- **Gemini embeddings required for good retrieval.** Without a valid key, RAG silently falls back
  to lexical TF-IDF — it works, but results are noticeably weaker.
