CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  talk       TEXT NOT NULL,
  lang       TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  years      INTEGER NOT NULL,
  country    TEXT NOT NULL,
  contact    TEXT NOT NULL,
  situation  TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'applied',  -- applied | confirmed | waitlist | declined | no_show
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_talk ON applications (talk, state);
