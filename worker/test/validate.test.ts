import { describe, expect, it } from "vitest";
import { CHOICES, LIMITS, validate } from "../src/validate";

function form(overrides: Record<string, string | undefined> = {}) {
  const fields: Record<string, string | undefined> = {
    talk: "testing-culture",
    lang: "fa",
    email: "sara@example.com",
    name: "Sara",
    role: "engineer",
    experience: "3-5",
    region: "europe",
    note: "Our QA team owns all testing and it is slowing us down.",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.append(key, value);
  return data;
}

describe("validate", () => {
  it("accepts a complete application and trims text", () => {
    expect(validate(form({ name: "  Sara  ", email: " sara@example.com " }))).toEqual({
      ok: true,
      value: {
        talk: "testing-culture",
        lang: "fa",
        email: "sara@example.com",
        name: "Sara",
        role: "engineer",
        experience: "3-5",
        region: "europe",
        note: "Our QA team owns all testing and it is slowing us down.",
      },
    });
  });

  it("accepts an email on its own", () => {
    const data = new FormData();
    data.append("talk", "testing-culture");
    data.append("lang", "en");
    data.append("email", "sara@example.com");
    expect(validate(data)).toEqual({
      ok: true,
      value: { talk: "testing-culture", lang: "en", email: "sara@example.com", name: "", role: "", experience: "", region: "", note: "" },
    });
  });

  it("accepts optional fields left empty", () => {
    expect(validate(form({ name: "", role: "", experience: "", region: "", note: "   " })).ok).toBe(true);
  });

  it.each([undefined, "", "   ", "sara", "sara@", "@example.com", "sara@example", "sa ra@example.com"])(
    "rejects email %j",
    (email) => {
      expect(validate(form({ email })).ok).toBe(false);
    },
  );

  it.each(Object.entries(LIMITS))("enforces the %s limit of %i characters", (field, limit) => {
    const at = field === "email" ? "x".repeat(limit - "@example.com".length) + "@example.com" : "x".repeat(limit);
    expect(validate(form({ [field]: at })).ok).toBe(true);
    expect(validate(form({ [field]: "x" + at })).ok).toBe(false);
  });

  it("counts Persian text by characters, like the form's maxlength", () => {
    expect(validate(form({ name: "س".repeat(LIMITS.name) })).ok).toBe(true);
  });

  it.each(Object.entries(CHOICES).flatMap(([field, values]) => values.map((v) => [field, v])))(
    "accepts %s %j",
    (field, value) => {
      expect(validate(form({ [field]: value })).ok).toBe(true);
    },
  );

  it.each([
    ["role", "ceo"],
    ["experience", "40"],
    ["region", "germany"],
  ])("rejects %s %j that is not one of the choices", (field, value) => {
    expect(validate(form({ [field]: value })).ok).toBe(false);
  });

  it("rejects a talk slug that is not a slug", () => {
    expect(validate(form({ talk: "../admin" }))).toEqual({ ok: false, lang: "fa" });
    expect(validate(form({ talk: "Testing Culture" })).ok).toBe(false);
  });

  it("rejects an unknown language but keeps the talk for the redirect", () => {
    expect(validate(form({ lang: "de" }))).toEqual({ ok: false, talk: "testing-culture", lang: "en" });
  });

  it("keeps talk and lang on other failures", () => {
    expect(validate(form({ email: "" }))).toEqual({ ok: false, talk: "testing-culture", lang: "fa" });
  });
});
