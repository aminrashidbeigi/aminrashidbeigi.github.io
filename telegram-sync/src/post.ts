// Turns one Telegram channel post (a message, or the parts of an album) into a
// Hugo page bundle: content/posts/telegram-<id>/index.fa.md plus its photos.
//
// Telegram sends plain text plus formatting "entities" whose offsets count UTF-16
// code units, which is exactly how JavaScript indexes strings, so slices line up.

export interface Entity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  language?: string;
}

// What we keep of each channel message (stored as JSON in D1).
export interface Part {
  id: number;
  text?: string;
  entities?: Entity[];
  photo?: string; // file_id of the largest size
  media?: string; // video, document, audio, voice, ...: not copied, linked instead
}

export interface Topic {
  slug: string;
  label: string;
}

// Same order as the topic filters on the posts page (layouts/shortcodes/topic-filters.html).
export const TOPICS: Topic[] = [
  { slug: "leadership", label: "Leadership" },
  { slug: "engineering", label: "Engineering" },
  { slug: "career", label: "Career" },
  { slug: "year-in-review", label: "Year in review" },
];

export const CATEGORY = "کانال تلگرام";

const TITLE_WORDS = 8;
const TITLE_CHARS = 60;

export interface BuiltPost {
  title: string;
  titled: boolean; // the title is the post's own bold first line
  slug: string;
  dir: string;
  markdown: string;
  images: { name: string; fileId: string }[];
}

export interface BuildOptions {
  channel: string; // channel username, without @
  date: number; // unix seconds of the original post
  topic?: string;
  slug?: string; // keep the slug of an already published post
}

export function buildPost(parts: Part[], opts: BuildOptions): BuiltPost {
  const sorted = [...parts].sort((a, b) => a.id - b.id);
  const id = sorted[0].id;
  const link = `https://t.me/${opts.channel}/${id}`;

  let title = "";
  let titled = false;
  const tags = new Set<string>();
  const bodies: string[] = [];
  for (const part of sorted) {
    if (!part.text) continue;
    const entities = part.entities ?? [];
    for (const e of entities) {
      if (e.type === "hashtag") tags.add(part.text.slice(e.offset + 1, e.offset + e.length).replace(/_/g, " "));
    }
    let from = 0;
    if (!title) {
      const bold = boldFirstLine(part.text, entities);
      if (bold) {
        title = bold.title;
        titled = true;
        from = bold.end;
      } else {
        title = leadingWords(part.text);
      }
    }
    const body = toMarkdown(part.text, entities, from, footerStart(part.text, opts.channel));
    if (body) bodies.push(body);
  }
  if (!title) title = `یادداشت ${faDigits(String(id))} کانال تلگرام`;

  // The .fa suffix ties each photo to the Persian page; Hugo leaves unsuffixed bundle
  // files to the default language. Two digits keep the cover's name from matching others.
  const images = sorted
    .filter((p) => p.photo)
    .map((p, i) => ({ name: `photo-${String(i + 1).padStart(2, "0")}.fa.jpg`, fileId: p.photo as string }));
  for (const img of images.slice(1)) bodies.push(`![](${img.name})`);
  if (sorted.some((p) => p.media)) {
    bodies.push(`این پست ویدیو یا فایلی داره که فقط در تلگرام هست: [دیدن در تلگرام](${link})`);
  }

  // A real title makes the slug. Otherwise the post number, like t.me/<channel>/<id>,
  // until a better slug is picked by hand.
  const slug = opts.slug ?? (titled ? slugify(title) : `telegram-${id}`);
  const front: string[] = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${new Date(opts.date * 1000).toISOString().replace(".000Z", "Z")}`,
    `slug: ${JSON.stringify(slug)}`,
  ];
  if (tags.size) front.push("tags:", ...[...tags].map((t) => `- ${JSON.stringify(t)}`));
  front.push("categories:", `- ${JSON.stringify(CATEGORY)}`);
  if (opts.topic) front.push("topics:", `- ${opts.topic}`);
  if (images.length) front.push("cover:", `    image: ${images[0].name}`, `    alt: ${JSON.stringify(title)}`);
  front.push(`telegram: ${JSON.stringify(link)}`, "---", "");

  return {
    title,
    titled,
    slug,
    dir: `content/posts/telegram-${id}`,
    markdown: front.join("\n") + "\n" + bodies.join("\n\n") + "\n",
    images,
  };
}

// A first line whose letters and digits are all bold is the post's title (an emoji
// or "📌" in front may stay plain). Returns the title and where the body starts.
export function boldFirstLine(text: string, entities: Entity[]): { title: string; end: number } | null {
  const lineEnd = text.indexOf("\n") === -1 ? text.length : text.indexOf("\n");
  const line = text.slice(0, lineEnd);
  if (!line.trim()) return null;
  const bold = new Array<boolean>(lineEnd).fill(false);
  for (const e of entities) {
    if (e.type !== "bold") continue;
    for (let i = e.offset; i < Math.min(e.offset + e.length, lineEnd); i++) bold[i] = true;
  }
  let words = false;
  for (let i = 0; i < lineEnd; i++) {
    if (!/[\p{L}\p{N}]/u.test(line[i])) continue;
    if (!bold[i]) return null;
    words = true;
  }
  if (!words) return null;
  const title = line.replace(/^[\s\p{S}\ufe0f\u200d]+|[\s\p{S}:\ufe0f\u200d]+$/gu, "");
  return { title, end: Math.min(lineEnd + 1, text.length) };
}

// The first words of the first paragraph, ending with "…" when cut.
export function leadingWords(text: string): string {
  const first = text.trim().split(/\n/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean);
  let out = "";
  for (const word of words.slice(0, TITLE_WORDS)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > TITLE_CHARS && out) break;
    out = next;
  }
  if (out.length < first.length) out = out.replace(/[\s.,،؛;:!?؟]+$/, "") + "…";
  return out;
}

// Where the footer starts: trailing lines that are only "@channel" or only hashtags.
export function footerStart(text: string, channel: string): number {
  let end = text.length;
  while (end > 0) {
    const lineStart = text.lastIndexOf("\n", end - 1) + 1;
    const line = text.slice(lineStart, end).trim();
    if (line === "" || line.toLowerCase() === `@${channel.toLowerCase()}` || /^(#[\p{L}\p{N}_]+\s*)+$/u.test(line)) {
      end = lineStart === 0 ? 0 : lineStart - 1;
      if (lineStart === 0) break;
    } else {
      break;
    }
  }
  return end;
}

export function slugify(title: string): string {
  const words = title
    .replace(/\u200c/g, " ")
    .replace(/[\ufe00-\ufe0f\u200d\u20e3]/g, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return words.join("-") || "telegram";
}

export function faDigits(s: string): string {
  return s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

// ---------------------------------------------------------------------------
// Entities to Markdown

interface Node {
  entity?: Entity;
  start: number;
  end: number;
  children: Node[];
}

export function toMarkdown(text: string, entities: Entity[], from = 0, to = text.length): string {
  const root: Node = { start: from, end: to, children: [] };
  const sorted = entities
    .map((e) => ({ e, start: Math.max(e.offset, from), end: Math.min(e.offset + e.length, to) }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const stack: Node[] = [root];
  for (const { e, start, end } of sorted) {
    while (stack.length > 1 && start >= stack[stack.length - 1].end) stack.pop();
    const parent = stack[stack.length - 1];
    const node: Node = { entity: e, start, end: Math.min(end, parent.end), children: [] };
    parent.children.push(node);
    stack.push(node);
  }
  return blocks(render(text, root));
}

function render(text: string, node: Node): string {
  const raw = text.slice(node.start, node.end);
  const type = node.entity?.type;
  if (type === "code") return inlineCode(raw);
  if (type === "pre") return `\n\n\`\`\`${node.entity?.language ?? ""}\n${raw.replace(/\n$/, "")}\n\`\`\`\n\n`;

  let inner = "";
  let at = node.start;
  for (const child of node.children) {
    inner += escape(text.slice(at, child.start)) + render(text, child);
    at = child.end;
  }
  inner += escape(text.slice(at, node.end));

  switch (type) {
    case undefined:
      return inner;
    case "bold":
      return wrap(inner, "**", "<strong>", "</strong>");
    case "italic":
      return wrap(inner, "*", "<em>", "</em>");
    case "underline":
      return wrap(inner, null, "<u>", "</u>");
    case "strikethrough":
      return wrap(inner, null, "<del>", "</del>");
    case "text_link":
      return link(inner, node.entity?.url ?? "");
    case "url":
      return link(inner, /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    case "mention":
      return link(inner, `https://t.me/${raw.slice(1)}`);
    case "blockquote":
    case "expandable_blockquote":
      return "\n\n" + inner.split("\n").map((l) => `> ${l}`.trimEnd()).join("\n") + "\n\n";
    default:
      // spoiler, hashtag, email, custom_emoji, ...: keep the text
      return inner;
  }
}

// Wraps every line of `inner` in a style, keeping surrounding spaces outside the
// markers. Markdown delimiters only work next to letters, so text that starts or
// ends with punctuation, an emoji or a link gets HTML tags instead.
function wrap(inner: string, md: string | null, open: string, close: string): string {
  return inner
    .split("\n")
    .map((line) => {
      const m = /^(\s*)(.*?)(\s*)$/su.exec(line) as RegExpExecArray;
      const [, lead, core, trail] = m;
      if (!core) return line;
      const edge = /^[\p{P}\p{S}]|[\p{P}\p{S}]$/u.test(core);
      return md && !edge ? `${lead}${md}${core}${md}${trail}` : `${lead}${open}${core}${close}${trail}`;
    })
    .join("\n");
}

function link(label: string, url: string): string {
  if (!label.trim()) return label;
  const href = url.replace(/[ ()<>]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `[${label}](${href})`;
}

function inlineCode(raw: string): string {
  const fence = raw.includes("`") ? "``" : "`";
  const pad = fence.length > 1 ? " " : "";
  return `${fence}${pad}${raw}${pad}${fence}`;
}

function escape(s: string): string {
  return s.replace(/[\\`*_[\]<>~]/g, "\\$&");
}

// Line-level pass: Telegram line breaks become Markdown hard breaks, runs of
// blank lines collapse, and lines that Markdown would read as headings or rules
// are escaped. Fenced code is left alone.
function blocks(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let fenced = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      out.push(line);
      continue;
    }
    if (fenced) {
      out.push(line);
      continue;
    }
    let l = line.trim();
    if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    if (/^#/.test(l) || /^[-=_*]+$/.test(l.replace(/\s/g, ""))) l = "\\" + l;
    out.push(l);
  }
  while (out.length && out[out.length - 1] === "") out.pop();

  // Hard breaks between consecutive text lines (not around fences or blank lines).
  fenced = false;
  return out
    .map((l, i) => {
      if (l.startsWith("```")) fenced = !fenced;
      if (fenced || l.startsWith("```") || l === "") return l;
      const next = out[i + 1];
      return next !== undefined && next !== "" && !next.startsWith("```") ? `${l}  ` : l;
    })
    .join("\n");
}
