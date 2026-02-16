"""Nexus PM — Connection Vault routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

import redis_client
from config import settings

router = APIRouter(prefix="/api/connections", tags=["connections"])


class CreateConnectionRequest(BaseModel):
    project_id: str
    name: str
    token: str
    webhook: Optional[str] = None
    icon: str = "key"
    color: str = "#00F0FF"


@router.get("/{project_id}")
async def list_connections(project_id: str):
    return redis_client.list_connections(project_id)


@router.post("")
async def create_connection(req: CreateConnectionRequest):
    conn = redis_client.store_connection(req.project_id, {
        "name": req.name,
        "token": req.token,
        "webhook": req.webhook,
        "icon": req.icon,
        "color": req.color,
        "status": "disconnected",
        "lastSync": "never",
    })
    return conn


@router.post("/{project_id}/{conn_id}/test")
async def test_connection(project_id: str, conn_id: str):
    """Test a connection by attempting to reach the service API."""
    conn = redis_client.get_connection(project_id, conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    name = conn.get("name", "").lower()
    token = conn.get("token", "")
    status = "error"
    message = "Unknown service"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if "slack" in name:
                resp = await client.get(
                    "https://slack.com/api/auth.test",
                    headers={"Authorization": f"Bearer {token}"},
                )
                data = resp.json()
                if data.get("ok"):
                    status = "connected"
                    message = f"Connected as {data.get('user', 'bot')}"
                else:
                    message = data.get("error", "Auth failed")

            elif "figma" in name:
                resp = await client.get(
                    "https://api.figma.com/v1/me",
                    headers={"X-FIGMA-TOKEN": token},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    status = "connected"
                    message = f"Connected as {data.get('email', 'user')}"
                else:
                    message = f"HTTP {resp.status_code}"

            elif "jira" in name:
                domain = settings.JIRA_DOMAIN or "your-domain.atlassian.net"
                resp = await client.get(
                    f"https://{domain}/rest/api/3/myself",
                    auth=(settings.JIRA_EMAIL or "user", token),
                )
                if resp.status_code == 200:
                    status = "connected"
                    message = "Authenticated"
                else:
                    message = f"HTTP {resp.status_code}"
            else:
                # Generic connection: just mark as connected
                status = "connected"
                message = "Token stored successfully"

    except httpx.TimeoutException:
        message = "Connection timed out"
    except Exception as e:
        message = str(e)[:100]

    # Update connection status in store
    redis_client.store_connection(project_id, {
        **conn,
        "status": status,
        "lastSync": "just now" if status == "connected" else conn.get("lastSync", "never"),
    })

    return {"status": status, "message": message}


@router.delete("/{project_id}/{conn_id}")
async def delete_connection(project_id: str, conn_id: str):
    if not redis_client.delete_connection(project_id, conn_id):
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"ok": True}


class UpdateConnectionRequest(BaseModel):
    name: Optional[str] = None
    token: Optional[str] = None
    webhook: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


@router.put("/{project_id}/{conn_id}")
async def update_connection(project_id: str, conn_id: str, req: UpdateConnectionRequest):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    conn = redis_client.update_connection(project_id, conn_id, updates)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn
