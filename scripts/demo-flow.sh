#!/usr/bin/env bash
# Example end-to-end flow against a running local server.
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000/api/v1}"
ASSET_DIR="${1:-./sample-assets}"

if [[ ! -d "$ASSET_DIR" ]]; then
  echo "Usage: $0 ./path-to-photos"
  echo "Expected files: front.jpg back.jpg detail.jpg bottom_mark.jpg context.jpg video.mp4"
  exit 1
fi

SESSION=$(curl -s -X POST "$BASE/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"currency":"AUD","markupPercent":45}' | tee /dev/stderr)
SESSION_ID=$(node -e "const s=JSON.parse(process.argv[1]); if(!s.id) process.exit(1); process.stdout.write(s.id)" "$SESSION")

echo "Session: $SESSION_ID"

curl -s -X POST "$BASE/sessions/$SESSION_ID/media" \
  -F "files=@${ASSET_DIR}/front.jpg" \
  -F "files=@${ASSET_DIR}/back.jpg" \
  -F "files=@${ASSET_DIR}/detail.jpg" \
  -F "files=@${ASSET_DIR}/bottom_mark.jpg" \
  -F "files=@${ASSET_DIR}/context.jpg" \
  -F "files=@${ASSET_DIR}/video.mp4" \
  -F "slots=front,back,detail,bottom_mark,context,video" | tee /dev/stderr

echo
curl -s -X POST "$BASE/sessions/$SESSION_ID/analyze" | tee /dev/stderr
echo
curl -s -X POST "$BASE/sessions/$SESSION_ID/complete" | tee /dev/stderr
echo
