# RB-NET-001: Traffic Rerouting Procedure

**Version**: 2.1  
**Applies To**: All MPLS/SD-WAN routers  
**Escalation**: NOC L2  

## Trigger Conditions

- Hub router bandwidth utilization > 80% for > 5 minutes
- VoIP MOS score degradation detected
- PS13 prediction: CONGESTION with confidence > 70%

## Pre-Checks

1. Verify alternate path availability: `show ip route summary`
2. Check alternate path capacity vs current load
3. Confirm downstream site reachability before reroute

## Procedure

### Step 1 — Identify Congested Interface
```
show interfaces GigabitEthernet0/0/0 | include rate
show policy-map interface GigabitEthernet0/0/0
```

### Step 2 — Identify Alternate Path
```
show ip ospf neighbor
show ip bgp summary
traceroute <destination> source <local-interface>
```

### Step 3 — Modify OSPF Cost (prefer alternate)
```
interface GigabitEthernet0/0/1
  ip ospf cost 10
```

### Step 4 — Or Use BGP Local Preference
```
route-map PREFER_ALTERNATE permit 10
  set local-preference 200
router bgp 65000
  neighbor <peer-ip> route-map PREFER_ALTERNATE in
  clear ip bgp <peer-ip> soft
```

### Step 5 — Monitor Traffic Shift
```
show interfaces GigabitEthernet0/0/0 | include rate
```
Wait 2-3 minutes for OSPF/BGP convergence.

### Step 6 — Verify Resolution
- Utilization on primary path drops below 60%
- VoIP MOS score recovers above 4.0
- No packet loss on alternate path

## Rollback

```
no ip ospf cost   ! Restore default OSPF cost
```

## Notes

- Transient packet loss expected during reroute (~300–800ms)
- Inform service desk before execution if VoIP is impacted
- Document change in ITSM system reference: <<ITSM_TICKET_REQUIRED>>
- Schedule root cause analysis for congestion event within 24h
