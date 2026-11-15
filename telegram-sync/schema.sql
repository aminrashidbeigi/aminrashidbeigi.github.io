-- One row per blog-post candidate: a single channel message, or an album.
CREATE TABLE IF NOT EXISTS posts (
  key          TEXT PRIMARY KEY,                -- m:<message id> or g:<media group id>
  state        TEXT NOT NULL DEFAULT 'queued',  -- queued | asked | publishing | published | skipped
  backlog      INTEGER NOT NULL,                -- 1 for old posts forwarded to the bot
  date         INTEGER NOT NULL,                -- unix time of the original channel post
  topic        TEXT,
  slug         TEXT UNIQUE,
  question_id  INTEGER,                         -- the bot message that asks about it
  update_asked INTEGER NOT NULL DEFAULT 0,      -- 1 while "update the blog copy?" is unanswered
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_state ON posts (state, backlog, date);

-- Channel messages, keyed by their id in the channel.
CREATE TABLE IF NOT EXISTS messages (
  id       INTEGER PRIMARY KEY,
  post_key TEXT NOT NULL,
  data     TEXT NOT NULL  -- JSON: text, entities, photo file id, linked media type
);
CREATE INDEX IF NOT EXISTS idx_messages_post ON messages (post_key);
