// Validation for table talk applications. Fields and limits match the form in
// layouts/partials/apply-form.html: email is required, everything else is optional.

export const LIMITS = {
  email: 120,
  name: 80,
  role: 80,
  workplace: 100,
} as const;

export const CHOICES = {
  experience: ["0-2", "3-5", "6-10", "10+"],
} as const;

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Lang = "en" | "fa";

export interface Application {
  talk: string;
  lang: Lang;
  email: string;
  // Optional fields are "" when left empty.
  name: string;
  role: string;
  workplace: string;
  experience: string;
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

// "" for a missing or blank field, null when the field is too long.
function text(form: FormLike, field: keyof typeof LIMITS): string | null {
  const raw = form.get(field);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length > LIMITS[field] ? null : value;
}

// "" for a missing field, null for a value that is not one of the choices.
function choice(form: FormLike, field: keyof typeof CHOICES): string | null {
  const raw = form.get(field);
  const value = typeof raw === "string" ? raw : "";
  return value === "" || (CHOICES[field] as readonly string[]).includes(value) ? value : null;
}

export function validate(form: FormLike): Validation {
  const talk = form.get("talk");
  const rawLang = form.get("lang");
  const lang = parseLang(rawLang);
  const email = text(form, "email");
  const fields = {
    name: text(form, "name"),
    role: text(form, "role"),
    workplace: text(form, "workplace"),
    experience: choice(form, "experience"),
  };

  if (!isSlug(talk)) return { ok: false, lang };
  if (rawLang !== "en" && rawLang !== "fa") return { ok: false, talk, lang };
  if (!email || !EMAIL.test(email)) return { ok: false, talk, lang };
  if (Object.values(fields).some((v) => v === null)) return { ok: false, talk, lang };

  return {
    ok: true,
    value: {
      talk,
      lang,
      email,
      name: fields.name!,
      role: fields.role!,
      workplace: fields.workplace!,
      experience: fields.experience!,
    },
  };
}
