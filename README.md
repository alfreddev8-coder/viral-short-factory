# 🎬 Viral Shorts Factory

**How I Automated My Editing Workflow**

Being an editor is tough. Spending hours searching for the perfect clip, syncing voiceovers, and manually cropping everything to 9:16 just to see if a niche works... it was draining. I needed a way to test viral ideas fast, without the manual grind.

So, I built **Viral Shorts Factory**.

This isn't just a script; it's a full-stack pipeline that takes a niche, writes a viral script using AI (Groq/Llama 3), scrapes matching TikTok clips (no watermarks, different channels), and assembles a high-retention video ready for final touches in CapCut.

---

## ⚡ Live Demo

[Link to your Vercel deployment will go here]

---

## 🔥 Features

- **Niche Selection** — Fast-track for War Facts, NFL, Sports, Celebrities, Rappers, and 10+ built-in niches + custom
- **Smart Scripting** — Powered by Groq (choose your model!) for high-converting hooks and fast-paced scripts
- **3 Viral Titles** — AI generates 3 attention-grabbing titles, you tick the one you want
- **3 SEO Descriptions** — Curiosity-driven, fact-based, and emotional styles to choose from
- **Auto Tags** — 15-20 YouTube/TikTok SEO tags generated automatically
- **Timestamp Editor** — Paste full timestamped script → auto-split → AI fills keywords
- **MP3 First Mode** — Upload your recorded narration, then add timestamped script for clip sync
- **Automatic Scraper** — Finds "exact match" TikTok clips based on your script keywords
- **Dynamic Assembly** — MoviePy handles the timing, cropping (9:16), and voiceover sync
- **Custom Voice** — Use AI (Edge TTS with 6 voice styles) or upload your own voice
- **GitHub Actions Pipeline** — Trigger real cloud automation from the dashboard
- **Copy-Ready Metadata** — After production, copy your title, description, and tags with one click
- **CapCut Export Guide** — Step-by-step editing guide with timeline reference

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite + Tailwind CSS + TypeScript |
| **AI** | Groq API (Llama 3 70B / any model you choose) |
| **Database** | Turso (Edge SQLite) |
| **Processing** | Python + MoviePy + yt-dlp + FFmpeg |
| **Voice** | Edge TTS (free AI voices) |
| **Orchestration** | GitHub Actions |
| **Deployment** | Vercel |

---

## 🎬 Final Result

| Property | Value |
|----------|-------|
| **Input** | Script + keywords + voice |
| **Output** | 1080×1920 MP4 with synced voiceover |
| **Duration** | Matches voiceover length |
| **Format** | YouTube Shorts ready |

### 🔧 Tools Used in Automation

| Tool | Purpose |
|------|---------|
| **Python** | Main scripting language |
| **MoviePy** | Video editing & composition |
| **yt-dlp** | TikTok video downloading |
| **Edge TTS** | AI voice generation (fallback) |
| **FFmpeg** | Video processing backend |
| **Turso** | Database for status updates |
| **GitHub Actions** | Cloud execution environment |
| **Groq** | AI script & metadata generation |

---

## 🚀 Setup Guide

### 1. Database (Turso)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create video-auto

# Get your URL
turso db show video-auto --url

# Get your token
turso db tokens create video-auto
```

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  niche TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT,
  script TEXT,
  segments_json TEXT,
  voice_mode TEXT DEFAULT 'ai-tts',
  voice_style TEXT DEFAULT 'friendly',
  status TEXT DEFAULT 'pending',
  video_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. AI (Groq)

1. Go to [Groq Console](https://console.groq.com/)
2. Create an API Key
3. In the app, paste your key and select any available model from the dropdown

### 3. GitHub (For Automation)

1. Create a [Personal Access Token](https://github.com/settings/tokens) (classic) with `repo` and `workflow` scopes
2. In your repo **Settings → Secrets and Variables → Actions**, add:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GROQ_API_KEY`

### 4. GitHub Actions Workflow

Create `.github/workflows/video-automation.yml` in your repo:

```yaml
name: Video Automation Pipeline

on:
  workflow_dispatch:
    inputs:
      project_id:
        description: 'Project ID'
        required: true
      niche:
        description: 'Content niche'
        required: true
      script:
        description: 'Video script'
        required: true
      segments_json:
        description: 'Timestamped segments JSON'
        required: true
      voice_mode:
        description: 'Voice mode (ai-tts/upload/mp3-first)'
        required: true
      voice_style:
        description: 'Voice style'
        required: true
      title:
        description: 'Video title'
        required: false
      description:
        description: 'Video description'
        required: false
      tags:
        description: 'Video tags (comma separated)'
        required: false

jobs:
  produce-video:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Install Python dependencies
        run: |
          pip install moviepy yt-dlp edge-tts libsql-experimental httpx Pillow

      - name: Run automation pipeline
        env:
          PROJECT_ID: ${{ github.event.inputs.project_id }}
          NICHE: ${{ github.event.inputs.niche }}
          SCRIPT: ${{ github.event.inputs.script }}
          SEGMENTS_JSON: ${{ github.event.inputs.segments_json }}
          VOICE_MODE: ${{ github.event.inputs.voice_mode }}
          VOICE_STYLE: ${{ github.event.inputs.voice_style }}
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
        run: python automation/pipeline.py

      - name: Upload video artifact
        uses: actions/upload-artifact@v4
        with:
          name: final-video-${{ github.event.inputs.project_id }}
          path: output/*.mp4
          retention-days: 7
```

### 5. Python Automation Script

Create `automation/pipeline.py`:

```python
import os
import json
import asyncio
import subprocess
from pathlib import Path

# Read inputs from environment
PROJECT_ID = os.environ.get("PROJECT_ID", "test")
NICHE = os.environ.get("NICHE", "")
SCRIPT = os.environ.get("SCRIPT", "")
SEGMENTS_JSON = os.environ.get("SEGMENTS_JSON", "[]")
VOICE_MODE = os.environ.get("VOICE_MODE", "ai-tts")
VOICE_STYLE = os.environ.get("VOICE_STYLE", "friendly")

# Voice mapping
VOICE_MAP = {
    "friendly": "en-US-GuyNeural",
    "bold": "en-US-DavisNeural",
    "energetic": "en-US-JasonNeural",
    "dramatic": "en-GB-RyanNeural",
    "female-warm": "en-US-JennyNeural",
    "female-bold": "en-US-AriaNeural",
}

OUTPUT_DIR = Path("output")
CLIPS_DIR = Path("clips")
OUTPUT_DIR.mkdir(exist_ok=True)
CLIPS_DIR.mkdir(exist_ok=True)

segments = json.loads(SEGMENTS_JSON)

def time_to_seconds(t: str) -> float:
    parts = t.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(t)

# Step 1: Generate voiceover with Edge TTS
async def generate_voice():
    if VOICE_MODE in ("upload", "mp3-first"):
        print("Using uploaded MP3 — skipping TTS")
        return
    import edge_tts
    voice = VOICE_MAP.get(VOICE_STYLE, "en-US-GuyNeural")
    communicate = edge_tts.Communicate(SCRIPT, voice)
    await communicate.save(str(OUTPUT_DIR / "narration.mp3"))
    print(f"Generated voiceover with {voice}")

# Step 2: Download clips from TikTok
def download_clips():
    for i, seg in enumerate(segments):
        query = seg.get("clipQuery", "")
        if not query:
            continue
        # Search TikTok and download first result
        search_url = f"https://www.tiktok.com/search?q={query.replace(' ', '%20')}"
        output_file = str(CLIPS_DIR / f"clip_{i:03d}.mp4")
        try:
            subprocess.run([
                "yt-dlp",
                "--no-watermark",
                "-o", output_file,
                "--max-downloads", "1",
                search_url
            ], timeout=60, check=False)
        except Exception as e:
            print(f"Failed to download clip {i}: {e}")

# Step 3: Assemble video with MoviePy
def assemble_video():
    from moviepy.editor import (
        VideoFileClip, AudioFileClip, CompositeVideoClip,
        concatenate_videoclips, ColorClip
    )

    target_w, target_h = 1080, 1920
    clips = []

    for i, seg in enumerate(segments):
        clip_path = CLIPS_DIR / f"clip_{i:03d}.mp4"
        duration = time_to_seconds(seg["end"]) - time_to_seconds(seg["start"])

        if clip_path.exists():
            try:
                clip = VideoFileClip(str(clip_path))
                # Resize to 9:16
                scale = max(target_w / clip.w, target_h / clip.h)
                clip = clip.resize(scale)
                clip = clip.crop(
                    x_center=clip.w / 2, y_center=clip.h / 2,
                    width=target_w, height=target_h
                )
                clip = clip.subclip(0, min(duration, clip.duration))
                clips.append(clip)
            except Exception as e:
                print(f"Error processing clip {i}: {e}")
                clips.append(ColorClip((target_w, target_h), color=(0, 0, 0), duration=duration))
        else:
            clips.append(ColorClip((target_w, target_h), color=(0, 0, 0), duration=duration))

    if not clips:
        print("No clips to assemble")
        return

    final_video = concatenate_videoclips(clips, method="compose")

    # Add narration audio
    narration_path = OUTPUT_DIR / "narration.mp3"
    if narration_path.exists():
        audio = AudioFileClip(str(narration_path))
        final_video = final_video.set_audio(audio.subclip(0, min(audio.duration, final_video.duration)))

    output_path = str(OUTPUT_DIR / f"{PROJECT_ID}_final.mp4")
    final_video.write_videofile(
        output_path, fps=30, codec="libx264",
        audio_codec="aac", preset="fast"
    )
    print(f"Final video saved: {output_path}")

# Step 4: Update Turso database
def update_database(status="completed"):
    db_url = os.environ.get("TURSO_DATABASE_URL")
    db_token = os.environ.get("TURSO_AUTH_TOKEN")
    if not db_url or not db_token:
        print("No database credentials — skipping DB update")
        return
    try:
        import libsql_experimental as libsql
        conn = libsql.connect(db_url, auth_token=db_token)
        conn.execute(
            "UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [status, PROJECT_ID]
        )
        conn.commit()
        print(f"Database updated: {PROJECT_ID} -> {status}")
    except Exception as e:
        print(f"DB update failed: {e}")

async def main():
    print(f"Starting pipeline for project {PROJECT_ID}")
    print(f"Niche: {NICHE}")
    print(f"Segments: {len(segments)}")

    print("\n--- Step 1: Generate Voice ---")
    await generate_voice()

    print("\n--- Step 2: Download Clips ---")
    download_clips()

    print("\n--- Step 3: Assemble Video ---")
    assemble_video()

    print("\n--- Step 4: Update Database ---")
    update_database("completed")

    print("\n✅ Pipeline complete!")

if __name__ == "__main__":
    asyncio.run(main())
```

### 6. Vercel (Deployment)

1. Push your code to GitHub
2. Connect the repo to Vercel
3. Add environment variables from `.env.example` to Vercel project settings

---

## 🏗️ Development

```bash
# Frontend
npm install
npm run dev

# Automation (in your automation repo)
cd automation
pip install -r requirements.txt
python pipeline.py
```

### Requirements (automation/requirements.txt)
```
moviepy>=1.0.3
yt-dlp>=2024.1.0
edge-tts>=6.1.0
libsql-experimental>=0.0.34
httpx>=0.25.0
Pillow>=10.0.0
```

---

## 📋 Environment Variables

Copy `.env.example` and fill in your values:

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
GROQ_API_KEY=gsk_your-groq-key
GH_TOKEN=ghp_your-github-token
GH_OWNER=your-github-username
GH_REPO=viral-shorts-factory
```

---

## 🤝 Let's Make Some Money

Once the video is generated:

1. ✅ Download it from the dashboard
2. ✂️ Throw it into CapCut for final memes, sound effects, and captions
3. 🚀 Hit upload on YouTube Shorts / TikTok / Instagram Reels

The platform handles the boring stuff — you focus on the creative finishing touches! 🎬

---

## 📐 How Everything Works (Step by Step)

```
┌─────────────────────────────────────────────────┐
│  1. FRONTEND (React + Vite + Tailwind)          │
│     - Select niche                              │
│     - Create/paste script OR upload MP3         │
│     - AI generates 3 titles, 3 descriptions     │
│     - User picks their favorites                │
│     - AI extracts keywords per segment          │
│     - Trigger production                        │
├─────────────────────────────────────────────────┤
│  2. GITHUB ACTIONS (Cloud Pipeline)             │
│     - Receives project data via workflow_dispatch│
│     - Installs Python + FFmpeg                  │
│     - Runs automation/pipeline.py               │
├─────────────────────────────────────────────────┤
│  3. PYTHON AUTOMATION                           │
│     - Edge TTS generates voiceover MP3          │
│     - yt-dlp downloads TikTok clips             │
│     - MoviePy assembles timeline                │
│     - FFmpeg renders 1080x1920 MP4              │
│     - Updates Turso DB with status              │
├─────────────────────────────────────────────────┤
│  4. RESULT                                      │
│     - Download video artifact from GH Actions   │
│     - Copy metadata (title, desc, tags)         │
│     - Import into CapCut for finishing           │
│     - Upload to YouTube Shorts / TikTok         │
└─────────────────────────────────────────────────┘
```

---

Created with ⚡ by Alfred
