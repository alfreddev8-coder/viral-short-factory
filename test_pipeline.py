import os
os.environ["PROJECT_ID"] = "testrun"
os.environ["SEGMENTS_JSON"] = '[{"clipQuery": "cat jumps off table", "start": "0.0", "end": "5.0"}]'
os.environ["VOICE_MODE"] = "upload" # to skip edged-tts if not installed
os.environ["AUDIO_URL"] = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"

import automation.pipeline as p
import asyncio

asyncio.run(p.main())
