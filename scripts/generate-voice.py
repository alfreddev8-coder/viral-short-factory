import edge_tts
import asyncio

async def generate():
    voice = "en-US-GuyNeural"  # from project config
    text = "full script text"   # from project JSON
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save("output/narration.mp3")

asyncio.run(generate())
