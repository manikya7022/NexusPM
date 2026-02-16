"""Nexus PM — Slack ingestion agent."""
import httpx
from config import settings
import redis_client


async def fetch_slack_messages(channel: str = "general", limit: int = 50, project_id: str = None) -> list[dict]:
    """Fetch messages from a Slack channel and store in Redis."""
    if not settings.slack_available:
        return _mock_slack_messages()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://slack.com/api/conversations.history",
                headers={"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"},
                params={"channel": channel, "limit": limit},
            )
            data = resp.json()
            if data.get("ok"):
                messages = [
                    {"text": msg.get("text", ""), "user": msg.get("user", "unknown"), "ts": msg.get("ts", "")}
                    for msg in data.get("messages", [])
                ]
                
                # Store in Redis if project_id provided
                if project_id:
                    result = redis_client.save_slack_messages(project_id, messages)
                    print(f"💾 Stored {result['new']} new Slack messages (total: {result['total']})")
                
                return messages
    except Exception as e:
        print(f"⚠️ Slack fetch error: {e}")
    return _mock_slack_messages()


async def fetch_slack_messages_with_context(project_id: str, channel: str = "general") -> dict:
    """Fetch Slack messages with Redis context - old messages as summary, latest as actions."""
    # First, fetch new messages from Slack API
    new_messages = await fetch_slack_messages(channel, limit=50, project_id=project_id)
    
    # Get the last processed timestamp
    last_processed_ts = redis_client.get_last_processed_timestamp(project_id)
    
    # Get summary of all historical messages
    summary = redis_client.get_slack_message_summary(project_id)
    
    # Get latest messages for action processing (since last run or most recent)
    latest_messages = redis_client.get_latest_slack_messages(
        project_id, 
        since_ts=last_processed_ts, 
        limit=20
    )
    
    # Update last processed timestamp to now
    if new_messages:
        newest_ts = max(m.get('ts', '0') for m in new_messages)
        redis_client.set_last_processed_timestamp(project_id, newest_ts)
    
    return {
        "summary": summary,  # Historical context (old messages)
        "latest": latest_messages,  # New messages requiring action
        "all": new_messages,  # All fetched messages
        "is_fresh": last_processed_ts is None  # True if first run
    }


async def fetch_slack_channels() -> list[dict]:
    """List available Slack channels."""
    if not settings.slack_available:
        return [{"id": "C001", "name": "design-team"}, {"id": "C002", "name": "mobile-dev"}]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://slack.com/api/conversations.list",
                headers={"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"},
                params={"types": "public_channel,private_channel", "limit": 20},
            )
            data = resp.json()
            if data.get("ok"):
                return [{"id": ch["id"], "name": ch["name"]} for ch in data.get("channels", [])]
    except Exception:
        pass
    return [{"id": "C001", "name": "design-team"}, {"id": "C002", "name": "mobile-dev"}]


def _mock_slack_messages() -> list[dict]:
    return [
        {"text": "The login flow needs OAuth + MFA support", "user": "sarah", "ts": "1700000001"},
        {"text": "We should update the nav component per the new Figma designs", "user": "mike", "ts": "1700000002"},
        {"text": "Can someone create Jira tickets for the checkout redesign?", "user": "alex", "ts": "1700000003"},
        {"text": "I've updated the Figma frames for the mobile nav", "user": "jordan", "ts": "1700000004"},
        {"text": "Priority should be High for the API integration task", "user": "sarah", "ts": "1700000005"},
    ]
