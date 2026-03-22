import os
import json
import asyncio
import subprocess
import requests
import math
import whisper
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
ASSETS_DIR = Path("assets")
OUTPUT_DIR.mkdir(exist_ok=True)
CLIPS_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)

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

# Step 1.5: Generate Transcription
def generate_transcription(audio_path):
    print(f"Transcribing {audio_path}...")
    model = whisper.load_model("base")
    # Using word_timestamps=True for viral-style captions
    result = model.transcribe(str(audio_path), word_timestamps=True)
    
    words = []
    for segment in result["segments"]:
        for word_data in segment.get("words", []):
            words.append({
                "word": word_data["word"].strip(),
                "start": word_data["start"],
                "end": word_data["end"]
            })
    
    with open(OUTPUT_DIR / "transcription.json", "w") as f:
        json.dump(words, f, indent=2)
    return words

def ensure_assets():
    """Download essential SFX and music if they don't exist."""
    print("Ensuring viral assets (SFX/Music)...")
    # Using public royalty-free links (examples, may need to be replaced with more permanent ones)
    assets = {
        "whoosh.mp3": "https://pixabay.com/music/download/whoosh-6316.mp3",
        "background.mp3": "https://pixabay.com/music/download/phonk-dark-1234.mp3" # Placeholder for high-energy music
    }
    
    # Actually, pixabay download links are dynamic. 
    # I'll use some direct links from a known repository or just suggest the user to add them.
    # For now, I'll attempt to download a few or provide a skip if it fails.
    
    # BETTER: Use a single high-quality viral SFX pack if available.
    # Since I can't guarantee Pixabay links, I'll use some static ones from a known repo if found.
    # Or just log that they are missing and continue.
    
    for filename, url in assets.items():
        path = ASSETS_DIR / filename
        if not path.exists():
            print(f"Downloading {filename}...")
            try:
                # Note: Pixabay direct download might require specific headers or might not work directly.
                # I'll try a generic download but wrap it in try-except.
                res = requests.get(url, stream=True, timeout=15)
                if res.status_code == 200:
                    with open(path, "wb") as f:
                         for chunk in res.iter_content(8192):
                             f.write(chunk)
                else:
                    print(f"Failed to download {filename} (Status {res.status_code})")
            except Exception as e:
                print(f"Error downloading {filename}: {e}")

def create_caption_clips(words, target_size):
    from moviepy.editor import TextClip, CompositeVideoClip
    w, h = target_size
    clips = []
    
    # Viral style settings
    # Ubuntu common fonts: 'DejaVu-Sans-Bold', 'Liberation-Sans-Bold', 'Ubuntu-Bold'
    font = "DejaVu-Sans-Bold" 
    font_size = 80
    stroke_width = 2
    highlight_color = "yellow"
    normal_color = "white"
    
    for i, word in enumerate(words):
        duration = word["end"] - word["start"]
        if duration <= 0: continue
        
        # Create the "Pop" animation (slight bounce)
        def pop_effect(t):
            # Rapid scale from 0.8 to 1.1 then back to 1.0
            if t < 0.1:
                return 0.8 + (t / 0.1) * 0.3
            elif t < 0.2:
                return 1.1 - ((t - 0.1) / 0.1) * 0.1
            return 1.0

        try:
            # We show only 1-3 words at a time. For now, let's try 1 word (ultra-viral style)
            # To show context, we could show the current word in highlight and surrounding ones white.
            # But the example uses very fast 1-word-at-a-time or very few.
            
            txt = TextClip(
                word["word"].upper(),
                fontsize=font_size,
                color=highlight_color,
                stroke_color="black",
                stroke_width=stroke_width,
                method="label"
            )
            
            # Position in the middle-ish
            txt = txt.set_start(word["start"]).set_duration(duration).set_position(('center', h * 0.45))
            
            # Add pop effect
            txt = txt.resize(pop_effect)
            
            clips.append(txt)
        except Exception as e:
            print(f"Failed to create TextClip for word '{word['word']}': {e}")
            
    return clips

# Step 2: Download clips (Pexels -> TikTok -> YouTube B-Roll)
def download_clips():
    import urllib.request
    import urllib.parse
    import time
    
    PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
    
    downloaded_count = 0
    for i, seg in enumerate(segments):
        queries = []
        main_query = seg.get("clipQuery", "").strip()
        if main_query:
            queries.append(main_query)
        queries = [seg["clipQuery"]] if seg.get("clipQuery") else []
        
        # Ensure keywords are processed as a list of strings
        keywords_data = seg.get("keywords", [])
        if isinstance(keywords_data, str): # Handle case where keywords might be a single string
            keywords_data = [keywords_data]
        
        for kw in keywords_data:
            if kw and kw.strip() not in queries:
                queries.append(kw.strip())
                
        if not queries:
            queries = ["random aesthetic nature"]
            
        output_file = str(CLIPS_DIR / f"clip_{i:03d}.mp4")
        success = False
        
        print(f"\n--- Processing Clip {i} ---")
        
        # 1) Try Pexels (Highest quality, cleanest)
        if PEXELS_API_KEY:
            headers = {
                "Authorization": PEXELS_API_KEY.strip(),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            }
            for query in queries:
                if success: break
                print(f"Downloading clip {i}: '{query}' (Trying Pexels)")
                try:
                    pexels_url = "https://api.pexels.com/videos/search"
                    params = {
                        "query": query,
                        "per_page": 1,
                        "orientation": "portrait"
                    }
                    res = requests.get(pexels_url, headers=headers, params=params, timeout=15)
                    
                    if res.status_code != 200:
                        print(f"Pexels API error {res.status_code} for query '{query}': {res.text[:200]}...")
                        # continue # already in loop
                    else:
                        data = res.json()
                        videos = data.get('videos', [])
                        if videos:
                            # Get the best quality mp4 link
                            video_files = videos[0].get('video_files', [])
                            # Look for HD or high quality
                            best_file = next((f for f in video_files if f.get('width', 0) >= 720), video_files[0])
                            link = best_file.get('link')
                            if link:
                                v_res = requests.get(link, stream=True, timeout=30)
                                v_res.raise_for_status() # Raise an exception for HTTP errors
                                with open(output_file, 'wb') as f:
                                    for chunk in v_res.iter_content(chunk_size=8192):
                                        f.write(chunk)
                                print(f"Successfully downloaded clean stock from Pexels using '{query}'.")
                                success = True
                            else:
                                print(f"Pexels: No video link found for query '{query}'.")
                        else:
                            print(f"Pexels: No videos found for query '{query}'.")
                except requests.exceptions.RequestException as e:
                    print(f"Pexels failed for '{query}': {e}")
                except Exception as e:
                    print(f"Pexels unexpected error for '{query}': {e}")

        # 2) Try TikTok (No watermark via TikWM)
        if not success:
            for query in queries:
                if success: break
                print(f"Downloading clip {i}: '{query}' (Trying TikTok)")
                try:
                    tikwm_url = "https://www.tikwm.com/api/feed/search"
                    params = {"keywords": query + " 4k no text", "count": 5}
                    headers = {'User-Agent': 'Mozilla/5.0'}
                    res = requests.get(tikwm_url, params=params, headers=headers, timeout=15)
                    res.raise_for_status() # Raise an exception for HTTP errors
                    
                    data = res.json()
                    videos = data.get('data', {}).get('videos', [])
                    if videos and len(videos) > 0:
                        play_url = videos[0].get('play')
                        if play_url:
                            v_res = requests.get(play_url, stream=True, timeout=30, headers=headers)
                            v_res.raise_for_status() # Raise an exception for HTTP errors
                            with open(output_file, 'wb') as f:
                                for chunk in v_res.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            print(f"Successfully downloaded clip {i} from TikTok using '{query}'.")
                            success = True
                        else:
                            print(f"TikTok: No play URL found for query '{query}'.")
                    else:
                        print(f"TikTok: No videos found for query '{query}'.")
                except requests.exceptions.RequestException as e:
                    print(f"TikTok failed for '{query}': {e}")
                except Exception as e:
                    print(f"TikTok unexpected error for '{query}': {e}")
                if not success: time.sleep(0.5)

        # 3) Fallback to YouTube B-Roll (Search for documentaries/raw footage to crop)
        if not success:
            for query in queries:
                if success: break
                # Modified search to target cleaner documentary/b-roll content
                search_target = f"ytsearch1:{query} b-roll documentary footage"
                print(f"Downloading clip {i}: '{query}' (via YouTube B-Roll fallback)")
                try:
                    subprocess.run([
                        "yt-dlp",
                        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                        "--merge-output-format", "mp4",
                        "-o", output_file,
                        "--max-downloads", "1",
                        "--no-warnings",
                        search_target
                    ], timeout=120, check=True)
                    print(f"Successfully downloaded clip {i} from YouTube using '{query}'.")
                    success = True
                except Exception as e:
                    print(f"YouTube failed for '{query}': {e}")

        if success:
            downloaded_count += 1
        else:
            print(f"WARNING: Completely failed to download clip {i} after all fallbacks.")

    if downloaded_count == 0:
        raise RuntimeError("Failed to download any clips. Aborting pipeline.")


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
        audio_duration = audio.duration
        
        if final_video.duration < audio_duration:
            print(f"Stretching final video {final_video.duration:.2f}s -> {audio_duration:.2f}s to match audio")
            final_video = final_video.set_duration(audio_duration)
        
        # Add Captions
        print("Overlaying captions...")
        words = generate_transcription(narration_path)
        caption_clips = create_caption_clips(words, (target_w, target_h))
        
        # SFX Integration
        sfx_clips = []
        # Add Whoosh SFX at each segment transition
        whoosh_path = ASSETS_DIR / "whoosh.mp3"
        if whoosh_path.exists():
            whoosh = AudioFileClip(str(whoosh_path))
            current_time = 0
            for seg in segments:
                duration = time_to_seconds(seg["end"]) - time_to_seconds(seg["start"])
                if current_time > 0:
                     sfx_clips.append(whoosh.set_start(current_time - 0.1))
                current_time += duration

        # Music Integration
        music_path = ASSETS_DIR / "background.mp3"
        music_audio = None
        if music_path.exists():
             music_audio = AudioFileClip(str(music_path)).volumex(0.15).loop(duration=audio_duration)

        # Mix all audio
        from moviepy.editor import CompositeAudioClip
        audio_layers = [audio]
        if sfx_clips:
            audio_layers.extend(sfx_clips)
        if music_audio:
            audio_layers.append(music_audio)
            
        final_audio = CompositeAudioClip(audio_layers)
        final_video = final_video.set_audio(final_audio)
        
        # Combine base video with captions
        final_video = CompositeVideoClip([final_video] + caption_clips)
    else:
        print("No narration audio found to sync duration.")

    output_path = str(OUTPUT_DIR / f"{PROJECT_ID}_final.mp4")
    final_video.write_videofile(
        output_path, fps=30, codec="libx264",
        audio_codec="aac", preset="fast",
        threads=4
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

    print("\n--- Step 0: Ensure Assets ---")
    ensure_assets()

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
