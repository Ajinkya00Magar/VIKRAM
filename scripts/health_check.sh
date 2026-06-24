#!/usr/bin/env bash
# ============================================================
# PS13 — System Health Check
# Usage: bash scripts/health_check.sh
# ============================================================

set -uo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BOLD='\033[1m'; NC='\033[0m'

check() {
  local name="$1"; local url="$2"; local expected="${3:-200}"
  local code
  code=$(curl -sow "%{http_code}" "$url" 2>/dev/null | tail -1)
  if [ "$code" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} ${name}: ${GREEN}UP${NC} ($code)"
  else
    echo -e "  ${RED}✗${NC} ${name}: ${RED}DOWN${NC} (got $code, expected $expected)"
  fi
}

echo -e "\n${BOLD}${CYAN}PS13 System Health Check — $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}\n"

echo -e "${BOLD}Infrastructure:${NC}"
check "PostgreSQL"  "http://localhost:5432"        "000"    # TCP only
check "InfluxDB"    "http://localhost:8086/health" "200"
check "ChromaDB"    "http://localhost:8100/api/v1/heartbeat" "200"
check "Ollama"      "http://localhost:11434/api/tags"        "200"
check "Prometheus"  "http://localhost:9090/-/healthy"        "200"
check "Grafana"     "http://localhost:3001/api/health"       "200"

echo -e "\n${BOLD}Application:${NC}"
check "Backend API"     "http://localhost:8000/health"        "200"
check "Backend Docs"    "http://localhost:8000/docs"          "200"
check "Frontend UI"     "http://localhost:3000"               "200"

echo -e "\n${BOLD}API Endpoints:${NC}"
check "Topology"        "http://localhost:8000/api/topology"  "200"
check "Risk Summary"    "http://localhost:8000/api/risk"      "200"
check "Predictions"     "http://localhost:8000/api/predictions" "200"
check "Copilot Status"  "http://localhost:8000/api/copilot/status" "200"
check "RAG Stats"       "http://localhost:8000/api/rag/stats" "200"
check "Scenarios"       "http://localhost:8000/api/scenarios" "200"

echo -e "\n${BOLD}Ollama Models:${NC}"
MODELS=$(curl -sf "http://localhost:11434/api/tags" 2>/dev/null | \
  python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    models = data.get('models', [])
    if models:
        for m in models:
            print(f'  ✓ {m[\"name\"]} ({m.get(\"size\",0)/1e9:.1f}GB)')
    else:
        print('  ! No models loaded — run: bash scripts/pull_model.sh')
except:
    print('  ! Could not reach Ollama')
" 2>/dev/null)
echo "$MODELS"

echo -e "\n${BOLD}Demo Scenarios (quick test):${NC}"
SCENARIOS=$(curl -sf "http://localhost:8000/api/scenarios" 2>/dev/null | \
  python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    for s in data.get('scenarios', []):
        print(f'  ✓ {s[\"scenario_type\"]} → {s[\"trigger_node\"]}')
except:
    print('  ! Could not fetch scenarios')
" 2>/dev/null)
echo "$SCENARIOS"

echo -e "\n${BOLD}${CYAN}Quick Start Commands:${NC}"
echo "  Inject MPLS failure:   curl -X POST localhost:8000/api/scenarios/MPLS_FAILURE/full"
echo "  Reset all faults:      curl -X POST localhost:8000/api/scenarios/reset"
echo "  Ask copilot:           curl -X POST localhost:8000/api/copilot/query -H 'Content-Type: application/json' -d '{\"question\":\"What will fail next?\"}'"
echo "  Pull Mistral model:    bash scripts/pull_model.sh"
echo ""
