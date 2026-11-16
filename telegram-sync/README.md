# Telegram channel to blog

A Cloudflare Worker (free plan) with its own Telegram bot. When Amin posts in
[@aminrbg](https://t.me/aminrbg), the bot asks him in a private chat whether to
publish the post on aminrb.me. On "publish" it commits a Persian page bundle to
this repo, and the existing Pages workflow deploys it. On "skip" it remembers
the post and never asks again. It has nothing to do with the table talks Worker
in `../worker`.

| Event | What happens |
| --- | --- |
| New post in the channel | Bot sends a preview with topic buttons, "Publish, no topic" and "Skip" |
| Old post forwarded to the bot | Queued. The bot asks about the oldest queued post, then the next one after each answer |
| Published post edited in the channel | Bot asks "Update the blog copy?" |
| `/status` or **Blog posts** in the bot chat | Counts of waiting, queued, published and skipped posts (and re-asks anything stuck) |
| `/help`, `/start` or anything else | What the bot does, and the keyboard under the chat: **Table talks · Blog posts · Help** |

## What a published post looks like

`content/posts/telegram-<message id>/index.fa.md`, plus `photo-01.fa.jpg`,
`photo-02.fa.jpg`, ... for the photos (the `.fa` suffix is what makes Hugo
attach them to the Persian page).

- **Title**: a first line whose words are all bold (an emoji in front may stay
  plain). Otherwise the first words of the post with "…", and then the whole text
  stays in the body.
- **Date**: the date of the original channel post, also for forwarded old posts,
  so they sort among the other posts by when they were written.
- **Slug**: the whole bold title (`/fa/افزایش-شانس-گرفتن-مصاحبه-مقدمه/`). Posts
  without a bold title get the post number, `/fa/telegram-49/`, the same number as
  `t.me/aminrbg/49`; change `slug:` by hand later if you want. If a title's URL is
  already taken, the post number is appended, and the question warns you first,
  since that usually means the post is already on the blog.
- **Tags**: the post's hashtags (`#tech_blogs` becomes `tech blogs`). The trailing
  hashtag line and the `@aminrbg` line are dropped from the body.
- **Category** `کانال تلگرام` (all of them at `/fa/categories/کانال-تلگرام/`, and a
  filter next to the topics once the topic filters are on master), and the topic
  picked with the button.
- **Photos**: the first one is the cover, the others go below the text. Videos,
  files and voice notes are not copied; the post links to Telegram for them.
- **Footer**: `layouts/partials/followup-fa.html` says the post first appeared in
  the channel and links to the original (`telegram:` in the front matter).

- **Links stay as written**, including links to other channel posts (`t.me/aminrbg/53`).
- **Not asked about**: forwarded posts (reposts from other channels or people), polls,
  stickers, and posts with no text at all (a photo, video or GIF alone). This also holds
  when importing: a repost among the forwarded old posts is ignored without a reply.

Telegram formatting (bold, italic, links, mentions, code, quotes, line breaks)
becomes Markdown, see `src/post.ts` and its tests.

## Setup (once)

```sh
cd telegram-sync
npm install
npx wrangler login
```

1. **Bot.** In [@BotFather](https://t.me/BotFather): `/newbot`, keep the token.
   Send your new bot any message, then read your own user id (`"from":{"id":...}`) from
   `https://api.telegram.org/bot<TOKEN>/getUpdates`.
2. **Channel.** In @aminrbg: Administrators → Add Admin → the bot. It needs no
   rights, turn them all off. Telegram only shows channel posts to bots that are admins.
3. **GitHub token.** [Fine-grained token](https://github.com/settings/personal-access-tokens/new)
   for `aminrashidbeigi/aminrashidbeigi.github.io` only, with *Contents: Read and write*.
   Commits made with it trigger the Pages workflow like a normal push.
4. **Database, secrets, deploy.** Copy the printed `database_id` into `wrangler.jsonc`:

   ```sh
   npx wrangler d1 create aminrb-telegram-sync
   npx wrangler d1 execute DB --remote --file schema.sql

   npx wrangler secret put BOT_TOKEN        # from BotFather
   npx wrangler secret put OWNER_ID         # your Telegram user id
   npx wrangler secret put GITHUB_TOKEN
   openssl rand -hex 32                     # use the output as WEBHOOK_SECRET
   npx wrangler secret put WEBHOOK_SECRET

   npx wrangler deploy                      # prints https://aminrb-telegram-sync.<you>.workers.dev
   ```

5. **Webhook.** Point the bot at the Worker:

   ```sh
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H 'Content-Type: application/json' \
     -d '{"url":"https://aminrb-telegram-sync.<you>.workers.dev/webhook",
          "secret_token":"<WEBHOOK_SECRET>",
          "allowed_updates":["channel_post","edited_channel_post","message","callback_query"]}'
   ```

   `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` shows the last delivery error, if any.

The bot commits to `GITHUB_BRANCH` (`master`). The layout pieces it relies on (the
footer and the filter) live in this branch, so merge it before the first publish.

## Importing old posts

In Telegram, select old posts in the channel, tap Forward,
and pick the bot. Up to 100 at a time is fine. Keep the sender shown: posts
forwarded with "hide sender" lose their link to the channel and are ignored.
The bot asks about them one by one, oldest first, and says how many are left.
Posts it already knows (published or skipped) are ignored, so forwarding a range
twice is harmless.

## Table talk applications

The same bot handles table talk applications from the site (see `worker/`):

Everything is a tap, starting from **Table talks** (or `/apps`), and redraws the same message:

- **Sessions**: counts per session by state, one button per session.
- **A session**: everyone with name, role, workplace, experience and email, one button per person,
  plus « All sessions and Refresh. `/apps <slug>` jumps straight here.
- **A person**: their card with Confirm · Move to waitlist · Decline · No-show and
  « Back to the list. Changing the state goes back to the list.
- The alert for each new application is the same card, with Everyone in <session>.

The `/` menu (apps, status, help) is set for Amin's chat whenever the help message is sent.

This Worker reads and updates the `aminrb-table-talks` database through the `TALKS_DB` binding;
the code is in `src/applications.ts`.

## Limits worth knowing

- **Deletions are not synced.** Telegram does not tell bots when a channel post is
  deleted. Delete `content/posts/telegram-<id>/` by hand.
- **Edits** of an unanswered post are picked up silently. Edits of a published post
  ask once, however many edits follow before you answer.
- **Free plan.** Each publish downloads the photos and uploads them to GitHub
  (3 requests per photo plus about 10 more; the free plan allows 50 per request, so albums of
  10 photos fit). Encoding large albums is the most CPU the Worker uses; if a big
  album ever fails with a CPU limit error in `wrangler tail`, publish it again or
  add it by hand.
- A failed publish leaves the buttons in place and tells you why; tap again to retry.
- A publish Cloudflare cuts off (it stops the work 30 seconds after the tap, before the bot can
  say anything) leaves the post waiting. Two minutes after the tap its buttons work again, and
  **Blog posts** asks about it again, so the old posts queued behind it are not stuck.

## Development

```sh
npm test          # Telegram formatting to Markdown, titles, slugs, front matter
npm run typecheck
npx wrangler tail # live logs of the deployed Worker
```
