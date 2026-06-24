-- ============================================================
-- PS13 Database Schema
-- ============================================================

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id   TEXT UNIQUE NOT NULL,
    node_id         TEXT NOT NULL,
    issue_type      TEXT NOT NULL,
    confidence_score FLOAT NOT NULL,
    risk_score      FLOAT NOT NULL,
    time_to_impact  FLOAT NOT NULL,
    affected_scope  TEXT[],
    model_source    TEXT,
    explanation     TEXT,
    features        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Risk score history
CREATE TABLE IF NOT EXISTS risk_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         TEXT NOT NULL,
    risk_score      FLOAT NOT NULL,
    severity_score  FLOAT,
    escalation_level INT,
    urgency_level   TEXT,
    risk_factors    JSONB,
    trend           TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_history_node ON risk_history(node_id, recorded_at DESC);

-- Incidents / runbook index
CREATE TABLE IF NOT EXISTS incidents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     TEXT UNIQUE NOT NULL,
    description     TEXT,
    root_cause      TEXT,
    resolution      TEXT,
    tags            TEXT[],
    occurred_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Actions log
CREATE TABLE IF NOT EXISTS action_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    issue_type      TEXT,
    risk_before     FLOAT,
    risk_after      FLOAT,
    operator        TEXT DEFAULT 'system',
    notes           TEXT,
    executed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario runs
CREATE TABLE IF NOT EXISTS scenario_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_type   TEXT NOT NULL,
    trigger_node    TEXT,
    step            INT DEFAULT 0,
    severity        TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

-- Topology snapshots (periodic)
CREATE TABLE IF NOT EXISTS topology_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot        JSONB NOT NULL,
    node_count      INT,
    link_count      INT,
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         TEXT NOT NULL,
    risk_score      FLOAT,
    urgency_level   TEXT,
    message         TEXT,
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    fired_at        TIMESTAMPTZ DEFAULT NOW(),
    acked_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_node ON alert_history(node_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked ON alert_history(acknowledged) WHERE acknowledged = FALSE;

-- Comments / operator notes
CREATE TABLE IF NOT EXISTS operator_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     TEXT,
    content     TEXT NOT NULL,
    operator    TEXT DEFAULT 'operator',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
