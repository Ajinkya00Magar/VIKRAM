# RB-NET-002: IPSec/GRE Tunnel Reset Procedure

**Version**: 1.6 | **Applies To**: All IPSec/GRE tunnels | **Escalation**: NOC L2

## Trigger Conditions
- Tunnel uptime < 90% over 15-minute window
- IPSec SA renegotiation loops (>3 per minute in syslog)
- PS13 prediction: TUNNEL_DEGRADATION with confidence > 70%
- Router log: `%CRYPTO-4-RECVD_PKT_INV_SPI`

## Diagnosis
```
show crypto isakmp sa
show crypto ipsec sa
show interface tunnel <id> | include uptime|errors|drops
ping <remote-ip> source <local-interface> repeat 100 size 1400
```

## Procedure
```
! Step 1: Clear existing SA
clear crypto session remote <peer-ip>
! Step 2: Force renegotiation
debug crypto isakmp
! Step 3: Wait 30s, verify new SA
show crypto isakmp sa
undebug all
! Step 4: Verify traffic
ping <remote-ip> source <local-interface>
```

## Notes
- Expect 30-60s service interruption during SA renegotiation
- If WAN link errors > 0.1%: escalate to ISP for physical layer investigation
- Certificate expiry is common root cause — check: `show crypto pki certificates`

---

# RB-NET-004: QoS Rate Limiting Application

**Version**: 1.3 | **Applies To**: WAN interfaces | **Escalation**: NOC L1

## Trigger Conditions
- Bandwidth utilization > 80% for > 3 minutes
- PS13 prediction: CONGESTION with confidence > 60%
- QoS drop rate increasing on voice/ERP class

## Procedure
```
! Identify top talkers
show ip cache flow | sort bytes | head 20

! Apply rate limit
policy-map BURST-CONTROL
  class class-default
    police rate 800m bps
      conform-action transmit
      exceed-action drop

interface GigabitEthernet0/0/0
  service-policy input BURST-CONTROL
```

## Rollback
```
interface GigabitEthernet0/0/0
  no service-policy input BURST-CONTROL
```

---

# RB-NET-005: Primary-to-Backup Failover

**Version**: 2.0 | **Applies To**: Dual-homed sites | **Escalation**: NOC L2

## Trigger Conditions
- Primary path packet loss > 5%
- Primary path down > 60 seconds
- PS13 prediction: MPLS_FAILURE or TUNNEL_DEGRADATION (critical)

## Pre-Check
```
show ip route backup
show track 1    ! Verify IP SLA tracking
ping <backup-gw> source <local-interface>
```

## Procedure
```
! Force failover via IP SLA / static route admin distance
ip route 0.0.0.0 0.0.0.0 <backup-gw> 10    ! Lower AD = preferred
! Verify switchover
show ip route 0.0.0.0
traceroute 8.8.8.8 source <LAN-interface>
```

## Rollback (restore primary)
```
no ip route 0.0.0.0 0.0.0.0 <backup-gw> 10
```

## Notes
- Backup path typically has 50% lower bandwidth capacity — monitor utilization
- Alert service desk before failover if > 100 users affected
- Log failover in ITSM: <<ITSM_TICKET_REQUIRED>>

---

# RB-NET-006: MPLS LSP Reset Procedure

**Version**: 1.8 | **Applies To**: MPLS PE and P routers | **Escalation**: Network Architect

## Trigger Conditions
- MPLS label forwarding table empty or corrupt
- LDP session down between PE routers
- PS13 prediction: MPLS_FAILURE with confidence > 75%
- Syslog: `%LDP-5-NBRCHG: LDP Neighbor X.X.X.X:0 is DOWN`

## Diagnosis
```
show mpls ldp bindings | count
show mpls ldp neighbor
show mpls forwarding-table
show mpls ldp discovery
```

## Procedure
```
! Step 1: Clear LDP session (causes 10-30s reconvergence)
clear mpls ldp neighbor <peer-ip>
! Step 2: Monitor LDP re-establishment
show mpls ldp neighbor
! Step 3: Verify LSP
ping mpls ipv4 <destination-prefix>/32 repeat 50
! Step 4: Verify forwarding
show mpls forwarding-table <destination>
traceroute mpls ipv4 <destination-prefix>/32
```

## If FIB Table Exhaustion
```
! Check table size
show platform hardware fed switch 1 fwd-asic resource utilization
! Apply route summarization to reduce entries
router ospf 1
  summary-address <prefix> <mask>
```

## Notes
- LSP reset causes 15-30s packet blackhole — coordinate with service desk
- FIB exhaustion root cause: filter leaked BGP routes from MPLS table

---

# RB-NET-007: QoS Priority Escalation

**Version**: 1.2 | **Applies To**: WAN QoS policy | **Escalation**: NOC L1

## Trigger Conditions
- VoIP MOS score < 3.5
- PS13 prediction: POLICY_DRIFT
- Jitter > 30ms or packet loss > 1% on voice traffic

## Procedure
```
! Verify current DSCP marking
show policy-map interface <WAN-if> | include VOIP|dscp|EF

! Escalate VoIP to Expedited Forwarding (DSCP 46)
policy-map WAN-QOS
  class VOICE-CLASS
    priority percent 30      ! Strict priority queue
    set dscp ef              ! Mark EF (DSCP 46)

! Apply to all WAN interfaces
interface GigabitEthernet0/0/0
  service-policy output WAN-QOS
```

## Verify
```
show policy-map interface GigabitEthernet0/0/0 output
! Confirm: VOICE-CLASS packets incrementing in priority queue
```

---

# RB-NET-008: Routing Preference Modification

**Version**: 1.1 | **Applies To**: OSPF/BGP routers | **Escalation**: NOC L2

## Trigger Conditions
- Route flapping > 5 times in 10 minutes
- PS13 prediction: ROUTE_INSTABILITY
- OSPF adjacency drops on specific interface

## OSPF Cost Adjustment (prefer stable path)
```
! Increase cost on unstable path
interface GigabitEthernet0/0/1
  ip ospf cost 1000    ! Default is 1, higher = less preferred

! Verify route uses stable path
show ip route <destination>
traceroute <destination>
```

## BGP Local Preference (prefer stable upstream)
```
route-map PREFER_STABLE permit 10
  match ip address prefix-list STABLE-ROUTES
  set local-preference 200

router bgp 65000
  neighbor <stable-peer-ip> route-map PREFER_STABLE in
  clear ip bgp <stable-peer-ip> soft in
```

## Rollback
```
interface GigabitEthernet0/0/1
  no ip ospf cost    ! Restore default
```

## Notes
- Route preference change affects ALL traffic on that path
- Verify with extended traceroute before and after
- Schedule root cause analysis on unstable interface
