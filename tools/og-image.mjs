// Renders a 1200x630 link-preview image with headless Chrome.
// Usage: node tools/og-image.mjs <out.png> <lang en|fa> <eyebrow> <title>
// Example: node tools/og-image.mjs static/og/my-talk.png fa "میزگرد" "عنوان سؤال"
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [out, lang, eyebrow, title] = process.argv.slice(2);
if (!out || !lang || !eyebrow || !title) {
  console.error("usage: node tools/og-image.mjs <out.png> <en|fa> <eyebrow> <title>");
  process.exit(1);
}
const chrome = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rtl = lang === "fa";
const size = title.length > 70 ? 54 : 64;

const html = `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1200px; height: 630px; }
  body { box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;
         padding: 72px 80px; background: rgb(29, 30, 32); color: rgb(218, 218, 219);
         font-family: -apple-system, "SF Arabic", "Geeza Pro", "Segoe UI", sans-serif; }
  .eyebrow { display: inline-block; align-self: flex-start; padding: 6px 18px; border: 2px solid rgb(65, 66, 68);
             border-radius: 999px; color: rgb(155, 156, 157); font-size: 28px; }
  h1 { margin: 0; font-size: ${size}px; line-height: ${rtl ? 1.45 : 1.2}; font-weight: 700; }
  .site { color: rgb(155, 156, 157); font-size: 28px; }
</style><body><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>
<span class="site">aminrb.me · ${rtl ? "امین رشیدبیگی" : "Amin Rashidbeigi"}</span></body></html>`;

const dir = mkdtempSync(join(tmpdir(), "og-"));
const page = join(dir, "card.html");
writeFileSync(page, html);
execFileSync(chrome, ["--headless=new", "--hide-scrollbars", "--window-size=1200,630",
  `--screenshot=${resolve(out)}`, `file://${page}`], { stdio: "ignore" });
console.log(`wrote ${out}`);
