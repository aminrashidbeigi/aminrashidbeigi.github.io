# Table talk applications Worker

A Cloudflare Worker (free plan) that receives the application form on the
table talk pages (email required; name, role, experience, where they work and a
note optional), stores applications in D1 and sends Amin a private Telegram
message for each one. It never emails or messages applicants and stores no
IP addresses. Amin confirms people himself.

| Route | What it does |
| --- | --- |
| `POST /api/apply` | Validates the form, rejects a second application with the same email, stores the row, notifies Amin, redirects `303` to the thank-you page |
| `GET /api/seats?talk=<slug>` | `{ "confirmed": n }`, used for "n of 8 seats taken" |
| anything else | `404` |

The Worker reads `https://aminrb.me/table-talks/index.json` (cached for five
minutes) to check that a session exists and is `open` or `full`. A session
that is `full`, or whose confirmed count has reached `seats`, gets new rows as
`waitlist`.

## Setup (once)

```sh
cd worker
npm install
npx wrangler login

# 1. Database: copy the printed database_id into wrangler.jsonc
npx wrangler d1 create aminrb-table-talks
npx wrangler d1 execute DB --remote --file schema.sql

# 2. Telegram: create a bot with @BotFather, send it any message, then read your
#    chat id from https://api.telegram.org/bot<TOKEN>/getUpdates
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

1. Read the applicants:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "SELECT id, email, name, role, experience, region, note, state FROM applications WHERE talk = '<slug>' ORDER BY created_at"
   ```

2. Confirm eight, waitlist the rest, and email the confirmed people yourself:

   ```sh
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'confirmed' WHERE id IN (...)"
   npx wrangler d1 execute DB --remote --command \
     "UPDATE applications SET state = 'waitlist' WHERE id IN (...)"
   ```

3. When eight are confirmed, set `status: full` in the session's front matter
   (both `index.md` and `index.fa.md`) and deploy the site. From then on the
   form reads "Join the waitlist" and new rows arrive as `waitlist`.

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
