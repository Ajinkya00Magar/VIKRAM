# PS13 — Manual Setup Checklist

## Pre-Deployment

- [ ] Server has 16GB RAM minimum (8GB for Mistral 7B + 8GB for application)
- [ ] Docker 24+ installed (`docker --version`)
- [ ] Docker Compose v2 installed (`docker compose version`)
- [ ] 20GB free disk space (model + data)
- [ ] Air-gapped environment confirmed (no outbound internet required post-setup)

## Network Device Configuration

### SNMP Access
- [ ] SNMP community string configured: `<<SNMP_COMMUNITY>>`
- [ ] SNMP v2c or v3 enabled on all routers
- [ ] Telegraf server IP whitelisted on device ACLs
- [ ] Test: `snmpwalk -v2c -c <community> <device-ip> 1.3.6.1.2.1.1.1.0`

### NetFlow/IPFIX Export
- [ ] NetFlow v9 or IPFIX enabled on WAN interfaces
- [ ] Export target: `<ps13-server-ip>:9995`
- [ ] Test: check Telegraf netflow input logs

### Syslog
- [ ] Syslog forwarding configured to `<ps13-server-ip>:514`
- [ ] Log level: informational or debug

## Topology Configuration
- [ ] Device inventory exported from CMDB
- [ ] Update `backend/services/digital_twin/twin.py`:
  - [ ] Replace `SAMPLE_TOPOLOGY_NODES` with real device list
  - [ ] Replace `SAMPLE_TOPOLOGY_LINKS` with real link map
  - [ ] Set correct `position_x/y` for topology visualization
  - [ ] Set `is_critical=True` for hub/PE routers
  - [ ] Set correct `services` per node
- [ ] Update `SITE_USER_COUNT` with actual site user counts

## Runbook Integration
- [ ] Place operational runbooks in `data/runbooks/` as `.md` files
- [ ] Include: root cause sections, step-by-step procedures, rollback instructions
- [ ] Run indexing: `curl -X POST localhost:8000/api/rag/index-runbooks`
- [ ] Verify: `curl localhost:8000/api/rag/stats`

## Secrets
- [ ] `POSTGRES_PASSWORD` — strong password set in `.env`
- [ ] `INFLUXDB_TOKEN` — generated (done by setup.sh)
- [ ] `SECRET_KEY` — generated (done by setup.sh)
- [ ] `SNMP_COMMUNITY` — set from network device config

## Ollama Model
- [ ] `mistral:7b-instruct` pulled: `bash scripts/pull_model.sh`
- [ ] Test: `curl http://localhost:11434/api/tags`
- [ ] Test copilot: `curl localhost:8000/api/copilot/status`

## Post-Deployment Verification
- [ ] Run: `bash scripts/health_check.sh`
- [ ] All green ✓ on health check
- [ ] WebSocket connects: open `http://localhost:3000`, check LIVE indicator
- [ ] Risk scores updating every 10s (watch network canvas)
- [ ] Inject test scenario: `curl -X POST localhost:8000/api/scenarios/HUB_CONGESTION/inject`
- [ ] Verify node color changes on canvas
- [ ] Verify alert appears in ticker
- [ ] Ask ARIA: "What is likely to fail next?" — confirm response

## Containerlab (Virtual Lab, Optional)
- [ ] Containerlab installed: `sudo containerlab version`
- [ ] Router images available: `docker images | grep vrnetlab`
- [ ] Deploy: `sudo containerlab deploy -t infra/network/containerlab/topology.yml`
- [ ] Configure router IPs per `infra/network/containerlab/topology.yml`

## Maintenance
- [ ] Schedule daily InfluxDB retention: 30-day default (configured in docker-compose)
- [ ] ChromaDB backup: `docker exec ps13-chromadb tar czf /tmp/chroma-backup.tar.gz /chroma/chroma`
- [ ] PostgreSQL backup: `docker exec ps13-postgres pg_dump -U ps13_user ps13_db > backup.sql`
- [ ] Model updates: `bash scripts/pull_model.sh list` to check versions
