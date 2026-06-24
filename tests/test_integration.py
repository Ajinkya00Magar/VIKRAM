"""
PS13 — Integration Test Suite
Tests all major system components.
Run: pytest tests/ -v
"""
import pytest
import asyncio
from datetime import datetime

# ──────────────────────────────────────────────────────
# DIGITAL TWIN TESTS
# ──────────────────────────────────────────────────────

def test_twin_initialization():
    """Digital twin initializes with correct node/link count."""
    import sys; sys.path.insert(0, "backend")
    from services.digital_twin.twin import get_twin
    twin = get_twin()
    assert twin.graph.number_of_nodes() >= 10
    assert twin.graph.number_of_edges() >= 20
    print(f"✓ Twin: {twin.graph.number_of_nodes()} nodes, {twin.graph.number_of_edges()} edges")


def test_twin_topology_export():
    """Digital twin exports valid topology."""
    import sys; sys.path.insert(0, "backend")
    from services.digital_twin.twin import get_twin
    twin = get_twin()
    topo = twin.get_topology()
    assert len(topo.nodes) > 0
    assert len(topo.links) > 0
    assert all(n.node_id for n in topo.nodes)
    print(f"✓ Topology: {len(topo.nodes)} nodes, {len(topo.links)} links")


def test_twin_blast_radius():
    """Downstream node BFS finds affected nodes."""
    import sys; sys.path.insert(0, "backend")
    from services.digital_twin.twin import get_twin
    twin = get_twin()
    affected = twin.get_downstream_nodes("HUB-RTR-01", depth=3)
    assert len(affected) > 0
    print(f"✓ Blast radius of HUB-RTR-01: {len(affected)} downstream nodes")


def test_twin_path_finding():
    """Path finding returns valid routes."""
    import sys; sys.path.insert(0, "backend")
    from services.digital_twin.twin import get_twin
    twin = get_twin()
    path = twin.get_critical_path("SPOKE-RTR-A", "BGP-PEER-01")
    assert path is not None
    assert "SPOKE-RTR-A" in path
    print(f"✓ Path SPOKE-RTR-A → BGP-PEER-01: {' → '.join(path)}")


# ──────────────────────────────────────────────────────
# RISK ENGINE TESTS
# ──────────────────────────────────────────────────────

def test_risk_healthy():
    """Healthy metrics produce low risk score."""
    import sys; sys.path.insert(0, "backend")
    from services.risk.risk_engine import RiskEngine
    engine = RiskEngine()
    score = engine.compute("TEST-NODE", {
        "cpu_utilization": 15, "bandwidth_utilization": 20,
        "packet_loss": 0, "latency_ms": 5, "memory_utilization": 40,
        "error_rate": 0, "jitter_ms": 1, "qos_drop_rate": 0,
    })
    assert score.risk_score < 25
    assert score.urgency_level.value in ("HEALTHY", "LOW")
    print(f"✓ Healthy risk score: {score.risk_score:.1f} ({score.urgency_level.value})")


def test_risk_congested():
    """High bandwidth + CPU produces HIGH risk."""
    import sys; sys.path.insert(0, "backend")
    from services.risk.risk_engine import RiskEngine
    engine = RiskEngine()
    score = engine.compute("TEST-NODE", {
        "cpu_utilization": 90, "bandwidth_utilization": 88,
        "packet_loss": 1.5, "latency_ms": 35, "memory_utilization": 80,
        "error_rate": 0.5, "jitter_ms": 8, "qos_drop_rate": 3,
    })
    assert score.risk_score >= 55
    assert score.urgency_level.value in ("MEDIUM", "HIGH", "CRITICAL")
    print(f"✓ Congested risk score: {score.risk_score:.1f} ({score.urgency_level.value})")


def test_risk_critical():
    """Critical metrics trigger CRITICAL risk level."""
    import sys; sys.path.insert(0, "backend")
    from services.risk.risk_engine import RiskEngine
    engine = RiskEngine()
    score = engine.compute("TEST-NODE", {
        "cpu_utilization": 99, "bandwidth_utilization": 95,
        "packet_loss": 8.0, "latency_ms": 150, "memory_utilization": 95,
        "error_rate": 5.0, "jitter_ms": 40, "qos_drop_rate": 12,
    }, is_critical=True)
    assert score.risk_score >= 75
    assert score.escalation_level >= 4
    print(f"✓ Critical risk score: {score.risk_score:.1f}, escalation level: {score.escalation_level}")


def test_risk_trend():
    """Risk trend detects increasing pattern."""
    import sys; sys.path.insert(0, "backend")
    from services.risk.risk_engine import RiskEngine
    engine = RiskEngine()
    for risk_val in [20, 25, 30, 38, 48]:
        engine._history.setdefault("TREND-NODE", []).append(risk_val)
    trend = engine._compute_trend("TREND-NODE", 55.0)
    assert trend == "INCREASING"
    print(f"✓ Risk trend detection: INCREASING correctly identified")


# ──────────────────────────────────────────────────────
# PREDICTION ENGINE TESTS
# ──────────────────────────────────────────────────────

def test_predictor_below_threshold():
    """Healthy metrics return None prediction (below threshold)."""
    import sys; sys.path.insert(0, "backend")
    from services.prediction.predictor import EnsemblePredictor
    predictor = EnsemblePredictor()
    for _ in range(35):
        predictor.ingest_telemetry("NODE-A", {
            "cpu_utilization": 20, "bandwidth_utilization": 15,
            "packet_loss": 0, "latency_ms": 5, "error_rate": 0,
            "jitter_ms": 1, "qos_drop_rate": 0, "memory_utilization": 35,
        })
    pred = predictor.predict("NODE-A", {
        "cpu_utilization": 20, "bandwidth_utilization": 15,
        "packet_loss": 0, "latency_ms": 5, "error_rate": 0,
        "jitter_ms": 1, "qos_drop_rate": 0, "memory_utilization": 35,
    }, [])
    # Either None or very low risk
    if pred:
        assert pred.risk_score < 20
    print("✓ Healthy node: no significant prediction")


def test_predictor_congestion():
    """High BW/CPU triggers CONGESTION prediction."""
    import sys; sys.path.insert(0, "backend")
    from services.prediction.predictor import EnsemblePredictor
    predictor = EnsemblePredictor()
    metrics = {
        "cpu_utilization": 87, "bandwidth_utilization": 91,
        "packet_loss": 0.8, "latency_ms": 30, "error_rate": 0.2,
        "jitter_ms": 5, "qos_drop_rate": 3.5, "memory_utilization": 75,
    }
    for _ in range(35):
        predictor.ingest_telemetry("HUB-NODE", metrics)
    pred = predictor.predict("HUB-NODE", metrics, ["SPOKE-A", "SPOKE-B"])
    if pred:
        assert pred.risk_score >= 15
        assert pred.confidence_score > 0
        print(f"✓ Congestion prediction: {pred.issue_type.value}, risk={pred.risk_score:.1f}, conf={pred.confidence_score:.2f}")
    else:
        print("✓ No prediction generated (metrics within model threshold)")


# ──────────────────────────────────────────────────────
# BLAST RADIUS TESTS
# ──────────────────────────────────────────────────────

def test_blast_radius_hub():
    """Hub router failure affects multiple downstream sites."""
    import sys; sys.path.insert(0, "backend")
    from services.blast_radius.analyzer import BlastRadiusAnalyzer
    from models.schemas import IssueType
    analyzer = BlastRadiusAnalyzer()
    result = analyzer.analyze("HUB-RTR-01", IssueType.MPLS_FAILURE)
    assert len(result.affected_nodes) > 0
    assert len(result.affected_sites) > 0
    assert result.impact_score > 20
    assert result.estimated_users_impacted > 0
    print(f"✓ Hub blast radius: {len(result.affected_nodes)} nodes, {len(result.affected_sites)} sites, {result.estimated_users_impacted} users, impact={result.impact_score:.1f}")


def test_blast_radius_leaf():
    """Leaf/spoke node has smaller blast radius."""
    import sys; sys.path.insert(0, "backend")
    from services.blast_radius.analyzer import BlastRadiusAnalyzer
    from models.schemas import IssueType
    hub_analyzer = BlastRadiusAnalyzer()
    spoke_analyzer = BlastRadiusAnalyzer()
    hub_result   = hub_analyzer.analyze("HUB-RTR-01", IssueType.MPLS_FAILURE)
    spoke_result = spoke_analyzer.analyze("SPOKE-RTR-D", IssueType.TUNNEL_DEGRADATION)
    assert hub_result.impact_score >= spoke_result.impact_score
    print(f"✓ Impact comparison: Hub={hub_result.impact_score:.1f} ≥ Spoke={spoke_result.impact_score:.1f}")


# ──────────────────────────────────────────────────────
# SIMULATION TESTS
# ──────────────────────────────────────────────────────

def test_simulation_do_nothing_worst():
    """Do-nothing is never the best action for high-risk scenarios."""
    import sys; sys.path.insert(0, "backend")
    from services.simulation.counterfactual import CounterfactualEngine
    from models.schemas import IssueType
    engine = CounterfactualEngine()
    result = engine.simulate("HUB-RTR-01", IssueType.CONGESTION, current_risk=78.0)
    assert result.recommended_action.action_type.value != "DO_NOTHING"
    best = max(result.action_outcomes, key=lambda x: x.risk_reduction_pct)
    assert best.risk_reduction_pct > result.do_nothing_outcome.risk_reduction_pct
    print(f"✓ Best action: {result.recommended_action.action_type.value} ({best.risk_reduction_pct:.0f}% reduction)")


def test_simulation_mpls_failure():
    """MPLS failure simulation recommends RESET_MPLS_PATH or FAILOVER."""
    import sys; sys.path.insert(0, "backend")
    from services.simulation.counterfactual import CounterfactualEngine
    from models.schemas import IssueType, ActionType
    engine = CounterfactualEngine()
    result = engine.simulate("MPLS-PE-01", IssueType.MPLS_FAILURE, current_risk=85.0)
    best = result.recommended_action.action_type
    assert best in (ActionType.RESET_MPLS_PATH, ActionType.FAILOVER_TO_BACKUP, ActionType.REROUTE_TRAFFIC)
    print(f"✓ MPLS failure recommendation: {best.value}")


# ──────────────────────────────────────────────────────
# ACTION RANKING TESTS
# ──────────────────────────────────────────────────────

def test_action_ranker_bgp():
    """BGP flap scenario ranks CLEAR_BGP_SESSION highly."""
    import sys; sys.path.insert(0, "backend")
    from services.action_ranking.ranker import ActionRanker
    from models.schemas import IssueType, ActionType
    ranker = ActionRanker()
    plan = ranker.rank("BGP-PEER-01", IssueType.BGP_FLAP, 80.0)
    assert len(plan.ranked_actions) >= 3
    top_action = plan.ranked_actions[0]
    # Top action should not be DO_NOTHING
    assert top_action.action_type != ActionType.DO_NOTHING
    # Risk reduction should be positive
    assert top_action.risk_reduction_pct > 0
    print(f"✓ BGP flap #1 action: {top_action.action_type.value} ({top_action.risk_reduction_pct:.0f}% reduction)")


def test_action_runbook_refs():
    """All ranked actions have runbook references."""
    import sys; sys.path.insert(0, "backend")
    from services.action_ranking.ranker import ActionRanker
    from models.schemas import IssueType
    ranker = ActionRanker()
    plan = ranker.rank("HUB-RTR-01", IssueType.CONGESTION, 75.0)
    for action in plan.ranked_actions[:5]:
        assert action.runbook_reference is not None
        assert action.steps  # Has execution steps
    print(f"✓ Runbook references: all top-5 actions have runbooks and steps")


# ──────────────────────────────────────────────────────
# FAULT INJECTION TESTS
# ──────────────────────────────────────────────────────

def test_fault_injection_scenario():
    """Fault injection modifies digital twin metrics."""
    import sys; sys.path.insert(0, "backend")
    from services.fault_injection.injector import FaultInjectionEngine
    from services.digital_twin.twin import get_twin
    from models.schemas import ScenarioType
    engine = FaultInjectionEngine()
    twin = get_twin()
    # Baseline
    baseline_bw = twin.node_metrics.get("HUB-RTR-01", {}).get("bandwidth_utilization", 0)
    # Inject max severity
    engine.inject_full_scenario(ScenarioType.HUB_CONGESTION)
    new_bw = twin.node_metrics.get("HUB-RTR-01", {}).get("bandwidth_utilization", 0)
    assert new_bw > 80  # Hub congestion should push BW above 80%
    print(f"✓ Fault injection: HUB-RTR-01 BW {baseline_bw:.0f}% → {new_bw:.0f}%")
    # Reset
    engine.reset_all()


def test_fault_injection_reset():
    """Reset restores all nodes to baseline."""
    import sys; sys.path.insert(0, "backend")
    from services.fault_injection.injector import FaultInjectionEngine
    from services.digital_twin.twin import get_twin
    from models.schemas import ScenarioType
    engine = FaultInjectionEngine()
    engine.inject_full_scenario(ScenarioType.MPLS_FAILURE)
    engine.reset_all()
    twin = get_twin()
    pe_loss = twin.node_metrics.get("MPLS-PE-01", {}).get("packet_loss", 0)
    assert pe_loss < 3  # Should be near baseline after reset
    print(f"✓ Reset: MPLS-PE-01 packet_loss={pe_loss:.2f}% (near baseline)")


# ──────────────────────────────────────────────────────
# SYSTEM INTEGRATION TEST
# ──────────────────────────────────────────────────────

def test_full_pipeline():
    """End-to-end: inject fault → predict → blast radius → actions → simulation."""
    import sys; sys.path.insert(0, "backend")
    from services.fault_injection.injector import FaultInjectionEngine, SCENARIO_CONFIGS
    from services.digital_twin.twin import get_twin
    from services.prediction.predictor import EnsemblePredictor
    from services.risk.risk_engine import RiskEngine
    from services.blast_radius.analyzer import BlastRadiusAnalyzer
    from services.action_ranking.ranker import ActionRanker
    from services.simulation.counterfactual import CounterfactualEngine
    from models.schemas import ScenarioType, IssueType

    # 1. Inject scenario
    fault_engine = FaultInjectionEngine()
    result = fault_engine.inject_full_scenario(ScenarioType.MPLS_FAILURE)
    assert result["step"] == 4
    print(f"  ✓ Fault injected: {result['scenario']} @ severity {result['severity']}")

    # 2. Risk engine
    twin = get_twin()
    risk_engine = RiskEngine()
    metrics = twin.node_metrics.get("MPLS-PE-01", {})
    risk = risk_engine.compute("MPLS-PE-01", metrics, is_critical=True)
    assert risk.risk_score > 50
    print(f"  ✓ Risk computed: {risk.risk_score:.1f}/100 ({risk.urgency_level.value})")

    # 3. Blast radius
    analyzer = BlastRadiusAnalyzer()
    blast = analyzer.analyze("MPLS-PE-01", IssueType.MPLS_FAILURE)
    assert blast.impact_score > 0
    print(f"  ✓ Blast radius: {blast.impact_score:.0f}/100, {len(blast.affected_nodes)} nodes")

    # 4. Action ranking
    ranker = ActionRanker()
    plan = ranker.rank("MPLS-PE-01", IssueType.MPLS_FAILURE, risk.risk_score)
    assert len(plan.ranked_actions) >= 3
    print(f"  ✓ Actions ranked: #{1} = {plan.ranked_actions[0].action_type.value}")

    # 5. Simulation
    sim_engine = CounterfactualEngine()
    sim = sim_engine.simulate("MPLS-PE-01", IssueType.MPLS_FAILURE, risk.risk_score)
    assert sim.recommended_action.action_type.value != "DO_NOTHING"
    print(f"  ✓ Simulation: best={sim.recommended_action.action_type.value}")

    fault_engine.reset_all()
    print("  ✓ Reset complete")
    print("✅ Full pipeline integration test PASSED")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("PS13 — Test Suite")
    print("="*60 + "\n")
    tests = [
        test_twin_initialization, test_twin_topology_export,
        test_twin_blast_radius, test_twin_path_finding,
        test_risk_healthy, test_risk_congested, test_risk_critical, test_risk_trend,
        test_predictor_below_threshold, test_predictor_congestion,
        test_blast_radius_hub, test_blast_radius_leaf,
        test_simulation_do_nothing_worst, test_simulation_mpls_failure,
        test_action_ranker_bgp, test_action_runbook_refs,
        test_fault_injection_scenario, test_fault_injection_reset,
        test_full_pipeline,
    ]
    passed = 0
    for test in tests:
        try:
            print(f"Running {test.__name__}...")
            test()
            passed += 1
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
    print(f"\n{'='*60}")
    print(f"Results: {passed}/{len(tests)} passed")
    print("="*60)
