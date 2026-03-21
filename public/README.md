# 🎬 ClipForge — AI Video Automation Platform

> Turn any idea into a viral YouTube Short in 4 steps. Free tools only.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Environment Variables](#environment-variables)
5. [Step-by-Step Workflow](#step-by-step-workflow)
6. [Backend Automation (GitHub Actions)](#backend-automation)
7. [Database (Turso)](#database-turso)
8. [API Integrations](#api-integrations)
9. [CapCut Export](#capcut-export)
10. [Setup Instructions](#setup-instructions)

---

## 🔭 Overview

ClipForge automates the entire YouTube Shorts creation process:

```
[Select Niche] → [Create Script] → [Setup Voice] → [Auto Production] → [Download & Edit in CapCut]
```

**Three Script Modes:**
- 🤖 **AI Generated** — Groq Llama3 writes a viral script for your niche
- 📝 **Paste Your Own** — Use your pre-written script
- 🎤 **MP3 First** — Upload your narration, then add timestamped script so AI knows which clips to find at which moments

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Niche   │→│  Script   │→│  Voice   │→│ Production│ │
│  │Selection │  │ Creation  │  │  Setup   │  │ Pipeline  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│        │              │             │             │       │
│        └──────────────┴─────────────┴─────────────┘       │
│                          │                                │
│                     Zustand Store                         │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────▼──────────┐    ┌────────▼─────────┐
    │   Groq API         │    │  GitHub Actions   │
    │   (Llama3-8B)      │    │  (Automation)     │
    │                    │    │                   │
    │ • Script Gen       │    │ • TikTok Scrape   │
    │ • Timestamps       │    │ • Clip Download   │
    │ • Keywords         │    │ • Edge TTS Voice  │
    │ • Metadata         │    │ • Video Assembly  │
    └────────────────────┘    │ • Final Render    │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │   Turso Database   │
                              │   (SQLite cloud)   │
                              │                    │
                              │ • Project data     │
                              │ • Script history   │
                              │ • Production logs  │
                              └────────────────────┘
```

---

## 🛠 Tech Stack (All Free)

| Component | Tool | Cost |
|-----------|------|------|
| Frontend | React 19 + Vite + TypeScript | Free |
| Styling | Tailwind CSS 4 | Free |
| State | Zustand | Free |
| AI Script | Groq API (Llama3-8B) | Free tier |
| Voice TTS | Edge TTS (Microsoft) | Free |
| Clip Source | TikTok scraping | Free |
| Database | Turso (SQLite) | Free tier |
| Automation | GitHub Actions | Free (2000 min/mo) |
| Video Edit | CapCut | Free |

---

## 🔑 Environment Variables

Create a `.env` file:

```env
# Turso Database (https://turso.tech - sign up free)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Groq AI (https://console.groq.com - free API key)
GROQ_API_KEY=gsk_your_groq_api_key

# GitHub (for Actions automation)
GH_TOKEN=ghp_your_github_personal_access_token
GH_OWNER=your-github-username
GH_REPO=your-repo-name
```

### How to get each key:

1. **Groq API Key**: Go to [console.groq.com](https://console.groq.com), sign up, create API key
2. **Turso**: Go to [turso.tech](https://turso.tech), create account, create database, get URL + token
3. **GitHub Token**: Settings → Developer settings → Personal access tokens → Generate (needs `repo` + `workflow` scopes)

---

## 📝 Step-by-Step Workflow

### Step 1: Niche Selection
- Choose from 10 pre-built niches (Sports, Celebrities, War Facts, Science, etc.)
- Or enter a custom niche
- This determines the AI's context for script generation and clip searching

### Step 2: Script Creation

**Mode A — AI Generated:**
1. Enter your Groq API key
2. Click "Generate Script with AI"
3. Groq Llama3-8B writes a 45-60 second viral script
4. Click "Auto-Generate Timestamps" — AI breaks script into segments
5. Each segment gets keywords + clip search queries extracted
6. Click "Auto-Generate" for title, description, tags

**Mode B — Paste Script:**
1. Paste your pre-written script
2. Auto-generate timestamps or add manually
3. AI extracts keywords per segment

**Mode C — MP3 First:**
1. Upload your pre-recorded narration MP3
2. Manually add timestamped segments matching your audio
3. For each segment: set start/end time, paste the text, and add keywords
4. The keywords tell the automation which TikTok clips to find for each moment
5. Skips voice setup (you already have audio!)

### Step 3: Voice Setup (skipped in MP3-First mode)

**Option A — AI Voice (Edge TTS):**
- Choose from 6 voice styles: Friendly, Bold, Energetic, Dramatic, Female Warm, Female Bold
- Uses Microsoft Edge TTS (100% free, no API key needed)
- Voice is generated in the automation pipeline

**Option B — Upload MP3:**
- Upload your own narration file
- Supports MP3 and common audio formats

### Step 4: Production Pipeline
- Visual pipeline showing 8 automation steps
- Exports project data as JSON for the GitHub Actions backend
- Generates CapCut editing guide with timeline reference
- Download project JSON + CapCut guide

---

## 🤖 Backend Automation (GitHub Actions)

The production pipeline runs on GitHub Actions. Here's the workflow:

### `.github/workflows/produce-video.yml`

```yaml
name: Produce Video
on:
  workflow_dispatch:
    inputs:
      project_json:
        description: 'Project JSON data from ClipForge'
        required: true

jobs:
  produce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python (for Edge TTS)
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          npm install
          pip install edge-tts

      - name: Parse project data
        run: node scripts/parse-project.js '${{ github.event.inputs.project_json }}'

      - name: Search & download TikTok clips
        run: node scripts/scrape-clips.js
        env:
          PROJECT_DIR: ./output

      - name: Generate voiceover (Edge TTS)
        run: python scripts/generate-voice.py
        # Uses edge-tts Python package (free, no API key)

      - name: Assemble video
        run: |
          sudo apt-get install -y ffmpeg
          node scripts/assemble-video.js

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: final-video
          path: output/final-video.mp4

      - name: Save to Turso
        run: node scripts/save-to-turso.js
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

### Key Scripts:

**`scripts/scrape-clips.js`** — Uses headless browser to search TikTok for clips matching keywords:
```js
// For each segment's clipQuery:
// 1. Search TikTok with the query
// 2. Download top matching clip
// 3. Trim to segment duration
// 4. Save to output/clips/segment-{n}.mp4
```

**`scripts/generate-voice.py`** — Edge TTS voice generation:
```python
import edge_tts
import asyncio

async def generate():
    voice = "en-US-GuyNeural"  # from project config
    text = "full script text"   # from project JSON
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save("output/narration.mp3")

asyncio.run(generate())
```

**`scripts/assemble-video.js`** — FFmpeg video assembly:
```js
// 1. Concatenate clips in timestamp order
// 2. Overlay narration audio
// 3. Crop/resize to 1080x1920 (9:16)
// 4. Encode final MP4
```

---

## 💾 Database (Turso)

Turso schema for storing projects:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  niche TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT, -- JSON array
  script TEXT,
  segments TEXT, -- JSON array of timestamped segments
  voice_mode TEXT,
  voice_style TEXT,
  status TEXT DEFAULT 'draft',
  video_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE production_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),
  step TEXT,
  status TEXT,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Connect with `@libsql/client`:
```js
import { createClient } from '@libsql/client';
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

---

## 🔌 API Integrations

### Groq API (Script Generation)
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Model**: `llama3-8b-8192`
- **Used for**: Script writing, timestamp generation, keyword extraction, metadata generation
- **Free tier**: 14,400 requests/day

### Edge TTS (Voice Generation)
- **Package**: `edge-tts` (Python)
- **Voices used**:
  - Friendly: `en-US-GuyNeural`
  - Bold: `en-US-DavisNeural`
  - Energetic: `en-US-JasonNeural`
  - Dramatic: `en-GB-RyanNeural`
  - Female Warm: `en-US-JennyNeural`
  - Female Bold: `en-US-AriaNeural`
- **100% free**, no API key needed

---

## ✂️ CapCut Export

ClipForge generates a CapCut-compatible guide:

1. **Timeline JSON** — Exact timestamps for each clip placement
2. **Editing instructions** — Step-by-step for CapCut
3. **Clip search queries** — What to search if clips need replacement

### Workflow in CapCut:
1. Create 9:16 project (1080×1920)
2. Import narration MP3 → audio track
3. Import clips → place at timestamps
4. Use Auto Captions for subtitles
5. Add transitions (0.3s cross-dissolve)
6. Export and upload!

---

## 🚀 Setup Instructions

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/clipforge.git
cd clipforge
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Setup GitHub Actions
- Push code to GitHub
- Add secrets in repo Settings → Secrets:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `GROQ_API_KEY`
- The production pipeline will trigger via workflow_dispatch

---

## 📁 Project Structure

```
clipforge/
├── src/
│   ├── App.tsx              # Main app with step routing
│   ├── store.ts             # Zustand state management
│   ├── types.ts             # TypeScript types
│   ├── utils/
│   │   └── groq.ts          # Groq API integration
│   ├── components/
│   │   ├── NicheSelection.tsx   # Step 1
│   │   ├── ScriptCreation.tsx   # Step 2
│   │   ├── VoiceSetup.tsx       # Step 3
│   │   └── Production.tsx       # Step 4
│   ├── index.css            # Tailwind + custom styles
│   └── main.tsx             # Entry point
├── .env.example             # Environment template
├── README.md                # This file
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🎯 Free Tools Summary

| Need | Solution | Limit |
|------|----------|-------|
| AI Text | Groq (Llama3-8B) | 14,400 req/day |
| AI Voice | Edge TTS | Unlimited |
| Video Clips | TikTok scraping | No limit |
| Database | Turso | 500 DBs, 9GB |
| CI/CD | GitHub Actions | 2000 min/month |
| Video Edit | CapCut | Free tier |
| Hosting | Vercel/Netlify | Free tier |

**Total cost: $0** 🎉
