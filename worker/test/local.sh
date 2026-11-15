#!/bin/sh
# End-to-end check against `wrangler dev` with a local D1 database.
# Serves test/fixtures as the site (one open, one full and one finished session)
# and posts the application form to the Worker in each scenario.
set -eu
cd "$(dirname "$0")/.."

SITE_PORT=8799
WORKER_PORT=8798
WORKER="http://localhost:$WORKER_PORT/api"
STATE=$(mktemp -d)

cleanup() { kill "$SITE_PID" "$WORKER_PID" 2>/dev/null || true; rm -rf "$STATE"; }
trap cleanup EXIT

python3 -m http.server "$SITE_PORT" -d test/fixtures >/dev/null 2>&1 & SITE_PID=$!
npx wrangler d1 execute DB --local --persist-to "$STATE" --file schema.sql >/dev/null
npx wrangler dev --port "$WORKER_PORT" --persist-to "$STATE" \
  --var "SITE_ORIGIN:http://localhost:$SITE_PORT" --test-scheduled >"$STATE/dev.log" 2>&1 & WORKER_PID=$!
until curl -s -o /dev/null "http://localhost:$WORKER_PORT/"; do sleep 0.5; done

failures=0
apply() { # expected-location-suffix, form fields...
  expected=$1; shift
  location=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$@" "$WORKER/apply")
  case "$location" in
    "303 http://localhost:$SITE_PORT$expected") echo "ok    $expected" ;;
    *) echo "FAIL  expected 303 $expected, got $location"; failures=$((failures + 1)) ;;
  esac
}
valid() { # talk, email, lang, [experience]
  echo -d talk="$1" -d lang="$3" -d email="$2" -d role=Engineer -d workplace=Startup/Germany -d experience="${4:-3-5}"
}
sql() { npx wrangler d1 execute DB --local --persist-to "$STATE" --json --command "$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["results"])'; }

echo "valid submit";            apply "/fa/table-talks/thanks/"                                $(valid open-talk sara@example.com fa)
echo "full session";            apply "/table-talks/thanks/?waitlist=1"                        $(valid full-talk omid@example.com en)
echo "trap field";              apply "/fa/table-talks/thanks/"                                $(valid open-talk bot@example.com fa) -d website=http://spam.example
echo "unknown talk";            apply "/fa/table-talks/?error=closed"                          $(valid no-such-talk sara@example.com fa)
echo "finished talk";           apply "/fa/table-talks/done-talk/?error=closed#apply"          $(valid done-talk sara@example.com fa)
echo "duplicate (case differs)"; apply "/fa/table-talks/open-talk/?error=duplicate#apply"      $(valid open-talk SARA@example.com fa)
echo "invalid choice";          apply "/fa/table-talks/open-talk/?error=1#apply"               $(valid open-talk neda@example.com fa 40)
echo "email only";              apply "/fa/table-talks/thanks/"                                -d talk=open-talk -d lang=fa -d email=mina@example.com
confirmed=$(sql "SELECT email FROM applications WHERE talk = 'open-talk' AND state = 'confirmed' ORDER BY id")
[ "$confirmed" = "[{'email': 'sara@example.com'}, {'email': 'mina@example.com'}]" ] && echo "ok    open session confirms applicants" || { echo "FAIL  confirmed $confirmed"; failures=$((failures + 1)); }
echo "last seat";               apply "/table-talks/thanks/"                                   $(valid open-talk last@example.com en)
sql "INSERT INTO applications (talk, lang, email, state) SELECT 'open-talk', 'fa', 'p' || value || '@example.com', 'confirmed' FROM json_each('[1,2,3,4]')" >/dev/null
echo "open but seats confirmed"; apply "/table-talks/thanks/?waitlist=1"                       $(valid open-talk late@example.com en)

echo
echo "stored rows:"
sql "SELECT talk, email, workplace, state FROM applications WHERE email NOT LIKE 'p_@example.com' ORDER BY id"
rows=$(sql "SELECT COUNT(*) AS n FROM applications WHERE email = 'bot@example.com'")
[ "$rows" = "[{'n': 0}]" ] && echo "ok    trap submission not stored" || { echo "FAIL  trap submission stored"; failures=$((failures + 1)); }

seats=$(curl -s -D "$STATE/h" "$WORKER/seats?talk=open-talk")
[ "$seats" = '{"confirmed":7,"waitlist":1}' ] && echo "ok    /seats -> $seats" || { echo "FAIL  /seats -> $seats"; failures=$((failures + 1)); }
grep -qi "access-control-allow-origin: http://localhost:$SITE_PORT" "$STATE/h" && echo "ok    CORS header" || { echo "FAIL  CORS header"; failures=$((failures + 1)); }
code=$(curl -s -o /dev/null -w '%{http_code}' "$WORKER/other")
[ "$code" = 404 ] && echo "ok    other paths -> 404" || { echo "FAIL  other paths -> $code"; failures=$((failures + 1)); }

echo "retention cleanup"
sql "INSERT INTO applications (talk, lang, email, created_at) VALUES
  ('old-talk', 'en', 'old', datetime('now', '-200 days')),
  ('gone-talk', 'en', 'orphan', datetime('now', '-200 days')),
  ('gone-talk', 'en', 'recent-orphan', datetime('now', '-10 days'))" >/dev/null
curl -s -o /dev/null "http://localhost:$WORKER_PORT/__scheduled?cron=17+3+*+*+*"
left=$(sql "SELECT email FROM applications WHERE email IN ('old', 'orphan', 'recent-orphan', 'sara@example.com') ORDER BY email")
[ "$left" = "[{'email': 'recent-orphan'}, {'email': 'sara@example.com'}]" ] && echo "ok    cleanup kept recent rows, deleted expired ones" || { echo "FAIL  cleanup left $left"; failures=$((failures + 1)); }

echo
[ "$failures" -eq 0 ] && echo "all local checks passed" || { echo "$failures local check(s) failed"; exit 1; }
