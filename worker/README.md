# Table talk applications Worker

A Cloudflare Worker (free plan) that receives the application form on the
table talk pages (email required; name, role, where they work and years of experience
optional), stores applications in D1 and sends Amin a private Telegram
message for each one. Applicants are confirmed automatically until the
session's `seats` are taken (7, plus Amin makes eight), and everyone after
that goes to the waitlist. It never emails or messages applicants and stores
no IP addresses.

| Route | What it does |
| --- | --- |
| `POST /api/apply` | Validates the form, rejects a second application with the same email, stores the row as `confirmed` or `waitlist`, notifies Amin, redirects `303` to the thank-you page |
| `GET /api/seats?talk=<slug>` | `{ "confirmed": n, "waitlist": w }`, used for "n of 7 seats taken · w on the waitlist"; at 7 the form switches to "Join the waitlist" |
| anything else | `404` |

The Worker reads `https://aminrb.me/table-talks/index.json` (cached for five
minutes) to check that a session exists and is `open` or `full`. A session
that is `full`, or whose confirmed count has reached `seats`, gets new rows as
`waitlist`; otherwise they are `confirmed`. Counting and inserting is one SQL
statement, so two people submitting at once cannot both take the last seat.

## Setup (once)

```sh
cd worker
npm install
npx wrangler login

# 1. Database: copy the printed database_id into wrangler.jsonc
npx wrangler d1 create aminrb-table-talks
npx wrangler d1 execute DB --remote --file schema.sql

# 2. Telegram: this reuses the telegram-sync bot. Its webhook is unaffected, since this
#    Worker only calls sendMessage, and a reply to an alert just gets the sync bot's help text.
#    TELEGRAM_BOT_TOKEN = the same token as telegram-sync's BOT_TOKEN (@BotFather > /mybots > API Token)
#    TELEGRAM_CHAT_ID   = the same value as telegram-sync's OWNER_ID (your Telegram user id)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID

# 3. Deploy. The route aminrb.me/api/* works because the domain's DNS is on Cloudflare.
npx wrangler deploy
```

The site posts to `params.applyEndpoint` in `config/_default/config.yml`
(`https://aminrb.me/api`). If the Worker ever moves to its `workers.dev`
address, set `workers_dev: true`, drop `routes`, and point `applyEndpoint` at
that address.

### Optional: Turnstile

Off by default. To turn it on, create a Turnstile widget for `aminrb.me` in the
Cloudflare dashboard, then:

```sh
npx wrangler secret put TURNSTILE_SECRET
```

and set `params.turnstileSiteKey` in the site config to the widget's site key.

## Running a session

Everything below works from Telegram:

- Each new application arrives already confirmed or waitlisted, as a card with buttons to
  change that (**✅ Confirm · ⏳ Move to waitlist · ❌ Decline · 🚫 No-show**).
- **📋 Table talks** (or `/apps`) in the bot chat shows the sessions; tap one to see everyone,
  then tap a person for the same buttons.

The buttons and `/apps` are handled by the telegram-sync Worker, which receives the bot's
updates and has this database bound as `TALKS_DB`. The `wrangler` commands below do the same
from a terminal.

1. Read the applicants:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "SELECT id, email, name, role, workplace, experience, state FROM applications WHERE talk = '<slug>' ORDER BY created_at"
   ```

2. The first seven are confirmed automatically; email them yourself. To move someone by hand:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'waitlist' WHERE id IN (...)"
   ```

3. Nothing to do when the seats are taken: new rows arrive as `waitlist` and the form reads
   "Join the waitlist". `status: full` in the front matter (both `index.md` and `index.fa.md`)
   is still there to close the seats early.

4. Someone cancelled: free the seat, then promote the first person on the waitlist:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'declined' WHERE id = <cancelled id>"
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'confirmed' WHERE id = (SELECT id FROM applications WHERE talk = '<slug>' AND state = 'waitlist' ORDER BY created_at LIMIT 1)"
   ```

5. After the session, see who was still waiting (invite them first next time),
   mark no-shows, and set `status: done` in the front matter with the summary as
   the page body:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "SELECT name, email FROM applications WHERE talk = '<slug>' AND state = 'waitlist' ORDER BY created_at"
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'no_show' WHERE id IN (...)"
   ```

## Retention

The form promises deletion 90 days after the session. A daily Cron Trigger
(included in the Workers free plan) deletes rows of sessions whose `eventstart`
is more than 90 days ago, and rows older than 180 days whose session is no
longer on the site.

If the cron is ever removed, run the same cleanup by hand for each finished session:

```sh
npx wrangler d1 execute DB --remote --command \
  "DELETE FROM applications WHERE talk = '<slug>'"   # once its session is 90 days past
```

## Development

```sh
npm test               # unit tests for validation
npm run typecheck
npm run test:local     # wrangler dev + local D1: valid, email-only, full, trap, unknown,
                       # finished, duplicate, invalid and over-capacity submits, /seats, cleanup
```

`test/local.sh` serves `test/fixtures` as the site, so it does not need Hugo.
Secrets for local runs go in `.dev.vars` (git-ignored); without them the
Telegram step is skipped.
