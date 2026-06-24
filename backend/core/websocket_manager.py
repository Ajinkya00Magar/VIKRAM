"""
PS13 — WebSocket Manager
Real-time broadcast of risk updates, predictions, alerts, topology changes.
"""
import asyncio
import json
from datetime import datetime
from typing import Set, Dict, Any, Optional
from fastapi import WebSocket
import structlog

logger = structlog.get_logger(__name__)


class ConnectionManager:
    """Manages all active WebSocket connections and broadcasts events."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info("WebSocket connected", total=len(self.active_connections))

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info("WebSocket disconnected", total=len(self.active_connections))

    async def broadcast(self, event_type: str, payload: Dict[str, Any]):
        """Broadcast an event to all connected clients."""
        message = json.dumps({
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat(),
        }, default=str)

        dead: Set[WebSocket] = set()
        async with self._lock:
            connections = set(self.active_connections)

        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)

        if dead:
            async with self._lock:
                self.active_connections -= dead

    async def send_personal(self, websocket: WebSocket,
                            event_type: str, payload: Dict[str, Any]):
        """Send a message to a single client."""
        message = json.dumps({
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat(),
        }, default=str)
        await websocket.send_text(message)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Singleton
manager = ConnectionManager()


async def broadcast_risk_update(risk_summary: Dict):
    await manager.broadcast("risk_update", risk_summary)


async def broadcast_prediction(prediction: Dict):
    await manager.broadcast("prediction", prediction)


async def broadcast_alert(alert: Dict):
    await manager.broadcast("alert", alert)


async def broadcast_topology_change(topology: Dict):
    await manager.broadcast("topology_change", topology)


async def broadcast_scenario_update(scenario: Dict):
    await manager.broadcast("scenario_update", scenario)
