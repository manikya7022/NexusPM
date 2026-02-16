"""Nexus PM — Redis client utility for Upstash or local Redis."""
import json
import uuid
from datetime import datetime
from typing import Any, Optional

from config import settings

# In-memory fallback store for when Redis is not available
_memory_store: dict[str, Any] = {}

_redis_client = None


def _get_redis():
    """Lazily initialize Redis client."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not settings.redis_available:
        return None
    try:
        import redis as redis_lib
        _redis_client = redis_lib.from_url(
            settings.UPSTASH_REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        _redis_client.ping()
        print("✅ Redis connected successfully")
        return _redis_client
    except Exception as e:
        print(f"⚠️  Redis connection failed ({e}), using in-memory store")
        return None


def _get(key: str) -> Optional[str]:
    r = _get_redis()
    if r:
        return r.get(key)
    return _memory_store.get(key)


def _set(key: str, value: str, ex: Optional[int] = None):
    r = _get_redis()
    if r:
        r.set(key, value, ex=ex)
    else:
        _memory_store[key] = value


def _delete(key: str):
    r = _get_redis()
    if r:
        r.delete(key)
    else:
        _memory_store.pop(key, None)


def _keys(pattern: str) -> list[str]:
    r = _get_redis()
    if r:
        return r.keys(pattern)
    import fnmatch
    return [k for k in _memory_store if fnmatch.fnmatch(k, pattern)]


# -------- Project operations --------

def create_project(name: str, description: str = "") -> dict:
    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "name": name,
        "description": description,
        "status": "active",
        "agentCount": 0,
        "memberCount": 1,
        "lastActivity": datetime.utcnow().isoformat(),
        "syncCount": 0,
        "health": 100,
        "color": "#00F0FF",
        "createdAt": datetime.utcnow().isoformat(),
    }
    _set(f"project:{project_id}", json.dumps(project))
    # Auto-seed connections for new projects
    seed_project_connections(project_id)
    return project


def get_project(project_id: str) -> Optional[dict]:
    data = _get(f"project:{project_id}")
    return json.loads(data) if data else None


def list_projects() -> list[dict]:
    keys = _keys("project:*")
    projects = []
    for key in keys:
        data = _get(key)
        if data:
            projects.append(json.loads(data))
    return sorted(projects, key=lambda p: p.get("createdAt", ""), reverse=True)


def update_project(project_id: str, updates: dict) -> Optional[dict]:
    project = get_project(project_id)
    if not project:
        return None
    project.update(updates)
    project["lastActivity"] = datetime.utcnow().isoformat()
    _set(f"project:{project_id}", json.dumps(project))
    return project


def delete_project(project_id: str) -> bool:
    if get_project(project_id):
        _delete(f"project:{project_id}")
        return True
    return False


# -------- Connection Vault operations --------

def store_connection(project_id: str, connection: dict) -> dict:
    conn_id = connection.get("id") or str(uuid.uuid4())[:8]
    connection["id"] = conn_id
    connection["createdAt"] = datetime.utcnow().isoformat()
    # In production, encrypt tokens with Fernet before storing
    _set(f"conn:{project_id}:{conn_id}", json.dumps(connection))
    return connection


def list_connections(project_id: str) -> list[dict]:
    keys = _keys(f"conn:{project_id}:*")
    connections = []
    for key in keys:
        data = _get(key)
        if data:
            conn = json.loads(data)
            # Mask token for frontend
            if "token" in conn:
                token = conn["token"]
                conn["tokenPreview"] = (
                    token[:4] + "••••••••••••••••" if len(token) > 4 else "••••••••"
                )
            connections.append(conn)
    return connections


def update_connection(project_id: str, conn_id: str, updates: dict) -> Optional[dict]:
    conn = get_connection(project_id, conn_id)
    if not conn:
        return None
    
    # Update fields
    conn.update(updates)
    
    # Re-evaluate status if token provided
    if "token" in updates:
        conn["status"] = "connected" if updates["token"] else "disconnected"
        conn["lastSync"] = "just now"
        
        # Mask token for preview
        token = updates["token"]
        conn["tokenPreview"] = (
            token[:4] + "••••••••••••••••" if len(token) > 4 else "••••••••"
        )

    _set(f"conn:{project_id}:{conn_id}", json.dumps(conn))
    return conn


def get_connection(project_id: str, conn_id: str) -> Optional[dict]:
    data = _get(f"conn:{project_id}:{conn_id}")
    return json.loads(data) if data else None


def delete_connection(project_id: str, conn_id: str) -> bool:
    key = f"conn:{project_id}:{conn_id}"
    if _get(key):
        _delete(key)
        return True
    return False


# -------- Agent Run operations --------

def save_agent_run(project_id: str, run_data: dict) -> dict:
    run_id = run_data.get("id") or str(uuid.uuid4())[:8]
    run_data["id"] = run_id
    run_data["project_id"] = project_id
    run_data["createdAt"] = datetime.utcnow().isoformat()
    _set(f"run:{project_id}:{run_id}", json.dumps(run_data))
    return run_data


def get_agent_run(project_id: str, run_id: str) -> Optional[dict]:
    data = _get(f"run:{project_id}:{run_id}")
    return json.loads(data) if data else None


def list_agent_runs(project_id: str) -> list[dict]:
    keys = _keys(f"run:{project_id}:*")
    runs = []
    for key in keys:
        data = _get(key)
        if data:
            runs.append(json.loads(data))
    return sorted(runs, key=lambda r: r.get("createdAt", ""), reverse=True)


def update_agent_run(project_id: str, run_id: str, updates: dict) -> Optional[dict]:
    run = get_agent_run(project_id, run_id)
    if not run:
        return None
    run.update(updates)
    _set(f"run:{project_id}:{run_id}", json.dumps(run))
    return run


# -------- Agent State (session persistence) --------

def save_agent_state(project_id: str, state: dict):
    _set(f"agent_state:{project_id}", json.dumps(state), ex=86400)  # 24h TTL


def get_agent_state(project_id: str) -> Optional[dict]:
    data = _get(f"agent_state:{project_id}")
    return json.loads(data) if data else None


# -------- Slack Messages Storage --------

def save_slack_messages(project_id: str, messages: list[dict]):
    """Store Slack messages with timestamp for historical tracking."""
    # Get existing messages
    existing = get_slack_messages(project_id)
    
    # Create a set of existing message timestamps to avoid duplicates
    existing_ts = {m.get('ts') for m in existing}
    
    # Add only new messages
    new_messages = [m for m in messages if m.get('ts') not in existing_ts]
    
    # Combine and sort by timestamp
    all_messages = existing + new_messages
    all_messages.sort(key=lambda m: float(m.get('ts', 0)))
    
    # Keep last 500 messages (adjust as needed)
    all_messages = all_messages[-500:]
    
    # Store with 7-day TTL
    _set(f"slack_messages:{project_id}", json.dumps(all_messages), ex=604800)
    
    return {
        "total": len(all_messages),
        "new": len(new_messages),
        "messages": all_messages
    }


def get_slack_messages(project_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    """Retrieve stored Slack messages."""
    data = _get(f"slack_messages:{project_id}")
    if not data:
        return []
    messages = json.loads(data)
    # Return most recent messages first
    messages.reverse()
    return messages[offset:offset + limit]


def get_slack_message_summary(project_id: str) -> dict:
    """Get summary of stored messages for context."""
    messages = get_slack_messages(project_id, limit=500)
    
    if not messages:
        return {"count": 0, "oldest": None, "newest": None, "topics": []}
    
    # Extract topics/keywords from messages
    all_text = ' '.join([m.get('text', '').lower() for m in messages])
    keywords = ['oauth', 'pkce', 'mfa', 'auth', 'login', 'jira', 'figma', 'design', 
                'blocker', 'issue', 'bug', 'feature', 'implement', 'refactor']
    found_topics = [kw for kw in keywords if kw in all_text]
    
    return {
        "count": len(messages),
        "oldest": messages[-1].get('ts') if messages else None,
        "newest": messages[0].get('ts') if messages else None,
        "topics": list(set(found_topics)),
        "unique_users": list(set(m.get('user') for m in messages if m.get('user')))
    }


def get_latest_slack_messages(project_id: str, since_ts: str = None, limit: int = 20) -> list[dict]:
    """Get latest messages for action processing.
    
    If since_ts is provided, returns messages newer than that timestamp.
    Otherwise returns the most recent messages.
    """
    messages = get_slack_messages(project_id, limit=500)
    
    if since_ts:
        # Filter messages newer than since_ts
        since_float = float(since_ts)
        new_messages = [m for m in messages if float(m.get('ts', 0)) > since_float]
        return new_messages[:limit]
    
    return messages[:limit]


def get_last_processed_timestamp(project_id: str) -> Optional[str]:
    """Get the timestamp of the last processed message."""
    data = _get(f"slack_last_processed:{project_id}")
    return data


def set_last_processed_timestamp(project_id: str, timestamp: str):
    """Set the timestamp of the last processed message."""
    _set(f"slack_last_processed:{project_id}", timestamp, ex=604800)  # 7 days TTL


# -------- Telemetry Log operations --------

def append_telemetry_log(project_id: str, run_id: str, entry: dict):
    """Append a timestamped log entry to a run's telemetry."""
    import json as _json
    entry["timestamp"] = datetime.utcnow().isoformat()
    r = _get_redis()
    key = f"telemetry:{project_id}:{run_id}"
    value = _json.dumps(entry)
    if r:
        r.rpush(key, value)
        r.expire(key, 604800)  # 7-day TTL
    else:
        existing = _memory_store.get(key, "[]")
        lst = json.loads(existing) if isinstance(existing, str) else existing
        if not isinstance(lst, list):
            lst = []
        lst.append(entry)
        _memory_store[key] = json.dumps(lst)


def get_telemetry_logs(project_id: str, run_id: str) -> list[dict]:
    """Retrieve all telemetry log entries for a run."""
    r = _get_redis()
    key = f"telemetry:{project_id}:{run_id}"
    if r:
        raw_entries = r.lrange(key, 0, -1)
        return [json.loads(e) for e in raw_entries]
    else:
        existing = _memory_store.get(key, "[]")
        return json.loads(existing) if isinstance(existing, str) else []


# -------- Admin: flush all data --------

def flush_all_data():
    """Purge all Nexus PM data from Redis/memory."""
    patterns = [
        "project:*", "conn:*", "run:*", "slack_messages:*",
        "slack_last_processed:*", "agent_state:*", "telemetry:*",
    ]
    total = 0
    r = _get_redis()
    for pat in patterns:
        keys = _keys(pat)
        for key in keys:
            _delete(key)
            total += 1
    print(f"🧹 Flushed {total} keys")
    return total


# -------- Seed default projects --------

def seed_defaults():
    """Seed default projects if none exist."""
    if not list_projects():
        defaults = [
            ("Mobile App v2", "Redesigning the mobile experience with new navigation"),
            ("Enterprise API", "RESTful API for enterprise integrations"),
            ("Design System", "Component library and design tokens"),
            ("Q4 Roadmap", "Strategic planning for Q4 initiatives"),
        ]
        colors = ["#00F0FF", "#2B6FFF", "#B829F7", "#00FFAA"]
        statuses = ["active", "active", "paused", "completed"]
        agents = [4, 3, 2, 0]
        members = [12, 8, 6, 15]
        for i, (name, desc) in enumerate(defaults):
            p = create_project(name, desc)
            update_project(p["id"], {
                "color": colors[i],
                "status": statuses[i],
                "agentCount": agents[i],
                "memberCount": members[i],
                "syncCount": [1247, 856, 432, 2341][i],
                "health": [98, 94, 87, 100][i],
            })
        # Seed connections for ALL projects
        projects = list_projects()
        for p in projects:
            seed_project_connections(p["id"])
        print("✅ Default projects & connections seeded")


def seed_project_connections(project_id: str):
    """Ensure a project has placeholder connections for supported services."""
    existing = list_connections(project_id)
    existing_types = {c.get("icon", "").lower() for c in existing}

    # Define defaults based on .env
    defaults = [
        {
            "name": "Figma",
            "icon": "figma",
            "color": "#00F0FF",
            "token": settings.FIGMA_ACCESS_TOKEN or "",
            "account": "design@company.com" if settings.FIGMA_ACCESS_TOKEN else "",
        },
        {
            "name": "Slack",
            "icon": "slack",
            "color": "#B829F7",
            "token": settings.SLACK_BOT_TOKEN or "",
            "account": "Nexus Bot" if settings.SLACK_BOT_TOKEN else "",
        },
        {
            "name": "Jira",
            "icon": "jira",
            "color": "#2B6FFF",
            "token": settings.JIRA_API_TOKEN or "",
            "account": settings.JIRA_EMAIL or "" if settings.JIRA_API_TOKEN else "",
        }
    ]

    for d in defaults:
        if d["icon"] not in existing_types:
            status = "connected" if d["token"] else "disconnected"
            store_connection(project_id, {
                "name": d["name"],
                "icon": d["icon"],
                "color": d["color"],
                "status": status,
                "lastSync": "just now" if status == "connected" else "never",
                "account": d["account"],
                "token": d["token"],
            })
