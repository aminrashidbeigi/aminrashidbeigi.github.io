/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  card, command, isApplicationCallback, LIST_LIMIT, list, parseCallback, press, summary, type Application,
} from "../src/applications";

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
  it.each([
    ["a|12|confirmed|l", { kind: "set", id: 12, state: "confirmed", view: "l" }],
    ["a|12|no_show|c", { kind: "set", id: 12, state: "no_show", view: "c" }],
    ["ao|12", { kind: "open", id: 12 }],
    ["al|testing-culture", { kind: "list", talk: "testing-culture" }],
    ["as|", { kind: "sessions" }],
  ])("reads %j", (data, expected) => {
    expect(parseCallback(data)).toEqual(expected);
  });
  it.each([undefined, "", "p|key|topic", "a|x|confirmed|l", "a|1|admin|l", "a|1|confirmed|z", "ao|x", "al|Bad Slug"])(
    "rejects %j",
    (data) => {
      expect(parseCallback(data)).toBeNull();
    },
  );
  it("tells application buttons from post buttons", () => {
    expect(["a|1|confirmed|c", "ao|1", "al|x", "as|"].every(isApplicationCallback)).toBe(true);
    expect(["p|m:1|career", "s|m:1", "u|m:1", "k|m:1"].some(isApplicationCallback)).toBe(false);
  });
});

const buttons = (reply: { reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] } }) =>
  reply.reply_markup!.inline_keyboard.flat();

describe("card", () => {
  it("shows every field, and buttons for the other states", () => {
    const reply = card(sara);
    expect(reply.text).toContain("Email: sara@example.com");
    expect(reply.text).toContain("Experience: 3-5 years");
    expect(reply.text).toContain("State: applied");
    expect(buttons(reply).map((b) => b.callback_data)).toEqual([
      "a|3|confirmed|c", "a|3|waitlist|c", "a|3|declined|c", "a|3|no_show|c", "al|testing-culture",
    ]);
  });
  it("leaves out the button for the current state and fills empty fields", () => {
    const reply = card({ ...sara, state: "confirmed", name: "", experience: "" });
    expect(reply.text).toContain("Name: -");
    expect(buttons(reply).map((b) => b.text)).toEqual([
      "Move to waitlist", "Decline", "No-show", "Everyone in testing-culture",
    ]);
  });
  it("opened from a list, its buttons lead back to the list", () => {
    const reply = card(sara, "l");
    expect(buttons(reply).map((b) => b.callback_data)).toContain("a|3|confirmed|l");
    expect(buttons(reply).at(-1)).toEqual({ text: "« Back to the list", callback_data: "al|testing-culture" });
  });
});

describe("list", () => {
  it("puts confirmed people first, counts seats, and has one button per person", () => {
    const reply = list("testing-culture", [sara, { ...sara, id: 4, name: "Omid", state: "confirmed" }], 7);
    expect(reply.text).toContain("✅ 1 of 7 seats confirmed · 📝 1 applied · ⏳ 0 waitlist");
    expect(reply.text.indexOf("Omid")).toBeLessThan(reply.text.indexOf("Sara"));
    expect(buttons(reply).map((b) => [b.text, b.callback_data])).toEqual([
      ["Omid", "ao|4"], ["Sara", "ao|3"], ["« All sessions", "as|"], ["Refresh", "al|testing-culture"],
    ]);
  });
  it("names people without a name by their email", () => {
    expect(buttons(list("testing-culture", [{ ...sara, name: "" }]))[0].text).toBe("sara@example.com");
  });
  it("stays within Telegram's limits", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...sara, id: i + 1, email: `p${i}@example.com` }));
    const reply = list("testing-culture", many, 7);
    expect(reply.reply_markup!.inline_keyboard).toHaveLength(LIST_LIMIT + 1);
    expect(buttons(reply).length).toBeLessThanOrEqual(100);
    expect(reply.text.length).toBeLessThanOrEqual(4096);
    expect(reply.text).toContain(`Showing ${LIST_LIMIT} of 45.`);
  });
  it("says so when there are no applications, with a way back", () => {
    const reply = list("testing-culture", []);
    expect(reply.text).toBe("No applications for testing-culture yet.");
    expect(buttons(reply)[0].callback_data).toBe("as|");
  });
});

describe("summary", () => {
  it("counts per session, with a button per session", () => {
    const reply = summary([
      { talk: "testing-culture", state: "applied", n: 3 },
      { talk: "testing-culture", state: "confirmed", n: 2 },
    ]);
    expect(reply.text).toContain("testing-culture: ✅ 2 confirmed · 📝 3 applied");
    expect(buttons(reply)).toEqual([{ text: "testing-culture", callback_data: "al|testing-culture" }]);
  });
  it("handles no applications", () => {
    expect(summary([])).toEqual({ text: "No table talk applications yet." });
  });
});

describe("with the database", () => {
  let d: ReturnType<typeof db>;
  let calls: { method: string; body: any }[];
  const tg = async (method: string, body: unknown) => (calls.push({ method, body: body as any }), undefined as never);
  beforeEach(() => {
    calls = [];
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

  it("taps through sessions, a list and a card in the same message", async () => {
    await press(d, tg, "42", 7, "as|", "http://unreachable.invalid");
    await press(d, tg, "42", 7, "al|testing-culture", "http://unreachable.invalid");
    await press(d, tg, "42", 7, "ao|1", "http://unreachable.invalid");
    expect(calls.map((c) => [c.method, c.body.message_id])).toEqual([
      ["editMessageText", 7], ["editMessageText", 7], ["editMessageText", 7],
    ]);
    expect(calls[0].body.text).toContain("Table talk applications");
    expect(calls[1].body.text).toContain("📋 testing-culture");
    expect(calls[2].body.text).toContain("Email: sara@example.com");
  });

  it("a state button on a card opened from the list updates it and goes back to the list", async () => {
    const note = await press(d, tg, "42", 7, "a|1|confirmed|l", "http://unreachable.invalid");
    expect(note).toBe("Sara: confirmed");
    expect(d.sqlite.prepare("SELECT state FROM applications WHERE id = 1").get()).toEqual({ state: "confirmed" });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.text).toContain("✅ 1 confirmed");
  });

  it("a button on an alert redraws only that card", async () => {
    const note = await press(d, tg, "42", 9, "a|2|no_show|c", "http://unreachable.invalid");
    expect(note).toBe("Omid: no-show");
    expect(calls[0].body.text).toContain("State: no-show");
    expect(calls[0].body.text).toContain("omid@example.com");
  });

  it("ignores unknown buttons and missing applications", async () => {
    expect(await press(d, tg, "42", 1, "a|1|admin|l", "")).toBe("Unknown button.");
    expect(await press(d, tg, "42", 1, "a|999|confirmed|c", "")).toBe("That application no longer exists.");
    expect(await press(d, tg, "42", 1, "ao|999", "")).toBe("That application no longer exists.");
  });
});
