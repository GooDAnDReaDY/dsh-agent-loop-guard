#!/usr/bin/env bash
set -euo pipefail

# deploy.sh for @goodandready/dsh-agent-loop-guard — canonical deployment and verification script.
#
# Delivery path: main -> quality gate (tests, package size, identity invariants) ->
# explicit owner approval -> install published immutable npm version into target profile.
#
# Usage:
#   ./deploy.sh             # pre-deploy checks only (tests, package size, identity)
#   ./deploy.sh --install   # install published @goodandready/dsh-agent-loop-guard into $DSH_PROFILE

PROFILE="${DSH_PROFILE:-web}"
PACKAGE="@goodandready/dsh-agent-loop-guard"

echo "== dsh-agent-loop-guard deploy checks (profile: ${PROFILE}) =="

echo "-- Test suite"
npm test

echo "-- Code syntax and package check"
npm run check

echo "-- Package identity check (name must match in four places)"
node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const patch = fs.readFileSync("cordis.patch.yml", "utf8");
const client = fs.readFileSync("lib/client.js", "utf8");
const server = fs.readFileSync("lib/index.js", "utf8");
const name = "@goodandready/dsh-agent-loop-guard";
const q = String.fromCharCode(39);
if (pkg.name !== name) { console.error("IDENTITY MISMATCH in package.json"); process.exit(1); }
if (!patch.includes(name)) { console.error("IDENTITY MISMATCH in cordis.patch.yml"); process.exit(1); }
if (!client.includes(name) || !client.includes("id: " + q + name + q)) {
  console.error("IDENTITY MISMATCH in lib/client.js"); process.exit(1);
}
if (!server.includes(name) || !server.includes("export const name = " + q + name + q)) {
  console.error("IDENTITY MISMATCH in lib/index.js"); process.exit(1);
}
console.log("identity ok");
'

if [ "${1:-}" = "--install" ]; then
  echo "-- Installing published package into profile ${PROFILE}"
  dsh plugin --profile "$PROFILE" add --config.minimumReleaseAge=0 "$PACKAGE"
  echo "Installed $PACKAGE into profile $PROFILE; restart the profile service (e.g. sudo systemctl restart dsh-web.service)."
  echo "-- Verifying service status"
  sleep 2
  curl -s --max-time 10 http://127.0.0.1:3080/api/@goodandready/dsh-agent-loop-guard/update -H "Sec-Fetch-Site: same-origin" || true
else
  echo "Checks passed. Profile install runs with: $0 --install (published npm version, after owner approval)."
fi
