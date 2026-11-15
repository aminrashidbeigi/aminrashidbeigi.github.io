import { describe, expect, it } from "vitest";
import { boldFirstLine, buildPost, footerStart, leadingWords, slugify, toMarkdown, type Entity } from "../src/post";

// Builds Telegram-style text + entities from "**bold**" markers, the way the
// Telegram client turns them into a message.
function tgText(src: string): { text: string; entities: Entity[] } {
  const entities: Entity[] = [];
  let text = "";
  const pieces = src.split("**");
  pieces.forEach((piece, i) => {
    if (i % 2 === 1) entities.push({ type: "bold", offset: text.length, length: piece.length });
    text += piece;
  });
  return { text, entities };
}

const opts = { channel: "aminrbg", date: 1709287200 };

describe("title", () => {
  it("takes a bold first line", () => {
    const { text, entities } = tgText("**وقتی تسک طول می‌کشه چه کنیم؟**\n\nمتن اول.");
    expect(boldFirstLine(text, entities)).toEqual({ title: "وقتی تسک طول می‌کشه چه کنیم؟", end: 29 });
  });

  it("allows a plain emoji in front of a bold first line, and drops it from the title", () => {
    const { text, entities } = tgText("🎙 **تک‌تاک: آیندهٔ بازار کار**\nمتن");
    expect(boldFirstLine(text, entities)?.title).toBe("تک‌تاک: آیندهٔ بازار کار");
  });

  it("ignores a first line that is only partly bold", () => {
    const { text, entities } = tgText("یک **نکته** کوچک\nادامه");
    expect(boldFirstLine(text, entities)).toBeNull();
  });

  it("falls back to the first words with an ellipsis", () => {
    expect(leadingWords("از صفحاتی جالبی که امروز به چشمم خورد این صفحه بود که خیلی خوب بود.\nبعدی")).toBe(
      "از صفحاتی جالبی که امروز به چشمم خورد…",
    );
    expect(leadingWords("یک جملهٔ کوتاه")).toBe("یک جملهٔ کوتاه");
  });
});

describe("footer", () => {
  it("drops hashtags and the channel handle", () => {
    const text = "متن پست\n\n#estimation #communication\n@aminrbg\n";
    expect(text.slice(0, footerStart(text, "aminrbg"))).toBe("متن پست");
  });

  it("keeps a credit to another channel", () => {
    const text = "متن پست\n@someone_else";
    expect(footerStart(text, "aminrbg")).toBe(text.length);
  });
});

describe("toMarkdown", () => {
  it("turns line breaks into hard breaks and keeps paragraphs", () => {
    expect(toMarkdown("خط اول\nخط دوم\n\n\n\nپاراگراف بعدی", [])).toBe("خط اول  \nخط دوم\n\nپاراگراف بعدی");
  });

  it("keeps spaces outside bold markers and splits bold across lines", () => {
    const { text, entities } = tgText("**- عنوان اول:** توضیح.**\n- عنوان دوم: **ادامه");
    expect(toMarkdown(text, entities)).toBe("<strong>- عنوان اول:</strong> توضیح.  \n<strong>- عنوان دوم:</strong> ادامه");
  });

  it("uses ** when the bold text starts and ends with letters", () => {
    const { text, entities } = tgText("محصول رو «**دیپلوی**» کردیم");
    expect(toMarkdown(text, entities)).toBe("محصول رو «**دیپلوی**» کردیم");
  });

  it("renders links, nested bold and mentions", () => {
    const text = "🔗 لینک نوشته از @lethain";
    const entities: Entity[] = [
      { type: "text_link", offset: 0, length: 13, url: "https://lethain.com/a_(b)/" },
      { type: "bold", offset: 3, length: 10 },
      { type: "mention", offset: 17, length: 8 },
    ];
    expect(toMarkdown(text, entities)).toBe(
      "[🔗 **لینک نوشته**](https://lethain.com/a_%28b%29/) از [@lethain](https://t.me/lethain)",
    );
  });

  it("counts offsets in UTF-16 units, so emoji before an entity do not shift it", () => {
    const text = "🤯🤯 آمار Shopify";
    const entities: Entity[] = [{ type: "bold", offset: 10, length: 7 }];
    expect(toMarkdown(text, entities)).toBe("🤯🤯 آمار **Shopify**");
  });

  it("escapes Markdown in plain text, but not in code", () => {
    const text = "# not a heading *x* a_b\n---\nuse `fmt` then go_test";
    const entities: Entity[] = [{ type: "code", offset: text.indexOf("go_test"), length: 7 }];
    expect(toMarkdown(text, entities)).toBe("\\# not a heading \\*x\\* a\\_b  \n\\---  \nuse \\`fmt\\` then `go_test`");
  });

  it("renders pre blocks and blockquotes as their own blocks", () => {
    const text = "قبل\nfunc main() {}\nبعد\nنقل قول\nخط دوم\nآخر";
    const entities: Entity[] = [
      { type: "pre", offset: 4, length: 15, language: "go" },
      { type: "blockquote", offset: 23, length: 14 },
    ];
    expect(toMarkdown(text, entities)).toBe(
      "قبل\n\n```go\nfunc main() {}\n```\n\nبعد\n\n> نقل قول  \n> خط دوم\n\nآخر",
    );
  });

  it("keeps dash lists as lists", () => {
    expect(toMarkdown("موارد:\n- اول\n- دوم", [])).toBe("موارد:  \n- اول  \n- دوم");
  });
});

describe("slugify", () => {
  it("matches the site's Persian slugs", () => {
    expect(slugify("مدیریت بدهی‌های فنی")).toBe("مدیریت-بدهی-های-فنی");
    expect(slugify("Go v1.22 \u{1F680}\ufe0f\ufe0f")).toBe("go-v1-22");
    expect(slugify("Upgrading GitHub.com to MySQL 8.0")).toBe("upgrading-github-com-to-mysql-8-0");
    expect(slugify("وقتی یک تسکی قراره بیشتر از تخمین اولیه طول بکشه چه کنیم؟")).toBe(
      "وقتی-یک-تسکی-قراره-بیشتر-از-تخمین-اولیه-طول-بکشه-چه-کنیم",
    );
  });
});

describe("buildPost", () => {
  it("writes a page bundle for a post with a bold title and hashtags", () => {
    const { text, entities } = tgText(
      "**Useful tradeoffs are multi-dimensional.**\n\nاخیراً یه فیچر بزرگ داشتیم.\n\n#tradeoff #tech_blogs\n@aminrbg",
    );
    entities.push({ type: "hashtag", offset: text.indexOf("#tradeoff"), length: 9 });
    entities.push({ type: "hashtag", offset: text.indexOf("#tech_blogs"), length: 11 });
    const post = buildPost([{ id: 21, text, entities }], { ...opts, topic: "engineering" });
    expect(post.dir).toBe("content/posts/telegram-21");
    expect(post.slug).toBe("useful-tradeoffs-are-multi-dimensional");
    expect(post.markdown).toBe(
      [
        "---",
        'title: "Useful tradeoffs are multi-dimensional."',
        "date: 2024-03-01T10:00:00Z",
        'slug: "useful-tradeoffs-are-multi-dimensional"',
        "tags:",
        '- "tradeoff"',
        '- "tech blogs"',
        "categories:",
        '- "کانال تلگرام"',
        "topics:",
        "- engineering",
        'telegram: "https://t.me/aminrbg/21"',
        "---",
        "",
        "اخیراً یه فیچر بزرگ داشتیم.",
        "",
      ].join("\n"),
    );
  });

  it("uses the first photo of an album as the cover and the rest below the text", () => {
    const post = buildPost(
      [
        { id: 31, photo: "B" },
        { id: 30, photo: "A", text: "عکس‌های رویداد دیروز" },
        { id: 32, media: "video" },
      ],
      opts,
    );
    expect(post.title).toBe("عکس‌های رویداد دیروز");
    expect(post.slug).toBe("telegram-30");
    expect(post.images).toEqual([
      { name: "photo-01.fa.jpg", fileId: "A" },
      { name: "photo-02.fa.jpg", fileId: "B" },
    ]);
    expect(post.markdown).toContain("cover:\n    image: photo-01.fa.jpg\n");
    expect(post.markdown).toContain('telegram: "https://t.me/aminrbg/30"');
    expect(post.markdown.endsWith(
      "عکس‌های رویداد دیروز\n\n![](photo-02.fa.jpg)\n\nاین پست ویدیو یا فایلی داره که فقط در تلگرام هست: [دیدن در تلگرام](https://t.me/aminrbg/30)\n",
    )).toBe(true);
  });

  it("uses the post number as the slug when there is no bold title", () => {
    expect(buildPost([{ id: 49, text: "از صفحاتی جالبی که امروز دیدم" }], opts).slug).toBe("telegram-49");
  });


  it("keeps an existing slug when updating", () => {
    expect(buildPost([{ id: 5, text: "متن تازه" }], { ...opts, slug: "قدیمی" }).slug).toBe("قدیمی");
  });
});
