#!/bin/bash
# Weekly Persona Census refresh. Runs on a residential connection because Meta returns zero
# edges to datacenter IPs (verified on GitHub's runners). Pushing to main triggers deploy.yml,
# which publishes the site.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="data/weekly.log"
exec >>"$LOG" 2>&1
echo "=========== $(date '+%Y-%m-%d %H:%M:%S') refresh starting ==========="

git pull --rebase --quiet origin main || echo "warn: pull failed, continuing on local state"

if ! node scripts/harvest.mjs; then
  echo "harvest FAILED (exit $?) - keeping last good data, nothing committed"; exit 1
fi
RESUME=1 MAX_PASSES=1 node scripts/harvest.mjs || echo "warn: gap-fill pass failed, continuing"
node scripts/images.mjs || { echo "images FAILED - nothing committed"; exit 1; }
node scripts/build.mjs  || { echo "build FAILED - nothing committed"; exit 1; }

if git diff --quiet -- data public; then
  echo "no change this week"
else
  git add -A data public
  git -c user.name="Harrison Truong" -c user.email="harrison@modern.ai" \
      commit -q -m "refresh: $(date -u +%Y-%m-%d) census"
  git push --quiet origin main && echo "pushed - deploy.yml will publish"
fi
echo "--- done $(date '+%H:%M:%S')"
