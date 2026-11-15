// Table talk applications in the bot. /apps counts them per session, /apps <slug> lists one
// session with buttons, and the buttons on a list or on a new-application alert change the
// applicant's state. Applications live in the aminrb-table-talks database (written by worker/),
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
  { state: "waitlist", label: "⏳ Waitlist" },
  { state: "declined", label: "❌ Decline" },
];
// One list message holds at most this many applicants: Telegram allows 100 buttons and
// 4096 characters per message.
export const LIST_LIMIT = 30;

// Callback data: a|<id>|<state>|<view>, where view is c (a single card) or l (a session list).
export function parseCallback(data: string | undefined): { id: number; state: State; view: "c" | "l" } | null {
  const [prefix, id, state, view] = (data ?? "").split("|");
  if (prefix !== "a" || !/^\d+$/.test(id ?? "") || !(state in ICON) || (view !== "c" && view !== "l")) return null;
  return { id: Number(id), state: state as State, view };
}

export function isApplicationCallback(data: string | undefined): boolean {
  return (data ?? "").startsWith("a|");
}

function experience(value: string): string {
  return value ? `${value} years` : "";
}

export function card(app: Application): Reply {
  const lines = [
    `${ICON[app.state]} Table talk application: ${app.talk}`,
    `Name: ${app.name || "-"}`,
    `Role: ${app.role || "-"}`,
    `Works at: ${app.workplace || "-"}`,
    `Experience: ${experience(app.experience) || "-"}`,
    `Email: ${app.email}`,
    `State: ${app.state}`,
  ];
  return {
    text: lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        ACTIONS.filter((a) => a.state !== app.state).map((a) => ({
          text: a.label,
          callback_data: `a|${app.id}|${a.state}|c`,
        })),
      ],
    },
  };
}

export function list(talk: string, apps: Application[], seats?: number): Reply {
  if (!apps.length) return { text: `No applications for ${talk} yet.` };
  const sorted = [...apps].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.id - b.id);
  const count = (s: State) => apps.filter((a) => a.state === s).length;
  const confirmed = seats ? `${count("confirmed")} of ${seats} seats confirmed` : `${count("confirmed")} confirmed`;
  const totals = [`✅ ${confirmed}`, `📝 ${count("applied")} applied`, `⏳ ${count("waitlist")} waitlist`];
  if (count("declined")) totals.push(`❌ ${count("declined")} declined`);
  if (count("no_show")) totals.push(`🚫 ${count("no_show")} no-show`);

  const shown = sorted.slice(0, LIST_LIMIT);
  const lines = shown.map((a) => {
    const about = [a.name || "(no name)", a.role, a.workplace, experience(a.experience)].filter(Boolean).join(" · ");
    return `${ICON[a.state]} #${a.id} ${about}\n      ${a.email}`;
  });
  const more = sorted.length > shown.length ? `\n\nShowing ${shown.length} of ${sorted.length}.` : "";
  return {
    text: `📋 ${talk}\n${totals.join(" · ")}\n\n${lines.join("\n")}${more}\n\nTap to change someone's state.`,
    reply_markup: {
      inline_keyboard: shown.map((a) =>
        ACTIONS.map((action) => ({
          text: `${action.label.split(" ")[0]} #${a.id}`,
          callback_data: `a|${a.id}|${action.state}|l`,
        })),
      ),
    },
  };
}

export function summary(rows: { talk: string; state: State; n: number }[]): string {
  if (!rows.length) return "No table talk applications yet.";
  const talks = [...new Set(rows.map((r) => r.talk))];
  const lines = talks.map((talk) => {
    const parts = ORDER.flatMap((state) => {
      const n = rows.find((r) => r.talk === talk && r.state === state)?.n ?? 0;
      return n ? [`${ICON[state]} ${n} ${state.replace("_", "-")}`] : [];
    });
    return `${talk}: ${parts.join(" · ")}`;
  });
  return `📋 Table talk applications\n\n${lines.join("\n")}\n\nSend /apps <session> for the list, e.g. /apps ${talks[0]}`;
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

// /apps and /apps <slug>.
export async function command(db: Db, text: string, siteOrigin: string): Promise<Reply> {
  const talk = text.trim().split(/\s+/)[1];
  if (!talk) {
    const { results } = await db
      .prepare("SELECT talk, state, COUNT(*) AS n FROM applications GROUP BY talk, state ORDER BY talk")
      .bind()
      .all<{ talk: string; state: State; n: number }>();
    return { text: summary(results) };
  }
  return list(talk, await sessionApps(db, talk), await seatsFor(siteOrigin, talk));
}

// A button on a card or a list. Returns the short note shown to Amin.
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
  const app = await db
    .prepare(
      "UPDATE applications SET state = ? WHERE id = ? RETURNING id, talk, email, name, role, workplace, experience, state",
    )
    .bind(parsed.state, parsed.id)
    .first<Application>();
  if (!app) return "That application no longer exists.";

  const reply = parsed.view === "l" ? list(app.talk, await sessionApps(db, app.talk), await seatsFor(siteOrigin, app.talk)) : card(app);
  if (messageId) {
    await tg("editMessageText", { chat_id: chatId, message_id: messageId, ...reply });
  }
  return `${app.name || `#${app.id}`}: ${app.state}`;
}
