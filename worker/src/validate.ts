// Validation for table talk applications. Limits match the form in
// layouts/partials/apply-form.html.

export const LIMITS = {
  name: 80,
  role: 80,
  country: 60,
  contact: 120,
  situation: 1200,
} as const;

export const MAX_YEARS = 40;

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

export type Lang = "en" | "fa";

export interface Application {
  talk: string;
  lang: Lang;
  name: string;
  role: string;
  years: number;
  country: string;
  contact: string;
  situation: string;
}

export type Validation =
  | { ok: true; value: Application }
  // talk and lang are kept when they are valid, so the caller can redirect back to the right page.
  | { ok: false; talk?: string; lang: Lang };

interface FormLike {
  get(name: string): unknown;
}

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG.test(value);
}

export function parseLang(value: unknown): Lang {
  return value === "fa" ? "fa" : "en";
}

function text(form: FormLike, field: keyof typeof LIMITS): string | null {
  const raw = form.get(field);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > LIMITS[field]) return null;
  return value;
}

function years(form: FormLike): number | null {
  const raw = form.get("years");
  if (typeof raw !== "string" || !/^\d{1,2}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value <= MAX_YEARS ? value : null;
}

export function validate(form: FormLike): Validation {
  const talk = form.get("talk");
  const rawLang = form.get("lang");
  const lang = parseLang(rawLang);
  const fields = {
    name: text(form, "name"),
    role: text(form, "role"),
    years: years(form),
    country: text(form, "country"),
    contact: text(form, "contact"),
    situation: text(form, "situation"),
  };

  if (!isSlug(talk)) return { ok: false, lang };
  if (rawLang !== "en" && rawLang !== "fa") return { ok: false, talk, lang };
  if (Object.values(fields).some((v) => v === null)) return { ok: false, talk, lang };

  return {
    ok: true,
    value: {
      talk,
      lang,
      name: fields.name!,
      role: fields.role!,
      years: fields.years!,
      country: fields.country!,
      contact: fields.contact!,
      situation: fields.situation!,
    },
  };
}
