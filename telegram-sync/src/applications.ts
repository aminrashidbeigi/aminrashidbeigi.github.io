// Table talk applications in the bot, navigated with buttons: /apps (or the "Table talks" key)
// shows one button per session, a session shows one button per person, and a person's card has
// buttons that change their state. New-application alerts are the same card. Applications live in the aminrb-table-talks database (written by worker/),
// bound here as TALKS_DB. worker/ imports card() so its alerts match.

export type State = "applied" | "confirmed" | "waitlist" | "declined" | "no_show";

export interface Application {
  id: number;
  talk: string;
  email: string;
  name: string;
  role: string;
  workplace: string;
  experience: string;
  state: State;
}

interface Button {
  text: string;
  callback_data: string;
}

export interface Reply {
  text: string;
  reply_markup?: { inline_keyboard: Button[][] };
}

export type Telegram = <T = unknown>(method: string, body: unknown) => Promise<T>;

interface Db {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
    };
  };
}

const ICON: Record<State, string> = { confirmed: "✅", applied: "📝", waitlist: "⏳", declined: "❌", no_show: "🚫" };
const ORDER: State[] = ["confirmed", "applied", "waitlist", "declined", "no_show"];
const ACTIONS: { state: State; label: string }[] = [
  { state: "confirmed", label: "✅ Confirm" },
  { state: "waitlist", label: "⏳ Move to waitlist" },
  { state: "declined", label: "❌ Decline" },
  { state: "no_show", label: "🚫 No-show" },
];
// One list message holds at most this many applicants: Telegram allows 100 buttons and
// 4096 characters per message.
export const LIST_LIMIT = 30;

// Callback data, at most 64 bytes:
//   a|<id>|<state>|<view>  set a state; view c redraws the card, l goes back to the session list
//   ao|<id>                open a person's card from the session list
//   al|<slug>              a session's list
//   as|                    all sessions
export type Callback =
  | { kind: "set"; id: number; state: State; view: "c" | "l" }
  | { kind: "open"; id: number }
  | { kind: "list"; talk: string }
  | { kind: "sessions" };

export function parseCallback(data: string | undefined): Callback | null {
  const [prefix, a, b, c] = (data ?? "").split("|");
  if (prefix === "a" && /^\d+$/.test(a ?? "") && b in ICON && (c === "c" || c === "l")) {
    return { kind: "set", id: Number(a), state: b as State, view: c };
  }
  if (prefix === "ao" && /^\d+$/.test(a ?? "")) return { kind: "open", id: Number(a) };
  if (prefix === "al" && /^[a-z0-9-]+$/.test(a ?? "")) return { kind: "list", talk: a };
  if (prefix === "as") return { kind: "sessions" };
  return null;
}

export function isApplicationCallback(data: string | undefined): boolean {
  return /^a[ols]?\|/.test(data ?? "");
}

function listButton(talk: string, text: string): Button[] {
  const data = `al|${talk}`;
  return data.length <= 64 ? [{ text, callback_data: data }] : [];
}

function experience(value: string): string {
  return value ? `${value} years` : "";
}

// view c: a new-application alert, l: opened from the session list (with a way back).
export function card(app: Application, view: "c" | "l" = "c"): Reply {
  const lines = [
    `${ICON[app.state]} Table talk application: ${app.talk}`,
    `Name: ${app.name || "-"}`,
    `Role: ${app.role || "-"}`,
    `Works at: ${app.workplace || "-"}`,
    `Experience: ${experience(app.experience) || "-"}`,
    `Email: ${app.email}`,
    `State: ${app.state.replace("_", "-")}`,
  ];
  const actions = ACTIONS.filter((a) => a.state !== app.state).map((a) => ({
    text: a.label,
    callback_data: `a|${app.id}|${a.state}|${view}`,
  }));
  return {
    text: lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        actions.slice(0, 2),
        actions.slice(2),
        listButton(app.talk, view === "l" ? "« Back to the list" : `📋 Everyone in ${app.talk}`),
      ].filter((row) => row.length),
    },
  };
}

export function list(talk: string, apps: Application[], seats?: number): Reply {
  const back = [{ text: "« All sessions", callback_data: "as|" }, ...listButton(talk, "🔄 Refresh")];
  if (!apps.length) return { text: `No applications for ${talk} yet.`, reply_markup: { inline_keyboard: [back] } };
  const sorted = [...apps].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.id - b.id);
  const count = (s: State) => apps.filter((a) => a.state === s).length;
  const confirmed = seats ? `${count("confirmed")} of ${seats} seats confirmed` : `${count("confirmed")} confirmed`;
  const totals = [`✅ ${confirmed}`, `📝 ${count("applied")} applied`, `⏳ ${count("waitlist")} waitlist`];
  if (count("declined")) totals.push(`❌ ${count("declined")} declined`);
  if (count("no_show")) totals.push(`🚫 ${count("no_show")} no-show`);

  const shown = sorted.slice(0, LIST_LIMIT);
  const lines = shown.map((a) => {
    const about = [a.name || "(no name)", a.role, a.workplace, experience(a.experience)].filter(Boolean).join(" · ");
    return `${ICON[a.state]} ${about}\n      ${a.email}`;
  });
  const more = sorted.length > shown.length ? `\n\nShowing ${shown.length} of ${sorted.length}.` : "";
  return {
    text: `📋 ${talk}\n${totals.join(" · ")}\n\n${lines.join("\n")}${more}\n\nTap a person to confirm, waitlist, decline or mark a no-show.`,
    reply_markup: {
      inline_keyboard: [
        ...shown.map((a) => [{ text: `${ICON[a.state]} ${a.name || a.email}`, callback_data: `ao|${a.id}` }]),
        back,
      ],
    },
  };
}

export function summary(rows: { talk: string; state: State; n: number }[]): Reply {
  if (!rows.length) return { text: "No table talk applications yet." };
  const talks = [...new Set(rows.map((r) => r.talk))];
  const lines = talks.map((talk) => {
    const parts = ORDER.flatMap((state) => {
      const n = rows.find((r) => r.talk === talk && r.state === state)?.n ?? 0;
      return n ? [`${ICON[state]} ${n} ${state.replace("_", "-")}`] : [];
    });
    return `${talk}: ${parts.join(" · ")}`;
  });
  return {
    text: `📋 Table talk applications\n\n${lines.join("\n")}\n\nTap a session to see who applied.`,
    reply_markup: { inline_keyboard: talks.map((talk) => listButton(talk, `📋 ${talk}`)).filter((row) => row.length) },
  };
}

async function sessionApps(db: Db, talk: string): Promise<Application[]> {
  const { results } = await db
    .prepare("SELECT id, talk, email, name, role, workplace, experience, state FROM applications WHERE talk = ?")
    .bind(talk)
    .all<Application>();
  return results;
}

// Seats per session from the site's list; undefined when the site cannot be reached.
async function seatsFor(siteOrigin: string, talk: string): Promise<number | undefined> {
  try {
    const response = await fetch(`${siteOrigin}/table-talks/index.json`);
    const talks = (await response.json()) as { slug: string; seats: number }[];
    return talks.find((t) => t.slug === talk)?.seats;
  } catch {
    return undefined;
  }
}

async function sessions(db: Db): Promise<Reply> {
  const { results } = await db
    .prepare("SELECT talk, state, COUNT(*) AS n FROM applications GROUP BY talk, state ORDER BY talk")
    .bind()
    .all<{ talk: string; state: State; n: number }>();
  return summary(results);
}

async function sessionList(db: Db, talk: string, siteOrigin: string): Promise<Reply> {
  return list(talk, await sessionApps(db, talk), await seatsFor(siteOrigin, talk));
}

// /apps and /apps <slug>.
export async function command(db: Db, text: string, siteOrigin: string): Promise<Reply> {
  const talk = text.trim().split(/\s+/)[1];
  return talk ? sessionList(db, talk, siteOrigin) : sessions(db);
}

// A button on a card or a list: redraws that message. Returns the short note shown to Amin.
export async function press(
  db: Db,
  tg: Telegram,
  chatId: string,
  messageId: number | undefined,
  data: string | undefined,
  siteOrigin: string,
): Promise<string> {
  const parsed = parseCallback(data);
  if (!parsed) return "Unknown button.";
  const redraw = async (reply: Reply) => {
    if (messageId) await tg("editMessageText", { chat_id: chatId, message_id: messageId, ...reply });
  };

  if (parsed.kind === "sessions") {
    await redraw(await sessions(db));
    return "";
  }
  if (parsed.kind === "list") {
    await redraw(await sessionList(db, parsed.talk, siteOrigin));
    return "";
  }
  if (parsed.kind === "open") {
    const app = await db
      .prepare("SELECT id, talk, email, name, role, workplace, experience, state FROM applications WHERE id = ?")
      .bind(parsed.id)
      .first<Application>();
    if (!app) return "That application no longer exists.";
    await redraw(card(app, "l"));
    return "";
  }

  const app = await db
    .prepare(
      "UPDATE applications SET state = ? WHERE id = ? RETURNING id, talk, email, name, role, workplace, experience, state",
    )
    .bind(parsed.state, parsed.id)
    .first<Application>();
  if (!app) return "That application no longer exists.";

  await redraw(parsed.view === "l" ? await sessionList(db, app.talk, siteOrigin) : card(app));
  return `${app.name || app.email}: ${app.state.replace("_", "-")}`;
}
