#!/usr/bin/env bash
# ============================================================
# PS13 — Ollama Model Management
# Usage:
#   bash scripts/pull_model.sh          # Pull default model
#   bash scripts/pull_model.sh phi3     # Pull phi3:mini fallback
#   bash scripts/pull_model.sh list     # List loaded models
#   bash scripts/pull_model.sh status   # Check copilot status
# ============================================================

set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

OLLAMA_URL="${OLLAMA_HOST:-http://localhost:11434}"
ACTION="${1:-pull}"

case "$ACTION" in
  pull)
    MODEL="${2:-mistral:7b-instruct}"
    echo -e "${CYAN}Pulling model: $MODEL${NC}"
    echo "This may take 5-20 minutes (~4GB download)..."
    curl -s -X POST "$OLLAMA_URL/api/pull" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$MODEL\"}" | while IFS= read -r line; do
        status=$(echo "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('status',''))" 2>/dev/null || true)
        [ -n "$status" ] && echo "  → $status"
    done
    log "Model $MODEL ready"
    ;;

  phi3)
    echo -e "${CYAN}Pulling fallback: phi3:mini${NC}"
    curl -s -X POST "$OLLAMA_URL/api/pull" \
      -H "Content-Type: application/json" \
      -d '{"name": "phi3:mini"}' | tail -1
    log "phi3:mini ready"
    ;;

  list)
    echo -e "${CYAN}Loaded models:${NC}"
    curl -s "$OLLAMA_URL/api/tags" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
for m in data.get('models', []):
    size_gb = m.get('size', 0) / 1e9
    print(f\"  {m['name']:<40} {size_gb:.1f}GB\")
" 2>/dev/null || warn "Ollama not reachable at $OLLAMA_URL"
    ;;

  status)
    echo -e "${CYAN}PS13 Copilot Status:${NC}"
    # Check Ollama
    if curl -sf "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
      log "Ollama: ONLINE at $OLLAMA_URL"
      MODELS=$(curl -s "$OLLAMA_URL/api/tags" | python3 -c "import sys,json; print([m['name'] for m in json.loads(sys.stdin.read()).get('models',[])])" 2>/dev/null || echo "[]")
      echo "  Models: $MODELS"
    else
      warn "Ollama: OFFLINE — copilot running in rule-based mode"
    fi
    # Check backend copilot
    if curl -sf "http://localhost:8000/api/copilot/status" >/dev/null 2>&1; then
      STATUS=$(curl -s "http://localhost:8000/api/copilot/status")
      log "Backend copilot: $STATUS"
    else
      warn "Backend not reachable at localhost:8000"
    fi
    ;;

  *)
    echo "Usage: $0 [pull|phi3|list|status] [model_name]"
    exit 1
    ;;
esac
