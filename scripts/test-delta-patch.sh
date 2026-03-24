#!/bin/bash
# Test script for delta patch feature
# Usage: ./scripts/test-delta-patch.sh [service_url]

set -e

SERVICE_URL="${1:-http://localhost:8788}"
export WIDGET_SERVICE_URL="$SERVICE_URL"

CLI="node dist/duoduo-widget.js"

echo "=== Step 1: Open widget ==="
OPEN_RESULT=$($CLI open --title "Delta Patch Test" --ttl-seconds 300)
echo "$OPEN_RESULT" | jq .

WIDGET_ID=$(echo "$OPEN_RESULT" | jq -r '.widget_id')
VIEWER_URL=$(echo "$OPEN_RESULT" | jq -r '.viewer_url')
echo ""
echo "viewer_url: $VIEWER_URL"
echo ""

echo "=== Step 2: Full HTML update (skeleton) ==="
SKELETON='<div id="root"><h1 id="title">Dashboard</h1><div id="stats"><span id="count">0</span> items</div><table id="data"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody id="rows"></tbody></table><div id="status">Loading...</div></div>'

$CLI update --wid "$WIDGET_ID" --html "$SKELETON" | jq .
echo ""

echo "=== Step 3: Patch - append rows ==="
PATCH1='[
  {"op":"append","selector":"#rows","html":"<tr><td>Alpha</td><td>100</td></tr>"},
  {"op":"append","selector":"#rows","html":"<tr><td>Beta</td><td>200</td></tr>"},
  {"op":"text","selector":"#count","text":"2"},
  {"op":"text","selector":"#status","text":"Loading more..."}
]'
$CLI update --wid "$WIDGET_ID" --patch "$PATCH1" | jq .
echo ""

echo "=== Step 4: Patch - more rows + status ==="
PATCH2='[
  {"op":"append","selector":"#rows","html":"<tr><td>Gamma</td><td>300</td></tr>"},
  {"op":"text","selector":"#count","text":"3"},
  {"op":"innerHTML","selector":"#status","html":"<strong style=\"color:green\">Complete</strong>"}
]'
$CLI update --wid "$WIDGET_ID" --patch "$PATCH2" | jq .
echo ""

echo "=== Step 5: Finalize ==="
$CLI finalize --wid "$WIDGET_ID" | jq .
echo ""
echo "Done. Open in browser: $VIEWER_URL"
