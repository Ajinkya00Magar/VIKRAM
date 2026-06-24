# ============================================================
# PS13 — Makefile
# ============================================================

.PHONY: all up down build logs test clean reset scenario-mpls scenario-bgp help

DC=docker compose

## ── MAIN TARGETS ────────────────────────────────────────────

all: up

## Start full stack
up:
	@echo "🚀 Starting PS13 Mission Control..."
	$(DC) up -d --build
	@echo "✅ Access at http://localhost:3000"

## Stop all services
down:
	$(DC) down

## Build without starting
build:
	$(DC) build

## Follow logs from all services
logs:
	$(DC) logs -f

## Logs for a specific service: make logs-backend
logs-%:
	$(DC) logs -f $*

## ── SETUP ───────────────────────────────────────────────────

## Full setup from scratch (first time)
setup:
	bash scripts/setup.sh

## Pull Mistral 7B model
model:
	bash scripts/pull_model.sh

## Check system health
health:
	bash scripts/health_check.sh

## Seed demo data manually
seed:
	$(DC) run --rm init

## Re-index runbooks into ChromaDB
index-runbooks:
	curl -s -X POST http://localhost:8000/api/rag/index-runbooks | python3 -m json.tool

## ── TESTING ─────────────────────────────────────────────────

## Run backend unit tests
test:
	cd backend && python -m pytest ../tests/ -v

## Quick smoke test (no Docker needed)
smoke:
	cd backend && python ../tests/test_integration.py

## ── DEMO SCENARIOS ──────────────────────────────────────────

## Inject progressive hub congestion (step by step)
scenario-congestion:
	curl -s -X POST "http://localhost:8000/api/scenarios/HUB_CONGESTION/inject" | python3 -m json.tool

## Full MPLS failure (max severity)
scenario-mpls:
	curl -s -X POST "http://localhost:8000/api/scenarios/MPLS_FAILURE/full" | python3 -m json.tool

## BGP route flap
scenario-bgp:
	curl -s -X POST "http://localhost:8000/api/scenarios/BGP_ROUTE_FLAP/full" | python3 -m json.tool

## Tunnel degradation
scenario-tunnel:
	curl -s -X POST "http://localhost:8000/api/scenarios/TUNNEL_DEGRADATION/full" | python3 -m json.tool

## Policy drift
scenario-policy:
	curl -s -X POST "http://localhost:8000/api/scenarios/POLICY_DRIFT/full" | python3 -m json.tool

## Reset all faults to baseline
reset:
	curl -s -X POST "http://localhost:8000/api/scenarios/reset" | python3 -m json.tool
	@echo "✅ All faults cleared"

## ── COPILOT ─────────────────────────────────────────────────

## Ask ARIA a question (usage: make ask Q="What will fail next?")
ask:
	@curl -s -X POST http://localhost:8000/api/copilot/query \
		-H "Content-Type: application/json" \
		-d "{\"question\": \"$(Q)\", \"include_rag\": true}" \
		| python3 -c "import sys,json; d=json.load(sys.stdin); print('\n🤖 ARIA:', d['answer'])"

## ── API SHORTCUTS ────────────────────────────────────────────

## Get system risk summary
risk:
	@curl -s http://localhost:8000/api/risk | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Overall Risk: {d['overall_risk']}/100 | Highest: {d['highest_risk_node']} | Critical: {d['critical_nodes']}\")"

## Get all active predictions
predictions:
	@curl -s http://localhost:8000/api/predictions | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f\"{p['node_id']}: {p['issue_type']} risk={p['risk_score']:.0f} tti={p['time_to_impact_minutes']:.0f}min\") for p in d['predictions']] if d['predictions'] else print('No predictions above threshold')"

## Get blast radius for hub router
blast-hub:
	curl -s "http://localhost:8000/api/blast-radius/HUB-RTR-01?failure_type=MPLS_FAILURE" | python3 -m json.tool

## Get network topology
topology:
	@curl -s http://localhost:8000/api/topology | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Nodes: {len(d['nodes'])} | Links: {len(d['links'])}\")"

## Get graph centrality
centrality:
	@curl -s http://localhost:8000/api/graph/centrality | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f\"{n['node_id']}: {n['betweenness_centrality']:.3f} — {n['interpretation']}\") for n in d['centrality'][:5]]"

## ── MAINTENANCE ──────────────────────────────────────────────

## Clean everything including volumes (DESTRUCTIVE)
clean:
	$(DC) down -v
	@echo "⚠️  All data volumes removed"

## Restart a specific service: make restart-backend
restart-%:
	$(DC) restart $*

## Open InfluxDB UI
influx:
	open http://localhost:8086 || xdg-open http://localhost:8086

## Open API docs
docs:
	open http://localhost:8000/docs || xdg-open http://localhost:8000/docs

## ── HELP ─────────────────────────────────────────────────────

help:
	@echo ""
	@echo "PS13 — Mission Control Makefile"
	@echo "================================"
	@echo "  make setup          First-time setup"
	@echo "  make up             Start all services"
	@echo "  make down           Stop all services"
	@echo "  make health         Check service health"
	@echo "  make model          Pull Mistral 7B"
	@echo "  make test           Run test suite"
	@echo "  make smoke          Quick smoke test (no Docker)"
	@echo ""
	@echo "Demo Scenarios:"
	@echo "  make scenario-mpls      MPLS failure (max severity)"
	@echo "  make scenario-bgp       BGP route flap"
	@echo "  make scenario-tunnel    Tunnel degradation"
	@echo "  make scenario-congestion Hub congestion"
	@echo "  make scenario-policy    Policy drift"
	@echo "  make reset              Reset all faults"
	@echo ""
	@echo "API Shortcuts:"
	@echo "  make risk           System risk summary"
	@echo "  make predictions    Active predictions"
	@echo "  make blast-hub      Blast radius (Hub)"
	@echo "  make centrality     Node centrality ranking"
	@echo "  make ask Q=\"...\"   Ask ARIA copilot"
	@echo ""
