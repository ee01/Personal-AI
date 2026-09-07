#!/bin/sh
# Create export job, wait, save backup zip for esone.qiu
set -eu

USER_ID="${USER_ID:-esone.qiu}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3210/api/v1}"
OUT_DIR="${OUT_DIR:-/tmp}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/${USER_ID}-memory-backup-${STAMP}.zip"

AUTH_ARGS=()
if [ -n "${API_KEY:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${API_KEY}")
elif [ -n "${AUTHORIZATION:-}" ]; then
  AUTH_ARGS=(-H "Authorization: ${AUTHORIZATION}")
fi

echo "[backup] creating export job for ${USER_ID}..."
JOB_JSON="$(curl -sf -X POST "${BASE_URL}/export/jobs" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${USER_ID}" \
  "${AUTH_ARGS[@]}" \
  -d '{"includeDerived":true,"includeVectors":true,"encrypt":false}')"
JOB_ID="$(echo "$JOB_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
if [ -z "$JOB_ID" ]; then
  echo "[backup] failed to create job: $JOB_JSON" >&2
  exit 1
fi
echo "[backup] job_id=${JOB_ID}"

for i in $(seq 1 180); do
  STATUS_JSON="$(curl -sf "${BASE_URL}/export/jobs/${JOB_ID}" \
    -H "X-User-Id: ${USER_ID}" \
    "${AUTH_ARGS[@]}")"
  STATUS="$(echo "$STATUS_JSON" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p' | head -1)"
  echo "[backup] poll ${i}: status=${STATUS}"
  if [ "$STATUS" = "ready" ]; then
    curl -sf "${BASE_URL}/export/jobs/${JOB_ID}/download" \
      -H "X-User-Id: ${USER_ID}" \
      "${AUTH_ARGS[@]}" \
      -o "$OUT_FILE"
    ls -lh "$OUT_FILE"
    echo "[backup] saved ${OUT_FILE}"
    exit 0
  fi
  if [ "$STATUS" = "failed" ]; then
    echo "[backup] job failed: $STATUS_JSON" >&2
    exit 1
  fi
  sleep 10
done

echo "[backup] timed out waiting for job ${JOB_ID}" >&2
exit 1
