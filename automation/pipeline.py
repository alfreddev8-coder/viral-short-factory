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
AUDIO_URL = os.environ.get("AUDIO_URL", "")

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
        if AUDIO_URL:
            if AUDIO_URL.startswith("uploads/"):
                import shutil
                print(f"Copying uploaded custom audio from repository: {AUDIO_URL}")
                try:
                    shutil.copy(AUDIO_URL, OUTPUT_DIR / "narration.mp3")
                    print("Custom audio copied successfully.")
                except Exception as e:
                    raise RuntimeError(f"Failed to copy custom audio from repo path {AUDIO_URL}: {e}")
            else:
                import urllib.request
                print(f"Downloading uploaded custom audio from {AUDIO_URL}")
                try:
                    # Provide a User-Agent to prevent 403s on some hosts
                    req = urllib.request.Request(AUDIO_URL, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response, open(OUTPUT_DIR / "narration.mp3", 'wb') as out_file:
                        out_file.write(response.read())
                    print("Custom audio downloaded successfully.")
                except Exception as e:
                    raise RuntimeError(f"Failed to download custom audio from {AUDIO_URL}: {e}")
        else:
            raise RuntimeError("Using uploaded MP3 mode but no custom AUDIO_URL was provided. Audio is missing. Aborting.")
        return
    import edge_tts
    voice = VOICE_MAP.get(VOICE_STYLE, "en-US-GuyNeural")
    try:
        communicate = edge_tts.Communicate(SCRIPT, voice)
        await communicate.save(str(OUTPUT_DIR / "narration.mp3"))
        print(f"Generated voiceover with {voice} (edge-tts)")
    except Exception as e:
        print(f"edge-tts failed (possibly IP block): {e}")
        print("Falling back to gTTS...")
        from gtts import gTTS
        tts = gTTS(text=SCRIPT, lang='en', slow=False)
        tts.save(str(OUTPUT_DIR / "narration.mp3"))
        print("Generated voiceover with gTTS fallback")

# Step 2: Download clips (Try TikTok first for all keywords, fallback to YouTube Shorts)
def download_clips():
    import urllib.request
    import urllib.parse
    import time
    
    downloaded_count = 0
    for i, seg in enumerate(segments):
        queries = []
        main_query = seg.get("clipQuery", "").strip()
        if main_query:
            queries.append(main_query)
            
        keywords = seg.get("keywords", [])
        if isinstance(keywords, list):
            for kw in keywords:
                if kw and kw.strip() not in queries:
                    queries.append(kw.strip())
        elif isinstance(keywords, str) and keywords.strip():
            if keywords.strip() not in queries:
                queries.append(keywords.strip())
                
        if not queries:
            queries = ["random aesthetic video"]
            
        output_file = str(CLIPS_DIR / f"clip_{i:03d}.mp4")
        success = False
        
        print(f"\n--- Processing Clip {i} ---")
        print(f"Queries to try: {queries}")
        
        # 1) Try TikTok for all queries first (Preferred: No watermark)
        for query in queries:
            if success: break
            print(f"Downloading clip {i}: '{query}' (Trying TikTok)")
            try:
                safe_query = urllib.parse.quote(query + " shorts")
                tikwm_url = f"https://www.tikwm.com/api/feed/search?keywords={safe_query}&count=5"
                req = urllib.request.Request(tikwm_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=15) as res:
                    data = json.loads(res.read())
                
                videos = data.get('data', {}).get('videos', [])
                if videos and len(videos) > 0:
                    play_url = videos[0].get('play')
                    if play_url:
                        video_req = urllib.request.Request(play_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(video_req, timeout=30) as v_res:
                            with open(output_file, 'wb') as f:
                                f.write(v_res.read())
                        print(f"Successfully downloaded clip {i} from TikTok using '{query}'.")
                        success = True
                if not success:
                    print(f"TikTok API returned no valid video for '{query}'.")
            except Exception as e:
                print(f"TikTok search/download failed for '{query}': {e}")
            
            if not success:
                time.sleep(1) # Be nice to the API before next query
            
        # 2) Fallback to YouTube Shorts for all queries
        if not success:
            for query in queries:
                if success: break
                search_target = f"ytsearch1:{query} shorts"
                print(f"Downloading clip {i}: '{query}' (via YouTube Shorts fallback)")
                try:
                    subprocess.run([
                        "yt-dlp",
                        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                        "--merge-output-format", "mp4",
                        "-o", output_file,
                        "--max-downloads", "1",
                        "--no-warnings",
                        search_target
                    ], timeout=90, check=True)
                    print(f"Successfully downloaded clip {i} from YouTube Shorts using '{query}'.")
                    success = True
                except Exception as e:
                    print(f"Failed to download clip {i} from YouTube Shorts using '{query}': {e}")

        if success:
            downloaded_count += 1
        else:
            print(f"WARNING: Completely failed to download clip {i} after trying {len(queries)} queries.")

    if downloaded_count == 0:
        raise RuntimeError("Failed to download any clips from either TikTok or YouTube Shorts. The video would run as a black screen. Aborting pipeline.")


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
            (status, PROJECT_ID)
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
