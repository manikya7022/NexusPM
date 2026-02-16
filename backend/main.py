"""Nexus PM — FastAPI Backend Server.

Run with: uvicorn main:app --reload --port 8000
"""
import asyncio
import json
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
import redis_client
from ws_manager import manager

# Import route modules
from routes import router as projects_router
from routes.connections import router as connections_router
from routes.agents import router as agents_router
from routes.services import router as services_router

# Import orchestrator
from agents.orchestrator import run_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Nexus PM Backend starting...")
    redis_client.seed_defaults()
    print("✅ Backend ready")
    print(f"📡 WebSocket available at ws://localhost:{settings.BACKEND_PORT}/ws/{{project_id}}")
    print(f"📋 API docs at http://localhost:{settings.BACKEND_PORT}/docs")
    yield


app = FastAPI(
    title="Nexus PM",
    description="Multi-Project Command Center for Product Managers",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects_router)
app.include_router(connections_router)
app.include_router(agents_router)
app.include_router(services_router)


# ---- Health Check ----

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().astimezone().isoformat(),
        "services": settings.get_service_status(),
        "version": "1.0.0",
    }




# ---- WebSocket ----

@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "data": {"project_id": project_id, "timestamp": datetime.now().astimezone().isoformat()},
        })
        # Keep connection alive and listen for messages
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "trigger_run":
                # Client requests an agent run
                run_data = redis_client.save_agent_run(project_id, {
                    "name": f"Sync: {msg.get('description', 'Manual')}",
                    "status": "running",
                    "currentStage": "ingest",
                    "sources": msg.get("sources", ["slack", "figma"]),
                    "nodes": [
                        {"id": "n1", "stage": "ingest", "title": "Ingest", "description": "Starting...", "timestamp": "now", "status": "active", "agent": "Curator"},
                        {"id": "n2", "stage": "reason", "title": "Reason", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Synthesizer"},
                        {"id": "n3", "stage": "draft", "title": "Draft", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Scribe"},
                        {"id": "n4", "stage": "human_review", "title": "Human Review", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Operator"},
                        {"id": "n5", "stage": "execute", "title": "Execute", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Operator"},
                    ],
                })
                asyncio.create_task(run_pipeline(project_id, run_data["id"], msg.get("sources")))

            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
    except Exception:
        manager.disconnect(websocket, project_id)


# ---- Trigger run via REST ----

@app.post("/api/run/{project_id}")
async def trigger_run_rest(project_id: str):
    """Trigger a full agent pipeline run via REST."""
    run_data = redis_client.save_agent_run(project_id, {
        "name": "Sync: REST trigger",
        "status": "running",
        "currentStage": "ingest",
        "sources": ["slack", "figma"],
        "nodes": [
            {"id": "n1", "stage": "ingest", "title": "Ingest", "description": "Starting...", "timestamp": "now", "status": "active", "agent": "Curator"},
            {"id": "n2", "stage": "reason", "title": "Reason", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Synthesizer"},
            {"id": "n3", "stage": "draft", "title": "Draft", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Scribe"},
            {"id": "n4", "stage": "human_review", "title": "Human Review", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Operator"},
            {"id": "n5", "stage": "execute", "title": "Execute", "description": "Waiting...", "timestamp": "-", "status": "pending", "agent": "Operator"},
        ],
    })
    asyncio.create_task(run_pipeline(project_id, run_data["id"]))
    return {"run_id": run_data["id"], "status": "started"}





if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
