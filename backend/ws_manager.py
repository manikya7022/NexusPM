"""Nexus PM — WebSocket connection manager for real-time agent feed."""
import json
import asyncio
from datetime import datetime
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections per project."""

    def __init__(self):
        # project_id -> set of WebSocket connections
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.connections:
            self.connections[project_id] = set()
        self.connections[project_id].add(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.connections:
            self.connections[project_id].discard(websocket)
            if not self.connections[project_id]:
                del self.connections[project_id]

    async def broadcast(self, project_id: str, message: dict):
        """Broadcast a message to all clients connected to a project."""
        if project_id not in self.connections:
            return
        dead = set()
        for ws in self.connections[project_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[project_id].discard(ws)

    async def broadcast_pulse(
        self,
        project_id: str,
        agent: str,
        action: str,
        target: str,
        source: str = "system",
        status: str = "completed",
        details: str | None = None,
    ):
        """Send a structured agent pulse event."""
        pulse = {
            "type": "agent_pulse",
            "data": {
                "id": f"pulse-{datetime.now().timestamp()}",
                "timestamp": datetime.now().astimezone().isoformat(),  # Use local time with timezone info
                "agent": agent,
                "action": action,
                "target": target,
                "source": source,
                "status": status,
                "details": details,
            },
        }
        await self.broadcast(project_id, pulse)

    async def broadcast_health(self, project_id: str, connections_status: list[dict]):
        """Send connection health update."""
        await self.broadcast(project_id, {
            "type": "health_update",
            "data": connections_status,
        })

    async def broadcast_telemetry(
        self,
        project_id: str,
        run_id: str,
        stage: str,
        message: str,
        level: str = "info",
    ):
        """Send a structured telemetry log event over WebSocket."""
        await self.broadcast(project_id, {
            "type": "telemetry_log",
            "data": {
                "run_id": run_id,
                "stage": stage,
                "message": message,
                "level": level,
                "timestamp": datetime.now().astimezone().isoformat(),
            },
        })


manager = ConnectionManager()
