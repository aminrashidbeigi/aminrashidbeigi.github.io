// Copies posts from the @aminrbg Telegram channel to aminrb.me, one question at a time.
//
// POST /webhook   Telegram updates (checked with the webhook secret)
//
// New channel post      -> the bot asks Amin: publish (with a topic) or skip
// Old post forwarded    -> queued; the bot asks about the oldest queued post, one at a time
// Edit of a published post -> the bot asks whether to update the blog copy
// Publish               -> page bundle committed to GitHub, the Pages workflow deploys it
// /apps, application buttons -> table talk applications (see applications.ts)

import { commitFiles, type FileChange } from "./github";
import * as applications from "./applications";
import { buildPost, TOPICS, type Entity, type Part } from "./post";

export interface Env {
  DB: D1Database;
  TALKS_DB: D1Database; // table talk applications, written by worker/
  CHANNEL: string; // channel username, without @
  SITE_ORIGIN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  // Secrets
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  OWNER_ID: string; // Amin's Telegram user id; questions go to this private chat
  GITHUB_TOKEN: string;
}

interface Chat {
  id: number;
  type: string;
  username?: string;
}

interface Message {
  message_id: number;
  date: number;
  chat: Chat;
  from?: { id: number };
  text?: string;
  entities?: Entity[];
  caption?: string;
  caption_entities?: Entity[];
  photo?: { file_id: string; width: number; height: number }[];
  media_group_id?: string;
  forward_origin?: { type: string; date: number; chat?: Chat; message_id?: number };
  [key: string]: unknown;
}

interface CallbackQuery {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number };
}

interface Update {
  channel_post?: Message;
  edited_channel_post?: Message;
  message?: Message;
  callback_query?: CallbackQuery;
}

interface PostRow {
  key: string;
  state: "queued" | "asked" | "publishing" | "published" | "skipped";
  backlog: number;
  date: number;
  topic: string | null;
  slug: string | null;
  question_id: number | null;
}

// Media we link to instead of copying, and messages that are never blog posts.
const LINKED_MEDIA = ["video", "animation", "document", "audio", "voice", "video_note"];
const NOT_POSTS = ["poll", "sticker", "dice", "location", "venue", "contact", "game"];

// The keyboard under the chat, so nothing has to be remembered, and the same commands in
// Telegram's "/" menu.
const KEYS = { apps: "Table talks", status: "Blog posts", help: "Help" };
const KEYBOARD = {
  keyboard: [[{ text: KEYS.apps }, { text: KEYS.status }, { text: KEYS.help }]],
  resize_keyboard: true,
  is_persistent: true,
};
const COMMANDS = [
  { command: "apps", description: "Table talk applications" },
  { command: "status", description: "Blog posts waiting, queued, published" },
  { command: "help", description: "What this bot does and how to use it" },
];

// Albums arrive as one update per photo, and a batch of forwards as one update
// per message. Wait this long before asking so the rest has arrived.
const SETTLE_MS = 3000;
const PREVIEW_CHARS = 600;
// A publish runs after the button is answered, and Cloudflare stops that work 30 seconds later
// without running any catch. A post still publishing this long after the tap was cut off, and
// its buttons work again.
const CUT_OFF = "state = 'publishing' AND COALESCE(decided_at, '') < datetime('now', '-2 minutes')";
// Every outside call gets this long, so a slow one fails with a message instead of being cut off.
const FETCH_TIMEOUT_MS = 10_000;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhook" || request.method !== "POST") return new Response("Not found", { status: 404 });
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Always answer 200: Telegram retries failed updates, and a retry must not ask twice.
    try {
      await handle((await request.json()) as Update, env, ctx);
    } catch (err) {
      console.error(err);
    }
    return new Response("ok");
  },
} satisfies ExportedHandler<Env>;

async function handle(update: Update, env: Env, ctx: ExecutionContext): Promise<void> {
  if (update.channel_post && isChannel(update.channel_post.chat, env)) {
    const msg = update.channel_post;
    if (!msg.forward_origin) await ingest(env, ctx, msg, msg.message_id, msg.date, false);
  } else if (update.edited_channel_post && isChannel(update.edited_channel_post.chat, env)) {
    await edited(env, update.edited_channel_post);
  } else if (update.message && isOwner(update.message.from?.id, env) && update.message.chat.type === "private") {
    await ownerMessage(env, ctx, update.message);
  } else if (update.callback_query && applications.isApplicationCallback(update.callback_query.data)) {
    await applicationButton(env, update.callback_query);
  } else if (update.callback_query) {
    await callback(env, ctx, update.callback_query);
  }
}

async function ownerMessage(env: Env, ctx: ExecutionContext, msg: Message): Promise<void> {
  const origin = msg.forward_origin;
  if (origin?.type === "channel" && origin.chat && isChannel(origin.chat, env) && origin.message_id) {
    await ingest(env, ctx, msg, origin.message_id, origin.date, true);
  } else if (origin) {
    // Anything else forwarded, such as a channel repost of another channel's post: ignore.
  } else if (msg.text === KEYS.apps || msg.text?.startsWith("/apps")) {
    const reply = await applications.command(env.TALKS_DB, msg.text === KEYS.apps ? "/apps" : msg.text, env.SITE_ORIGIN);
    await tg(env, "sendMessage", { chat_id: env.OWNER_ID, link_preview_options: { is_disabled: true }, ...reply });
  } else if (msg.text === KEYS.status || msg.text?.startsWith("/status")) {
    await status(env);
  } else {
    await help(env);
  }
}

// Also the answer to /start and to anything the bot does not understand. It brings back the
// keyboard and refreshes the "/" menu.
async function help(env: Env): Promise<void> {
  await tg(env, "setMyCommands", { commands: COMMANDS, scope: { type: "chat", chat_id: Number(env.OWNER_ID) } });
  await tg(env, "sendMessage", {
    chat_id: env.OWNER_ID,
    link_preview_options: { is_disabled: true },
    reply_markup: KEYBOARD,
    text:
      `Use the keys below; everything else is a button on a message.\n\n` +
      `${KEYS.apps}\n` +
      `Applications per session. Tap a session to see everyone, tap a person to confirm, ` +
      `move to the waitlist, decline or mark a no-show. The first seats fill automatically, ` +
      `later applicants go to the waitlist.\n\n` +
      `${KEYS.status}\n` +
      `New posts in @${env.CHANNEL} come here as questions: pick a topic to publish on the blog, or skip. ` +
      `This shows what is waiting and re-asks anything stuck.\n\n` +
      `Importing old posts\n` +
      `Forward them from the channel to me, many at once is fine. I ask about them one at a time, ` +
      `oldest first, and keep their original dates.`,
  });
}

// Stores one channel message and, for a new post, asks about it.
async function ingest(env: Env, ctx: ExecutionContext, msg: Message, id: number, date: number, backlog: boolean) {
  const part = toPart(msg, id);
  if (!part) return;
  const key = msg.media_group_id ? `g:${msg.media_group_id}` : `m:${id}`;

  // A message we already have is a Telegram retry, or an old post forwarded twice.
  const stored = await env.DB.prepare("INSERT OR IGNORE INTO messages (id, post_key, data) VALUES (?, ?, ?)")
    .bind(id, key, JSON.stringify(part))
    .run();
  if (!stored.meta.changes) return;

  // Only the first message of an album creates the post.
  const created = await env.DB.prepare("INSERT OR IGNORE INTO posts (key, backlog, date) VALUES (?, ?, ?)")
    .bind(key, backlog ? 1 : 0, date)
    .run();
  if (!created.meta.changes) return;

  ctx.waitUntil(
    (async () => {
      if (msg.media_group_id || backlog) await sleep(SETTLE_MS);
      if (backlog) await askNext(env);
      else await ask(env, key);
    })().catch((err) => console.error(err)),
  );
}

function toPart(msg: Message, id: number): Part | null {
  if (NOT_POSTS.some((k) => k in msg)) return null;
  const part: Part = { id };
  const text = msg.text ?? msg.caption;
  if (text) {
    part.text = text;
    part.entities = msg.entities ?? msg.caption_entities ?? [];
  }
  if (msg.photo?.length) {
    part.photo = [...msg.photo].sort((a, b) => b.width * b.height - a.width * a.height)[0].file_id;
  }
  const media = LINKED_MEDIA.find((k) => k in msg);
  if (media) part.media = media;
  return part.text || part.photo || part.media ? part : null;
}

// Asks about a new channel post.
async function ask(env: Env, key: string): Promise<void> {
  const claimed = await env.DB.prepare("UPDATE posts SET state = 'asked' WHERE key = ? AND state = 'queued'")
    .bind(key)
    .run();
  if (claimed.meta.changes) await sendQuestion(env, key);
}

// Asks about the oldest queued old post, unless one is already waiting for an answer.
async function askNext(env: Env): Promise<void> {
  const next = await env.DB.prepare(
    `UPDATE posts SET state = 'asked'
     WHERE key = (SELECT key FROM posts WHERE state = 'queued' AND backlog = 1 ORDER BY date, key LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM posts WHERE state IN ('asked', 'publishing') AND backlog = 1)
     RETURNING key`,
  ).first<{ key: string }>();
  if (next) await sendQuestion(env, next.key);
}

async function sendQuestion(env: Env, key: string): Promise<void> {
  const post = await getPost(env, key);
  const parts = await getParts(env, key);
  if (!post || !parts.length) return;

  const text = parts.map((p) => p.text ?? "").filter(Boolean).join("\n\n");
  // A photo, video or GIF without any text is not a blog post.
  if (!text) {
    await env.DB.prepare("UPDATE posts SET state = 'skipped', decided_at = datetime('now') WHERE key = ?")
      .bind(key)
      .run();
    if (post.backlog) await askNext(env);
    return;
  }
  const photos = parts.filter((p) => p.photo).length;
  const facts = [new Date(post.date * 1000).toISOString().slice(0, 10)];
  if (photos) facts.push(photos === 1 ? "1 photo" : `${photos} photos`);
  if (parts.some((p) => p.media)) facts.push("video/file (linked, not copied)");
  facts.push(postLink(env, parts));

  let heading = `New post in @${env.CHANNEL}`;
  if (post.backlog) {
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE state = 'queued' AND backlog = 1").first<{
      n: number;
    }>();
    heading = `Old post from @${env.CHANNEL}` + (left?.n ? ` (${left.n} more after this one)` : "");
  }
  const preview = text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + "…" : text;

  // Some channel posts were also written up on the blog by hand, under the same title.
  const slug = buildPost(parts, { channel: env.CHANNEL, date: post.date }).slug;
  if (await slugTaken(env, slug, key)) {
    facts.push(`⚠️ ${env.SITE_ORIGIN}/fa/${slug}/ already exists, so this may already be on the blog`);
  }

  const rows = [];
  for (let i = 0; i < TOPICS.length; i += 2) {
    rows.push(TOPICS.slice(i, i + 2).map((t) => ({ text: t.label, callback_data: `p|${key}|${t.slug}` })));
  }
  rows.push([
    { text: "Publish, no topic", callback_data: `p|${key}|` },
    { text: "Skip", callback_data: `s|${key}` },
  ]);

  const sent = await tg<{ message_id: number }>(env, "sendMessage", {
    chat_id: env.OWNER_ID,
    text: `${heading}\n${facts.join(" · ")}\n\n${preview}\n\nPublish on the blog? Pick a topic, or skip.`,
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: rows },
  });
  await env.DB.prepare("UPDATE posts SET question_id = ? WHERE key = ?").bind(sent.message_id, key).run();
}

async function callback(env: Env, ctx: ExecutionContext, query: CallbackQuery): Promise<void> {
  if (!isOwner(query.from.id, env)) {
    await tg(env, "answerCallbackQuery", { callback_query_id: query.id });
    return;
  }
  const [action, key, topic] = (query.data ?? "").split("|");
  const questionId = query.message?.message_id;
  let note = "";

  if (action === "p") {
    const claimed = await env.DB.prepare(
      `UPDATE posts SET state = 'publishing', topic = ?, decided_at = datetime('now')
       WHERE key = ? AND (state = 'asked' OR (${CUT_OFF} AND slug IS NULL))`,
    )
      .bind(topic || null, key)
      .run();
    if (claimed.meta.changes) {
      note = "Publishing…";
      ctx.waitUntil(publish(env, key, false, questionId));
    } else {
      note = "Already handled.";
    }
  } else if (action === "s") {
    const post = await env.DB.prepare(
      `UPDATE posts SET state = 'skipped', decided_at = datetime('now')
       WHERE key = ? AND (state = 'asked' OR (${CUT_OFF} AND slug IS NULL)) RETURNING backlog`,
    )
      .bind(key)
      .first<{ backlog: number }>();
    if (post) {
      note = "Skipped.";
      if (questionId) await edit(env, questionId, `⏭ Skipped ${await linkFor(env, key)}. I won't ask about it again.`);
      if (post.backlog) ctx.waitUntil(askNext(env));
    } else {
      note = "Already handled.";
    }
  } else if (action === "u") {
    const claimed = await env.DB.prepare(
      `UPDATE posts SET state = 'publishing', update_asked = 0, decided_at = datetime('now')
       WHERE key = ? AND ((state = 'published' AND update_asked = 1) OR (${CUT_OFF} AND slug IS NOT NULL))`,
    )
      .bind(key)
      .run();
    if (claimed.meta.changes) {
      note = "Updating…";
      ctx.waitUntil(publish(env, key, true, questionId));
    } else {
      note = "Already handled.";
    }
  } else if (action === "k") {
    await env.DB.prepare("UPDATE posts SET update_asked = 0 WHERE key = ?").bind(key).run();
    if (questionId) await edit(env, questionId, `Kept the blog copy of ${await linkFor(env, key)} as it was.`);
  }
  await tg(env, "answerCallbackQuery", { callback_query_id: query.id, text: note });
}

async function applicationButton(env: Env, query: CallbackQuery): Promise<void> {
  let note = "";
  if (isOwner(query.from.id, env)) {
    note = await applications.press(
      env.TALKS_DB,
      (method, body) => tg(env, method, body),
      env.OWNER_ID,
      query.message?.message_id,
      query.data,
      env.SITE_ORIGIN,
    );
  }
  await tg(env, "answerCallbackQuery", { callback_query_id: query.id, text: note });
}

async function publish(env: Env, key: string, isUpdate: boolean, questionId?: number): Promise<void> {
  const post = await getPost(env, key);
  const parts = await getParts(env, key);
  if (!post || !parts.length) return;
  try {
    const opts = {
      channel: env.CHANNEL,
      date: post.date,
      topic: post.topic ?? undefined,
      slug: post.slug ?? undefined,
    };
    let built = buildPost(parts, opts);
    if (!post.slug && (await slugTaken(env, built.slug, key))) {
      built = buildPost(parts, { ...opts, slug: `${built.slug}-${parts[0].id}` });
    }

    const images = await Promise.all(built.images.map((img) => download(env, img.fileId)));
    const files: FileChange[] = [
      { path: `${built.dir}/index.fa.md`, content: built.markdown },
      ...built.images.map((img, i) => ({ path: `${built.dir}/${img.name}`, content: images[i] })),
    ];
    const verb = isUpdate ? "Update" : "Add";
    await commitFiles(
      { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH },
      `${verb} Telegram post ${parts[0].id}: ${built.title}`,
      files,
    );

    await env.DB.prepare("UPDATE posts SET state = 'published', slug = ? WHERE key = ?")
      .bind(built.slug, key)
      .run();
    const page = `${env.SITE_ORIGIN}/fa/${encodeURIComponent(built.slug)}/`;
    const done = `${isUpdate ? "✅ Updated" : "✅ Published"} ${postLink(env, parts)}\n${page}\n\nLive once the site deploys, in a minute or two.`;
    if (questionId) await edit(env, questionId, done);
    else await say(env, done);
  } catch (err) {
    console.error(err);
    await env.DB.prepare(
      isUpdate
        ? "UPDATE posts SET state = 'published', update_asked = 1 WHERE key = ?"
        : "UPDATE posts SET state = 'asked' WHERE key = ?",
    )
      .bind(key)
      .run();
    const reason = err instanceof Error ? err.message : String(err);
    await say(env, `❌ Couldn't publish ${postLink(env, parts)}: ${reason.slice(0, 300)}\n\nTap the button again to retry.`);
  }
  if (post.backlog && !isUpdate) await askNext(env);
}

// A slug is taken when another Telegram post uses it or the site already serves it.
async function slugTaken(env: Env, slug: string, key: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 FROM posts WHERE slug = ? AND key <> ?").bind(slug, key).first();
  if (row) return true;
  const page = await fetch(`${env.SITE_ORIGIN}/fa/${encodeURIComponent(slug)}/`, {
    method: "HEAD",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return page.ok;
}

async function edited(env: Env, msg: Message): Promise<void> {
  const part = toPart(msg, msg.message_id);
  if (!part) return;
  const row = await env.DB.prepare("UPDATE messages SET data = ? WHERE id = ? RETURNING post_key")
    .bind(JSON.stringify(part), msg.message_id)
    .first<{ post_key: string }>();
  if (!row) return;
  // Unanswered posts just use the new text. Published ones get one question,
  // however many edits follow before Amin answers.
  const claimed = await env.DB.prepare(
    "UPDATE posts SET update_asked = 1 WHERE key = ? AND state = 'published' AND update_asked = 0",
  )
    .bind(row.post_key)
    .run();
  if (!claimed.meta.changes) return;
  await tg(env, "sendMessage", {
    chat_id: env.OWNER_ID,
    text: `✏️ You edited ${await linkFor(env, row.post_key)}, which is on the blog. Update the blog copy too?`,
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Update the blog", callback_data: `u|${row.post_key}` },
          { text: "Keep it as is", callback_data: `k|${row.post_key}` },
        ],
      ],
    },
  });
}

async function status(env: Env): Promise<void> {
  // Recover anything a failed send left without a question.
  const stuck = await env.DB.prepare("SELECT key FROM posts WHERE state = 'queued' AND backlog = 0").all<{
    key: string;
  }>();
  for (const { key } of stuck.results) await ask(env, key);
  // Posts whose publish was cut off go back to how they were before the tap, and new ones are
  // asked about again. A cut-off update keeps its old "Update the blog" buttons.
  const cut = await env.DB.prepare(
    `UPDATE posts SET state = IIF(slug IS NULL, 'asked', 'published'), update_asked = IIF(slug IS NULL, 0, 1)
     WHERE ${CUT_OFF} RETURNING key, slug`,
  ).all<{ key: string; slug: string | null }>();
  for (const { key, slug } of cut.results) if (!slug) await sendQuestion(env, key);
  await askNext(env);

  const counts = await env.DB.prepare(
    "SELECT state, backlog, COUNT(*) AS n FROM posts GROUP BY state, backlog",
  ).all<{ state: string; backlog: number; n: number }>();
  const n = (state: string, backlog?: number) =>
    counts.results
      .filter((r) => r.state === state && (backlog === undefined || r.backlog === backlog))
      .reduce((sum, r) => sum + r.n, 0);
  await say(
    env,
    [
      `Waiting for your answer: ${n("asked") + n("publishing")}`,
      `Old posts queued: ${n("queued", 1)}`,
      `Published: ${n("published")}`,
      `Skipped: ${n("skipped")}`,
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------

async function getPost(env: Env, key: string): Promise<PostRow | null> {
  return env.DB.prepare("SELECT key, state, backlog, date, topic, slug, question_id FROM posts WHERE key = ?")
    .bind(key)
    .first<PostRow>();
}

async function getParts(env: Env, key: string): Promise<Part[]> {
  const rows = await env.DB.prepare("SELECT data FROM messages WHERE post_key = ? ORDER BY id")
    .bind(key)
    .all<{ data: string }>();
  return rows.results.map((r) => JSON.parse(r.data) as Part);
}

async function linkFor(env: Env, key: string): Promise<string> {
  return postLink(env, await getParts(env, key));
}

function postLink(env: Env, parts: Part[]): string {
  return parts.length ? `https://t.me/${env.CHANNEL}/${parts[0].id}` : `@${env.CHANNEL}`;
}

async function download(env: Env, fileId: string): Promise<Uint8Array> {
  const file = await tg<{ file_path: string }>(env, "getFile", { file_id: fileId });
  const response = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Telegram file download: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function say(env: Env, text: string): Promise<void> {
  await tg(env, "sendMessage", { chat_id: env.OWNER_ID, text, link_preview_options: { is_disabled: true } });
}

async function edit(env: Env, messageId: number, text: string): Promise<void> {
  await tg(env, "editMessageText", {
    chat_id: env.OWNER_ID,
    message_id: messageId,
    text,
    link_preview_options: { is_disabled: true },
  });
}

async function tg<T = unknown>(env: Env, method: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const data = (await response.json()) as {
      ok: boolean;
      result: T;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (data.ok) return data.result;
    if (response.status === 429 && attempt < 2) {
      await sleep((data.parameters?.retry_after ?? 1) * 1000);
      continue;
    }
    throw new Error(`Telegram ${method}: ${data.description ?? response.status}`);
  }
}

function isChannel(chat: Chat, env: Env): boolean {
  return chat.username?.toLowerCase() === env.CHANNEL.toLowerCase();
}

function isOwner(id: number | undefined, env: Env): boolean {
  return id !== undefined && String(id) === env.OWNER_ID;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
