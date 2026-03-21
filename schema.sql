CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  query TEXT,
  niche TEXT,
  script TEXT,
  voiceMode TEXT,
  voiceStyle TEXT,
  status TEXT DEFAULT 'pending',
  mp3File TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
