# RB-NET-003: BGP Session Clear & Reconvergence

**Version**: 1.4  
**Applies To**: All BGP-enabled routers  
**Escalation**: NOC L2 / Network Architect  

## Trigger Conditions

- BGP peer state cycling between Established and Active
- BGP prefix count drops > 20% in < 5 minutes
- PS13 prediction: BGP_FLAP with confidence > 65%
- Router log: `%BGP-5-ADJCHANGE: neighbor X.X.X.X Down`

## Risk Assessment

- **HIGH RISK**: Full BGP clear causes route table withdrawal (~60s blackhole)
- **LOW RISK**: Soft clear (preferred) — graceful route refresh, no disruption

## Pre-Checks

```
show bgp summary
show bgp neighbors <peer-ip>
show bgp neighbors <peer-ip> | include BGP state|Keepalive|Hold
ping <peer-ip> repeat 100
```

## Procedure

### Step 1 — Attempt Soft Clear (preferred, non-disruptive)
```
clear ip bgp <peer-ip> soft
```
Monitor for 60 seconds. If peer re-establishes, proceed to verification.

### Step 2 — If Soft Clear Fails: Hard Clear
```
! WARNING: Causes 30-90 second route blackhole
clear ip bgp <peer-ip>
```

### Step 3 — Monitor Reconvergence
```
show bgp summary
! Wait for state = Established
! Verify prefix count recovers to baseline (~10,000 prefixes)
debug ip bgp <peer-ip> events    ! Only in maintenance window
undebug all
```

### Step 4 — Verify Internet Reachability
```
ping 8.8.8.8 repeat 50 source <WAN-interface>
traceroute 8.8.8.8 source <WAN-interface>
```

### Step 5 — Check BGP Timers (if flapping persists)
```
router bgp 65000
  neighbor <peer-ip> timers 10 30    ! Reduce keepalive/hold timers
```

## Root Cause Investigation

After stabilization:
1. Check ISP NOC for upstream events
2. Review interface error counters on WAN link
3. Check CPU/memory on BGP router during flap
4. Review BGP logs: `show logging | include BGP`

## Escalation

If peer remains down after 2 clear attempts:
1. Contact ISP NOC: <<ISP_NOC_CONTACT_REQUIRED>>
2. Engage Network Architect
3. Consider failover to backup ISP (RB-NET-005)

## Notes

- BGP hold timer violation (default 90s) is common symptom of upstream congestion
- Document flap timestamps for SLA reporting
- PS13 runbook reference: RB-NET-003
