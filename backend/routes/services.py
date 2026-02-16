"""Nexus PM — Service status & activity routes (real-time pings)."""
import time
from datetime import datetime

import httpx
from fastapi import APIRouter

from config import settings
import redis_client
from agents.slack_agent import fetch_slack_messages

router = APIRouter(prefix="/api/services", tags=["services"])


async def _ping_slack() -> dict:
    """Ping Slack API and return status + latency."""
    if not settings.slack_available:
        return {"status": "disconnected", "health": 0, "latency": 0, "lastSync": "never"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            t0 = time.monotonic()
            resp = await client.get(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"},
            )
            latency_ms = int((time.monotonic() - t0) * 1000)
            data = resp.json()
            if data.get("ok"):
                return {"status": "connected", "health": 100, "latency": latency_ms, "lastSync": "just now"}
            return {"status": "error", "health": 0, "latency": latency_ms, "lastSync": "never"}
    except Exception:
        return {"status": "error", "health": 0, "latency": 0, "lastSync": "never"}


async def _ping_figma() -> dict:
    """Ping Figma API and return status + latency."""
    if not settings.figma_available:
        return {"status": "disconnected", "health": 0, "latency": 0, "lastSync": "never"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            t0 = time.monotonic()
            resp = await client.get(
                "https://api.figma.com/v1/me",
                headers={"X-FIGMA-TOKEN": settings.FIGMA_ACCESS_TOKEN},
            )
            latency_ms = int((time.monotonic() - t0) * 1000)
            if resp.status_code == 200:
                return {"status": "connected", "health": 100, "latency": latency_ms, "lastSync": "just now"}
            return {"status": "error", "health": 0, "latency": latency_ms, "lastSync": "never"}
    except Exception:
        return {"status": "error", "health": 0, "latency": 0, "lastSync": "never"}


async def _ping_jira() -> dict:
    """Ping Jira API and return status + latency."""
    if not settings.jira_available:
        return {"status": "disconnected", "health": 0, "latency": 0, "lastSync": "never"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            t0 = time.monotonic()
            resp = await client.get(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/myself",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
            )
            latency_ms = int((time.monotonic() - t0) * 1000)
            if resp.status_code == 200:
                return {"status": "connected", "health": 100, "latency": latency_ms, "lastSync": "just now"}
            return {"status": "error", "health": 0, "latency": latency_ms, "lastSync": "never"}
    except Exception:
        return {"status": "error", "health": 0, "latency": 0, "lastSync": "never"}


@router.get("/status")
async def services_status():
    """Real-time service health by pinging each API."""
    import asyncio

    slack_task = asyncio.create_task(_ping_slack())
    figma_task = asyncio.create_task(_ping_figma())
    jira_task = asyncio.create_task(_ping_jira())

    slack, figma, jira = await asyncio.gather(slack_task, figma_task, jira_task)

    return [
        {"id": "figma", "name": "Figma", "icon": "figma", "color": "#00F0FF", **figma},
        {"id": "slack", "name": "Slack", "icon": "slack", "color": "#B829F7", **slack},
        {"id": "jira", "name": "Jira", "icon": "jira", "color": "#2B6FFF", **jira},
    ]


@router.get("/activity/{project_id}")
async def activity_stats(project_id: str):
    """Return activity stats for a project: event counts per platform + chart data."""
    from datetime import datetime, timedelta
    
    # Count agent runs and their stages
    runs = redis_client.list_agent_runs(project_id)
    
    # Get Slack message summary for real event counts
    slack_summary = redis_client.get_slack_message_summary(project_id)
    
    # Filter runs from last 24 hours
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    
    # Count events by source from run data
    slack_events = 0
    figma_events = 0
    jira_events = 0
    total_syncs = len(runs)
    chart_data = []
    
    # Count events from last 24h only
    slack_events_24h = 0
    figma_events_24h = 0
    jira_events_24h = 0
    
    for run in runs:
        run_created = run.get("createdAt", "")
        is_recent = False
        
        if run_created:
            try:
                run_ts = datetime.fromisoformat(run_created.replace('Z', '+00:00').replace('+00:00', ''))
                is_recent = run_ts > last_24h
            except:
                pass
        
        for node in run.get("nodes", []):
            desc = node.get("description", "").lower()
            if "slack" in desc:
                slack_events += 1
                if is_recent:
                    slack_events_24h += 1
            if "figma" in desc:
                figma_events += 1
                if is_recent:
                    figma_events_24h += 1
            if "jira" in desc or "ticket" in desc:
                jira_events += 1
                if is_recent:
                    jira_events_24h += 1

        # Add chart point for each run (only last 24h for chart)
        if run_created and is_recent:
            try:
                ts = datetime.fromisoformat(run_created.replace('Z', '+00:00').replace('+00:00', ''))
                chart_data.append({
                    "time": ts.strftime("%H:%M"),
                    "events": slack_events_24h + figma_events_24h + jira_events_24h,
                    "syncs": 1,
                })
            except ValueError:
                pass
    
    # If no chart data, generate hourly slots for last 24h
    if not chart_data:
        for i in range(24):
            hour_ts = now - timedelta(hours=23-i)
            chart_data.append({
                "time": hour_ts.strftime("%H:%M"),
                "events": 0,
                "syncs": 0,
            })

    # Calculate trends (compare last 24h vs previous 24h)
    prev_24h = last_24h - timedelta(hours=24)
    slack_prev = sum(1 for r in runs for n in r.get("nodes", []) 
                     if "slack" in n.get("description", "").lower() 
                     and prev_24h < datetime.fromisoformat(r.get("createdAt", "").replace('Z', '+00:00').replace('+00:00', '')) < last_24h) if runs else 0
    
    def calc_trend(current, previous):
        if previous == 0:
            return "up" if current > 0 else "stable"
        change = ((current - previous) / previous) * 100
        if change > 5:
            return "up"
        elif change < -5:
            return "down"
        return "stable"

    return {
        "platforms": [
            {"id": "slack", "name": "Slack", "events": slack_events_24h, "total_events": slack_events, "change": slack_events_24h - slack_prev, "trend": calc_trend(slack_events_24h, slack_prev)},
            {"id": "figma", "name": "Figma", "events": figma_events_24h, "total_events": figma_events, "change": 0, "trend": "stable"},
            {"id": "jira", "name": "Jira", "events": jira_events_24h, "total_events": jira_events, "change": 0, "trend": "stable"},
        ],
        "totalEvents": slack_events_24h + figma_events_24h + jira_events_24h,
        "totalEventsAllTime": slack_events + figma_events + jira_events,
        "totalSyncs": total_syncs,
        "activeAgents": sum(1 for r in runs if r.get("status") == "running"),
        "chartData": chart_data[-24:],  # Last 24 data points
        "timeRange": {
            "from": last_24h.isoformat(),
            "to": now.isoformat(),
        },
        "slackHistory": slack_summary.get("count", 0),
    }


@router.get("/slack/messages/{project_id}")
async def get_slack_messages_endpoint(project_id: str):
    """Fetch Slack messages for a project from Redis (with live fetch)."""
    # First try to get from Redis
    from redis_client import get_slack_messages, save_slack_messages, get_slack_message_summary
    
    cached = get_slack_messages(project_id, limit=100)
    summary = get_slack_message_summary(project_id)
    
    # If no cached messages, fetch from Slack API
    if not cached:
        messages = await fetch_slack_messages(channel=settings.SLACK_CHANNEL_ID, project_id=project_id)
        return {
            "messages": messages,
            "channel": settings.SLACK_CHANNEL_ID,
            "source": "live",
            "total_history": len(messages),
        }
    
    return {
        "messages": cached,
        "channel": settings.SLACK_CHANNEL_ID,
        "source": "redis",
        "total_history": summary.get('count', len(cached)),
        "topics": summary.get('topics', []),
    }
