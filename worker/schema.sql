CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  talk       TEXT NOT NULL,
  lang       TEXT NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',  -- optional fields are '' when left empty
  role       TEXT NOT NULL DEFAULT '',  -- engineer | senior | lead | manager | qa | other
  experience TEXT NOT NULL DEFAULT '',  -- 0-2 | 3-5 | 6-10 | 10+
  region     TEXT NOT NULL DEFAULT '',  -- iran | europe | other
  note       TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT 'applied',  -- applied | confirmed | waitlist | declined | no_show
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_talk ON applications (talk, state);
