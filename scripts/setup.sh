#!/usr/bin/env bash
# ============================================================
# PS13 — Master Setup Script
# Usage: bash scripts/setup.sh
# Brings up full air-gapped system from scratch.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

BANNER="
╔══════════════════════════════════════════════════════════╗
║          VIKRAM — AIR-GAPPED PREDICTIVE COPILOT          ║
║              SECURE MPLS OPERATIONS CONSOLE              ║
╚══════════════════════════════════════════════════════════╝"

echo -e "${CYAN}${BANNER}${NC}"
echo ""

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

# ── Prerequisites check ─────────────────────────────────────

step "Checking prerequisites"

command -v docker      >/dev/null 2>&1 || err "Docker not found. Install: https://docs.docker.com/get-docker/"
command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || err "docker-compose not found"
log "Docker: $(docker --version)"

DC="docker compose"
command -v docker-compose >/dev/null 2>&1 && DC="docker-compose"

# ── Environment file ────────────────────────────────────────

step "Environment configuration"

if [ ! -f .env ]; then
    cp .env.example .env
    # Generate random secret key
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i.bak "s/<<SECRET_REQUIRED>>/${SECRET}/g" .env
    # Generate InfluxDB token
    INFLUX_TOKEN=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i.bak "s/ps13-influx-token-dev/${INFLUX_TOKEN}/g" .env
    # Set default password
    sed -i.bak "s/POSTGRES_PASSWORD=<<SECRET_REQUIRED>>/POSTGRES_PASSWORD=ps13_db_pass_$(openssl rand -hex 8)/g" .env
    rm -f .env.bak
    log ".env created with generated secrets"
else
    log ".env already exists, skipping"
fi

# ── Pull Ollama model ────────────────────────────────────────

step "Starting infrastructure layer"

log "Starting databases and Ollama..."
$DC up -d postgres influxdb chromadb ollama

echo "Waiting for services to be healthy..."
sleep 15

# Health check loop
for svc in postgres influxdb chromadb; do
    max=30; count=0
    while ! $DC ps "$svc" 2>/dev/null | grep -q "healthy"; do
        count=$((count + 1))
        [ $count -ge $max ] && { warn "$svc health check timeout, continuing..."; break; }
        sleep 2
    done
    log "$svc is healthy"
done

# ── Pull Mistral 7B ──────────────────────────────────────────

step "Pulling Mistral 7B Instruct (this may take 5-20 min depending on connection)"

warn "Model size: ~4.1GB. Required for offline AI copilot."
warn "This step only runs once — model is cached in Docker volume."

if $DC exec -T ollama ollama list 2>/dev/null | grep -q "mistral:7b"; then
    log "mistral:7b-instruct already pulled"
else
    log "Pulling mistral:7b-instruct..."
    $DC exec -T ollama ollama pull mistral:7b-instruct || {
        warn "Mistral pull failed. Trying phi3:mini as fallback..."
        $DC exec -T ollama ollama pull phi3:mini || warn "Fallback also failed. Copilot will use rule-based mode."
    }
fi

# ── Start full stack ─────────────────────────────────────────

step "Starting full application stack"

$DC up -d --build
log "All services started"

# ── Seed demo data ───────────────────────────────────────────

step "Seeding demo data"

sleep 10
log "Running data generator..."
$DC run --rm init || warn "Data seeding had errors (non-fatal, continuing)"

# ── Final status ─────────────────────────────────────────────

step "System Status"

echo ""
$DC ps
echo ""

echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  VIKRAM IS OPERATIONAL                   ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  VIKRAM Console  →  http://localhost:3000                ║"
echo "║  Backend API Docs    →  http://localhost:8000/docs       ║"
echo "║  InfluxDB UI         →  http://localhost:8086            ║"
echo "║  Prometheus          →  http://localhost:9090            ║"
echo "║  Grafana             →  http://localhost:3001            ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  WebSocket           →  ws://localhost:8000/ws           ║"
echo "║  Ollama API          →  http://localhost:11434           ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Try a demo scenario:                                    ║"
echo "║  curl -X POST localhost:8000/api/scenarios/             ║"
echo "║        MPLS_FAILURE/full                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
