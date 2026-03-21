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
    communicate = edge_tts.Communicate(SCRIPT, voice)
    await communicate.save(str(OUTPUT_DIR / "narration.mp3"))
    print(f"Generated voiceover with {voice}")

# Step 2: Download clips from TikTok
def download_clips():
    downloaded_count = 0
    for i, seg in enumerate(segments):
        query = seg.get("clipQuery", "")
        if not query:
            continue
        # Search TikTok and download first result
        search_target = f"https://www.tiktok.com/search?q={query.replace(' ', '%20')}"
        output_file = str(CLIPS_DIR / f"clip_{i:03d}.mp4")
        print(f"Downloading clip {i}: {query}")
        try:
            subprocess.run([
                "yt-dlp",
                "--no-watermark",
                "-o", output_file,
                "--max-downloads", "1",
                search_target
            ], timeout=90, check=True)
            downloaded_count += 1
        except Exception as e:
            print(f"Failed to download clip {i} from TikTok: {e}")

    if downloaded_count == 0:
        raise RuntimeError("Failed to download any clips from TikTok. The video would run as a black screen. Aborting pipeline.")


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
            "UPDATE projects SET status = ? WHERE id = ?",
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
