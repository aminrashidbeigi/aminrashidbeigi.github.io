// Table talk applications for aminrb.me.
//
// POST /apply   stores an application in D1 and notifies Amin on Telegram
// GET  /seats   returns { confirmed } for one session
//
// Routed at aminrb.me/api/*, so a leading /api is stripped from the path.

import { isSlug, parseLang, validate, type Application, type Lang } from "./validate";

export interface Env {
  DB: D1Database;
  SITE_ORIGIN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // Optional. When set, the form must carry a valid Turnstile token.
  TURNSTILE_SECRET?: string;
}

interface Talk {
  slug: string;
  lang: string;
  seats: number;
  status: "open" | "full" | "done";
  eventstart: string;
}

type State = "applied" | "waitlist";

const TALKS_CACHE_SECONDS = 300;
const RETENTION_DAYS = 90;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/)/, "");

    if (path === "/apply" && request.method === "POST") return apply(request, env, ctx);
    if (path === "/seats" && request.method === "GET") return seats(url, env);
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(cleanup(env));
  },
} satisfies ExportedHandler<Env>;

async function apply(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(sitePath(env, "en", "/table-talks/?error=1"));
  }

  // Honeypot: look like a success, store nothing.
  const trap = form.get("website");
  if (typeof trap === "string" && trap !== "") {
    return redirect(thanksPath(env, parseLang(form.get("lang")), "applied"));
  }

  const result = validate(form);
  if (!result.ok) {
    return redirect(talkPath(env, result.lang, result.talk, "1"));
  }
  const app = result.value;

  if (env.TURNSTILE_SECRET && !(await turnstileOk(env.TURNSTILE_SECRET, form.get("cf-turnstile-response")))) {
    return redirect(talkPath(env, app.lang, app.talk, "1"));
  }

  let talks: Talk[];
  try {
    talks = await loadTalks(env);
  } catch {
    return redirect(talkPath(env, app.lang, app.talk, "1"));
  }
  // The same session appears once per site language. Accept while any copy is open or full,
  // and treat it as full when any copy says so.
  const known = talks.filter((t) => t.slug === app.talk);
  if (known.length === 0) {
    return redirect(talkPath(env, app.lang, undefined, "closed"));
  }
  const copies = known.filter((t) => t.status === "open" || t.status === "full");
  if (copies.length === 0) {
    return redirect(talkPath(env, app.lang, app.talk, "closed"));
  }

  const duplicate = await env.DB.prepare(
    "SELECT 1 FROM applications WHERE talk = ? AND lower(email) = lower(?) LIMIT 1",
  )
    .bind(app.talk, app.email)
    .first();
  if (duplicate) {
    return redirect(talkPath(env, app.lang, app.talk, "duplicate"));
  }

  const seatCount = Math.min(...copies.map((t) => t.seats));
  const confirmed = await confirmedCount(env, app.talk);
  const state: State = copies.some((t) => t.status === "full") || confirmed >= seatCount ? "waitlist" : "applied";

  await env.DB.prepare(
    `INSERT INTO applications (talk, lang, email, name, role, workplace, experience, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(app.talk, app.lang, app.email, app.name, app.role, app.workplace, app.experience, state)
    .run();

  ctx.waitUntil(notify(env, app, state).catch(() => {}));

  return redirect(thanksPath(env, app.lang, state));
}

async function seats(url: URL, env: Env): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": env.SITE_ORIGIN,
    "Cache-Control": "public, max-age=60",
  };
  const talk = url.searchParams.get("talk");
  if (!isSlug(talk)) {
    return new Response(JSON.stringify({ error: "unknown talk" }), { status: 400, headers });
  }
  return new Response(JSON.stringify({ confirmed: await confirmedCount(env, talk) }), { headers });
}

async function confirmedCount(env: Env, talk: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM applications WHERE talk = ? AND state = 'confirmed'")
    .bind(talk)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// The site's machine-readable session list, cached for five minutes with the Cache API.
async function loadTalks(env: Env): Promise<Talk[]> {
  const source = `${env.SITE_ORIGIN}/table-talks/index.json`;
  const cache = caches.default;
  let response = await cache.match(source);
  if (!response) {
    const fresh = await fetch(source);
    if (!fresh.ok) throw new Error(`talks list: HTTP ${fresh.status}`);
    response = new Response(await fresh.text(), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${TALKS_CACHE_SECONDS}` },
    });
    await cache.put(source, response.clone());
  }
  return (await response.json()) as Talk[];
}

// One private message to Amin. The bot never contacts applicants or posts in the channel.
async function notify(env: Env, app: Application, state: State): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = [
    `Table talk application: ${app.talk} (${state})`,
    `Name: ${app.name || "-"}`,
    `Role: ${app.role || "-"}`,
    `Works at: ${app.workplace || "-"}`,
    `Experience: ${app.experience ? `${app.experience} years` : "-"}`,
  ].join("\n");
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

async function turnstileOk(secret: string, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token === "") return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const outcome = (await response.json()) as { success?: boolean };
  return outcome.success === true;
}

// Deletes applications 90 days after their session. Rows for sessions that are no longer
// on the site are deleted 180 days after they were created.
async function cleanup(env: Env): Promise<void> {
  const talks = await loadTalks(env);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = new Set(talks.filter((t) => Date.parse(t.eventstart) < cutoff).map((t) => t.slug));
  const statements = [...expired].map((slug) => env.DB.prepare("DELETE FROM applications WHERE talk = ?").bind(slug));

  const known = [...new Set(talks.map((t) => t.slug))];
  const placeholders = known.map(() => "?").join(", ");
  statements.push(
    env.DB.prepare(
      `DELETE FROM applications WHERE created_at < datetime('now', '-180 days')` +
        (known.length ? ` AND talk NOT IN (${placeholders})` : ""),
    ).bind(...known),
  );
  await env.DB.batch(statements);
}

function sitePath(env: Env, lang: Lang, path: string): string {
  return `${env.SITE_ORIGIN}${lang === "fa" ? "/fa" : ""}${path}`;
}

function talkPath(env: Env, lang: Lang, talk: string | undefined, error: string): string {
  return sitePath(env, lang, talk ? `/table-talks/${talk}/?error=${error}#apply` : `/table-talks/?error=${error}`);
}

function thanksPath(env: Env, lang: Lang, state: State): string {
  return sitePath(env, lang, `/table-talks/thanks/${state === "waitlist" ? "?waitlist=1" : ""}`);
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
