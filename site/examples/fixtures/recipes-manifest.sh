#!/bin/bash
# List the day's CSV exports in a manifest, then compress them.
set -euo pipefail

dir=recipes-exports
: > manifest.txt
for f in "$dir"/*.csv; do
  name=$(basename "$f")
  rows=$(tail -n +2 "$f" | wc -l)
  refunds=$(grep -c ',refunded$' "$f" || true)
  sum=$(sha256sum "$f" | cut -c 1-12)
  echo "$name rows=$rows refunds=$refunds sha256=$sum" >> manifest.txt
  gzip -f "$f"
done
cat manifest.txt
