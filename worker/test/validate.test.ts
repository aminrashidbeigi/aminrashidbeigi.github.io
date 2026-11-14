import { describe, expect, it } from "vitest";
import { LIMITS, validate } from "../src/validate";

function form(overrides: Record<string, string | undefined> = {}) {
  const fields: Record<string, string | undefined> = {
    talk: "testing-culture",
    lang: "fa",
    name: "Sara",
    role: "Backend engineer",
    years: "6",
    country: "Germany",
    contact: "@sara",
    situation: "Our QA team owns all testing and it is slowing us down.",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.append(key, value);
  return data;
}

describe("validate", () => {
  it("accepts a complete application and trims fields", () => {
    const result = validate(form({ name: "  Sara  " }));
    expect(result).toEqual({
      ok: true,
      value: {
        talk: "testing-culture",
        lang: "fa",
        name: "Sara",
        role: "Backend engineer",
        years: 6,
        country: "Germany",
        contact: "@sara",
        situation: "Our QA team owns all testing and it is slowing us down.",
      },
    });
  });

  it.each(["name", "role", "years", "country", "contact", "situation"])("rejects a missing %s", (field) => {
    expect(validate(form({ [field]: undefined })).ok).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    expect(validate(form({ name: "   " })).ok).toBe(false);
  });

  it.each(Object.entries(LIMITS))("enforces the %s limit of %i characters", (field, limit) => {
    expect(validate(form({ [field]: "x".repeat(limit) })).ok).toBe(true);
    expect(validate(form({ [field]: "x".repeat(limit + 1) })).ok).toBe(false);
  });

  it("counts Persian text by characters, like the form's maxlength", () => {
    expect(validate(form({ name: "س".repeat(LIMITS.name) })).ok).toBe(true);
  });

  it.each(["0", "40"])("accepts %s years", (years) => {
    expect(validate(form({ years })).ok).toBe(true);
  });

  it.each(["-1", "41", "3.5", "abc", "", "1e1"])("rejects %j years", (years) => {
    expect(validate(form({ years })).ok).toBe(false);
  });

  it("rejects a talk slug that is not a slug", () => {
    expect(validate(form({ talk: "../admin" }))).toEqual({ ok: false, lang: "fa" });
    expect(validate(form({ talk: "Testing Culture" })).ok).toBe(false);
  });

  it("rejects an unknown language but keeps the talk for the redirect", () => {
    expect(validate(form({ lang: "de" }))).toEqual({ ok: false, talk: "testing-culture", lang: "en" });
  });

  it("keeps talk and lang on other failures", () => {
    expect(validate(form({ name: "" }))).toEqual({ ok: false, talk: "testing-culture", lang: "fa" });
  });
});
