/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { card, command, LIST_LIMIT, list, parseCallback, press, summary, type Application } from "../src/applications";

// A D1-shaped wrapper around node:sqlite with the real schema from worker/schema.sql.
function db() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(fileURLToPath(new URL("../../worker/schema.sql", import.meta.url).href), "utf8"));
  return {
    sqlite,
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            all: async <T>() => ({ results: stmt.all(...(values as never[])) as T[] }),
            first: async <T>() => (stmt.get(...(values as never[])) as T | undefined) ?? null,
          };
        },
      };
    },
  };
}

function add(d: ReturnType<typeof db>, email: string, fields: Partial<Application> = {}) {
  d.sqlite
    .prepare("INSERT INTO applications (talk, lang, email, name, role, workplace, experience, state) VALUES (?, 'fa', ?, ?, ?, ?, ?, ?)")
    .run(fields.talk ?? "testing-culture", email, fields.name ?? "", fields.role ?? "", fields.workplace ?? "", fields.experience ?? "", fields.state ?? "applied");
}

const sara: Application = {
  id: 3, talk: "testing-culture", email: "sara@example.com", name: "Sara", role: "Backend engineer",
  workplace: "Startup / Germany", experience: "3-5", state: "applied",
};

describe("parseCallback", () => {
  it("reads id, state and view", () => {
    expect(parseCallback("a|12|confirmed|l")).toEqual({ id: 12, state: "confirmed", view: "l" });
  });
  it.each([undefined, "", "p|key|topic", "a|x|confirmed|l", "a|1|admin|l", "a|1|confirmed|z"])("rejects %j", (data) => {
    expect(parseCallback(data)).toBeNull();
  });
});

describe("card", () => {
  it("shows every field, and buttons for the other states", () => {
    const reply = card(sara);
    expect(reply.text).toContain("Email: sara@example.com");
    expect(reply.text).toContain("Experience: 3-5 years");
    expect(reply.text).toContain("State: applied");
    expect(reply.reply_markup!.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      "a|3|confirmed|c", "a|3|waitlist|c", "a|3|declined|c",
    ]);
  });
  it("leaves out the button for the current state and fills empty fields", () => {
    const reply = card({ ...sara, state: "confirmed", name: "", experience: "" });
    expect(reply.text).toContain("Name: -");
    expect(reply.reply_markup!.inline_keyboard[0].map((b) => b.callback_data)).toEqual(["a|3|waitlist|c", "a|3|declined|c"]);
  });
});

describe("list", () => {
  it("puts confirmed people first and counts seats", () => {
    const reply = list("testing-culture", [sara, { ...sara, id: 4, name: "Omid", state: "confirmed" }], 8);
    expect(reply.text).toContain("✅ 1 of 8 seats confirmed · 📝 1 applied · ⏳ 0 waitlist");
    expect(reply.text.indexOf("#4 Omid")).toBeLessThan(reply.text.indexOf("#3 Sara"));
    expect(reply.reply_markup!.inline_keyboard).toHaveLength(2);
  });
  it("stays within Telegram's limits", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...sara, id: i + 1, email: `p${i}@example.com` }));
    const reply = list("testing-culture", many, 8);
    expect(reply.reply_markup!.inline_keyboard).toHaveLength(LIST_LIMIT);
    expect(reply.reply_markup!.inline_keyboard.flat().length).toBeLessThanOrEqual(100);
    expect(reply.text.length).toBeLessThanOrEqual(4096);
    expect(reply.text).toContain(`Showing ${LIST_LIMIT} of 45.`);
  });
  it("says so when there are no applications", () => {
    expect(list("testing-culture", [])).toEqual({ text: "No applications for testing-culture yet." });
  });
});

describe("summary", () => {
  it("counts per session", () => {
    expect(summary([
      { talk: "testing-culture", state: "applied", n: 3 },
      { talk: "testing-culture", state: "confirmed", n: 2 },
    ])).toContain("testing-culture: ✅ 2 confirmed · 📝 3 applied");
  });
  it("handles no applications", () => {
    expect(summary([])).toBe("No table talk applications yet.");
  });
});

describe("with the database", () => {
  let d: ReturnType<typeof db>;
  beforeEach(() => {
    d = db();
    add(d, "sara@example.com", { name: "Sara" });
    add(d, "omid@example.com", { name: "Omid" });
    add(d, "x@example.com", { talk: "other-talk" });
  });

  it("/apps counts every session", async () => {
    const reply = await command(d, "/apps", "http://unreachable.invalid");
    expect(reply.text).toContain("testing-culture: 📝 2 applied");
    expect(reply.text).toContain("other-talk: 📝 1 applied");
  });

  it("/apps <slug> lists one session, even when the site cannot be reached", async () => {
    const reply = await command(d, "/apps testing-culture", "http://unreachable.invalid");
    expect(reply.text).toContain("✅ 0 confirmed · 📝 2 applied");
    expect(reply.text).toContain("sara@example.com");
    expect(reply.text).not.toContain("x@example.com");
  });

  it("a list button updates the state and redraws the list in place", async () => {
    const calls: { method: string; body: any }[] = [];
    const tg = async (method: string, body: unknown) => (calls.push({ method, body: body as any }), undefined as never);
    const note = await press(d, tg, "42", 7, "a|1|confirmed|l", "http://unreachable.invalid");
    expect(note).toBe("Sara: confirmed");
    expect(d.sqlite.prepare("SELECT state FROM applications WHERE id = 1").get()).toEqual({ state: "confirmed" });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("editMessageText");
    expect(calls[0].body.message_id).toBe(7);
    expect(calls[0].body.text).toContain("✅ 1 confirmed");
  });

  it("a card button redraws only that card", async () => {
    const calls: { method: string; body: any }[] = [];
    const tg = async (method: string, body: unknown) => (calls.push({ method, body: body as any }), undefined as never);
    await press(d, tg, "42", 9, "a|2|waitlist|c", "http://unreachable.invalid");
    expect(calls[0].body.text).toContain("State: waitlist");
    expect(calls[0].body.text).toContain("omid@example.com");
  });

  it("ignores unknown buttons and missing applications", async () => {
    const tg = async () => undefined as never;
    expect(await press(d, tg, "42", 1, "a|1|admin|l", "")).toBe("Unknown button.");
    expect(await press(d, tg, "42", 1, "a|999|confirmed|c", "")).toBe("That application no longer exists.");
  });
});
