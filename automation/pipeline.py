import os
import json
import asyncio
import subprocess
import requests
import math
import whisper
import re
import time
from pathlib import Path

# --- Read inputs from environment ---
PROJECT_ID = os.environ.get("PROJECT_ID", "test")
PROJECT_TITLE = os.environ.get("PROJECT_TITLE", "Untitled Video")
NICHE = os.environ.get("NICHE", "")
SCRIPT = os.environ.get("SCRIPT", "")
SEGMENTS_JSON = os.environ.get("SEGMENTS_JSON", "[]")
VOICE_MODE = os.environ.get("VOICE_MODE", "ai-tts")
VOICE_STYLE = os.environ.get("VOICE_STYLE", "friendly")
AUDIO_URL = os.environ.get("AUDIO_URL", "")

# --- Advanced Settings (Viral Branding) ---
SCRAPER_MODE = os.environ.get("SCRAPER_MODE", "auto") # auto, pexels, tiktok
CAPTION_COLOR = os.environ.get("CAPTION_COLOR", "yellow")
CAPTION_FONT = os.environ.get("CAPTION_FONT", "DejaVu-Sans-Bold")
CAPTION_SIZE = int(os.environ.get("CAPTION_SIZE", "80"))
SHOW_MEMES = os.environ.get("SHOW_MEMES", "false").lower() == "true"

# --- Directory Setup ---
OUTPUT_DIR = Path("output")
CLIPS_DIR = Path("clips")
ASSETS_DIR = Path("assets")
OUTPUT_DIR.mkdir(exist_ok=True)
CLIPS_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)

segments = json.loads(SEGMENTS_JSON)

# --- Voice mapping ---
VOICE_MAP = {
    "friendly": "en-US-GuyNeural",
    "bold": "en-US-DavisNeural",
    "energetic": "en-US-JasonNeural",
    "dramatic": "en-GB-RyanNeural",
    "female-warm": "en-US-JennyNeural",
    "female-bold": "en-US-AriaNeural",
}

class ClipTracker:
    """Tracks used clip IDs/URLs to prevent excessive repetition (Max 2 times)."""
    def __init__(self):
        self.used_ids = {} # id -> count

    def is_overused(self, clip_id, limit=2):
        return self.used_ids.get(clip_id, 0) >= limit

    def mark_used(self, clip_id):
        self.used_ids[clip_id] = self.used_ids.get(clip_id, 0) + 1

clip_tracker = ClipTracker()

def time_to_seconds(t: str) -> float:
    parts = t.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(t)

# --- Step 0: Ensure Assets (SFX/Music) ---
def ensure_assets():
    """Download essential viral SFX and background music."""
    print("Ensuring viral assets (SFX/Music)...")
    assets = {
        "whoosh.mp3": "https://pixabay.com/music/download/whoosh-6316.mp3",
        "background.mp3": "https://pixabay.com/music/download/phonk-dark-1234.mp3" 
    }
    for filename, url in assets.items():
        path = ASSETS_DIR / filename
        if not path.exists():
            print(f"Downloading {filename}...")
            try:
                res = requests.get(url, stream=True, timeout=15)
                if res.status_code == 200:
                    with open(path, "wb") as f:
                        for chunk in res.iter_content(8192): f.write(chunk)
                else:
                    print(f"Failed to download {filename} (Status {res.status_code})")
            except Exception as e:
                print(f"Error downloading {filename}: {e}")

# --- Step 1: Generate voiceover ---
async def generate_voice():
    if VOICE_MODE in ("upload", "mp3-first"):
        if not AUDIO_URL: raise RuntimeError("Uploaded MP3 mode but no AUDIO_URL provided.")
        dest = OUTPUT_DIR / "narration.mp3"
        print(f"Handling custom audio: {AUDIO_URL}")
        if AUDIO_URL.startswith("uploads/"):
            import shutil
            shutil.copy(AUDIO_URL, dest)
        else:
            res = requests.get(AUDIO_URL, headers={'User-Agent': 'Mozilla/5.0'})
            with open(dest, 'wb') as f: f.write(res.content)
        return

    import edge_tts
    voice = VOICE_MAP.get(VOICE_STYLE, "en-US-GuyNeural")
    try:
        communicate = edge_tts.Communicate(SCRIPT, voice)
        await communicate.save(str(OUTPUT_DIR / "narration.mp3"))
        print(f"Generated voiceover with {voice} (edge-tts)")
    except Exception as e:
        print(f"Fallback to gTTS: {e}")
        from gtts import gTTS
        gTTS(text=SCRIPT, lang='en').save(str(OUTPUT_DIR / "narration.mp3"))

# --- Step 1.5: Transcription (Words for Captions) ---
def generate_transcription(audio_path):
    print(f"Transcribing {audio_path}...")
    model = whisper.load_model("base")
    result = model.transcribe(str(audio_path), word_timestamps=True)
    words = []
    for segment in result["segments"]:
        for w in segment.get("words", []):
            words.append({"word": w["word"].strip(), "start": w["start"], "end": w["end"]})
    return words

# --- Step 2: Smart Scraper (Pexels vs TikTok) ---
def download_clips():
    PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
    
    # Logic: TikTok for sports/celebs, Pexels for nature/aesthetic/general
    n_lower = NICHE.lower()
    tiktok_niches = ["football", "soccer", "celebrity", "actor", "hollywood", "sports", "influencer", "meme"]
    
    if SCRAPER_MODE == "tiktok": preferred = "tiktok"
    elif SCRAPER_MODE == "pexels": preferred = "pexels"
    else: preferred = "tiktok" if any(n in n_lower for n in tiktok_niches) else "pexels"
    
    for i, seg in enumerate(segments):
        queries = [seg.get("clipQuery", "").strip()]
        for kw in seg.get("keywords", []):
            if kw and kw not in queries: queries.append(kw.strip())
        if not queries[0]: queries = ["aesthetic vertical cinematic"]

        output_file = str(CLIPS_DIR / f"clip_{i:03d}.mp4")
        success = False
        
        sources = [preferred, "tiktok" if preferred == "pexels" else "pexels", "youtube"]
        print(f"\n--- Clip {i} (Niched: {preferred}) ---")

        for src in sources:
            if success: break
            for q in queries:
                if success: break
                try:
                    if src == "pexels" and PEXELS_API_KEY:
                        headers = {"Authorization": PEXELS_API_KEY.strip()}
                        res = requests.get("https://api.pexels.com/videos/search", 
                                         headers=headers, params={"query": q, "per_page": 5, "orientation": "portrait"}, timeout=12)
                        if res.status_code == 200:
                            vids = res.json().get('videos', [])
                            for v in vids:
                                v_url = v.get('url')
                                if v_url and clip_tracker.is_overused(v_url): continue
                                files = v.get('video_files', [])
                                best = next((f for f in files if f.get('width', 0) >= 720), files[0])
                                if best:
                                    with open(output_file, 'wb') as f:
                                        f.write(requests.get(best['link']).content)
                                    clip_tracker.mark_used(v_url)
                                    success = True; break
                    
                    elif src == "tiktok":
                        res = requests.get("https://www.tikwm.com/api/feed/search", params={"keywords": q + " 4k", "count": 10}, timeout=12)
                        if res.status_code == 200:
                            vids = res.json().get('data', {}).get('videos', [])
                            for v in vids:
                                v_id = v.get('video_id')
                                if v_id and clip_tracker.is_overused(v_id): continue
                                if v.get('play'):
                                    with open(output_file, 'wb') as f:
                                        f.write(requests.get(v['play']).content)
                                    clip_tracker.mark_used(v_id)
                                    success = True; break
                    
                    elif src == "youtube":
                        subprocess.run(["yt-dlp", "-f", "bestvideo[ext=mp4]/best", "-o", output_file, f"ytsearch1:{q} vertical"], check=True)
                        success = True; break
                except: continue

# --- Step 3: Special Effects (Memes & Captions) ---
def create_caption_clips(words, target_size):
    from moviepy.editor import TextClip
    w, h = target_size
    clips = []
    
    def pop_effect(t):
        if t < 0.1: return 0.8 + (t / 0.1) * 0.3
        elif t < 0.2: return 1.1 - ((t - 0.1) / 0.1) * 0.1
        return 1.0

    for word in words:
        dur = word["end"] - word["start"]
        if dur <= 0: continue
        try:
            txt = TextClip(word["word"].upper(), fontsize=CAPTION_SIZE, color=CAPTION_COLOR, 
                           stroke_color="black", stroke_width=2, method="label")
            txt = txt.set_start(word["start"]).set_duration(dur).set_position(('center', h * 0.45)).resize(pop_effect)
            clips.append(txt)
        except: continue
    return clips

def add_memes(final_video):
    if not SHOW_MEMES: return final_video
    from moviepy.editor import VideoFileClip, vfx, CompositeVideoClip
    meme_queries = ["green screen meme", "confused travolta green", "funny green screen"]
    meme_clips = [final_video]
    duration = final_video.duration
    
    for i, start_t in enumerate([duration * 0.2, duration * 0.7]):
        q = meme_queries[i % len(meme_queries)]
        path = CLIPS_DIR / f"meme_{i}.mp4"
        try:
            if not path.exists():
                res = requests.get("https://www.tikwm.com/api/feed/search", params={"keywords": q}, timeout=10)
                url = res.json().get('data', {}).get('videos', [{}])[0].get('play')
                if url: 
                    with open(path, 'wb') as f: f.write(requests.get(url).content)
            
            if path.exists():
                m = VideoFileClip(str(path)).subclip(0, 3).fx(vfx.mask_color, color=[0, 255, 0], thr=100, s=5)
                m = m.resize(height=final_video.h * 0.35).set_start(start_t).set_position(("center", "bottom"))
                meme_clips.append(m)
        except: continue
    return CompositeVideoClip(meme_clips)

# --- Step 4: Final Assembly ---
def assemble_video():
    from moviepy.editor import VideoFileClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips, ColorClip, CompositeAudioClip
    target_w, target_h = 1080, 1920
    clips = []
    for i, seg in enumerate(segments):
        p = CLIPS_DIR / f"clip_{i:03d}.mp4"
        dur = time_to_seconds(seg["end"]) - time_to_seconds(seg["start"])
        if p.exists():
            c = VideoFileClip(str(p))
            scale = max(target_w/c.w, target_h/c.h)
            c = c.resize(scale).crop(x_center=c.w/2, y_center=c.h/2, width=target_w, height=target_h).subclip(0, min(dur, c.duration))
            clips.append(c)
        else: clips.append(ColorClip((target_w, target_h), color=(0,0,0), duration=dur))

    final = concatenate_videoclips(clips, method="compose")
    narration_path = OUTPUT_DIR / "narration.mp3"
    if narration_path.exists():
        audio = AudioFileClip(str(narration_path))
        if final.duration < audio.duration: final = final.set_duration(audio.duration)
        final = add_memes(final)
        
        words = generate_transcription(narration_path)
        caption_clips = create_caption_clips(words, (target_w, target_h))
        
        # SFX & Music
        layers = [audio]
        whoosh_p = ASSETS_DIR / "whoosh.mp3"
        if whoosh_p.exists():
            whoosh = AudioFileClip(str(whoosh_p))
            curr = 0
            for seg in segments:
                if curr > 0: layers.append(whoosh.set_start(curr - 0.1))
                curr += (time_to_seconds(seg["end"]) - time_to_seconds(seg["start"]))
        
        music_p = ASSETS_DIR / "background.mp3"
        if music_p.exists():
            layers.append(AudioFileClip(str(music_p)).volumex(0.15).loop(duration=audio.duration))

        final = final.set_audio(CompositeAudioClip(layers))
        final = CompositeVideoClip([final] + caption_clips)

    slug = re.sub(r'[^a-z0-9]+', '_', PROJECT_TITLE.lower()).strip('_') or PROJECT_ID
    out = str(OUTPUT_DIR / f"{slug}.mp4")
    final.write_videofile(out, fps=30, codec="libx264", audio_codec="aac", preset="fast")
    return out

def update_database(status="completed", url=None):
    db_url = os.environ.get("TURSO_DATABASE_URL")
    db_token = os.environ.get("TURSO_AUTH_TOKEN")
    if not db_url: return
    try:
        import libsql_experimental as libsql
        conn = libsql.connect(db_url, auth_token=db_token)
        conn.execute("""UPDATE projects SET status=?, video_url=?, title=?, scraper_mode=?, 
                        caption_color=?, caption_font=?, caption_size=?, show_memes=?, 
                        updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                    (status, url or "", PROJECT_TITLE, SCRAPER_MODE, CAPTION_COLOR, 
                     CAPTION_FONT, CAPTION_SIZE, 1 if SHOW_MEMES else 0, PROJECT_ID))
        conn.commit()
    except Exception as e: print(f"DB Update Failed: {e}")

async def main():
    ensure_assets()
    await generate_voice()
    download_clips()
    path = assemble_video()
    update_database("completed", url=str(path))
    print("VIRAL VIDEO READY!")

if __name__ == "__main__": asyncio.run(main())
