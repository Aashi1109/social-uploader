#!/usr/bin/env bash
set -euo pipefail

API_TOKEN="${API_TOKEN:-changeme}"
BASE_URL="${BASE_URL:-http://localhost:3000/v1}"

echo "POST /publish"
REQ_ID=$(curl -s -X POST "$BASE_URL/publish" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"default","mediaUrl":"https://example.com/video.mp4","idempotencyKey":"abc-123","platforms":["instagram","youtube"]}' \
  | jq -r .requestId)

echo "Request ID: $REQ_ID"

echo "GET /publish/:id"
curl -s "$BASE_URL/publish/$REQ_ID" | jq .


