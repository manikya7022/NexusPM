"""Nexus PM — Slack ingestion agent."""
import httpx
from typing import Optional
from config import settings


async def fetch_slack_messages(channel: str = "general", limit: int = 50) -> list[dict]:
    """Fetch messages from a Slack channel."""
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
                return [
                    {
                        "text": msg.get("text", ""),
                        "user": msg.get("user", "unknown"),
                        "ts": msg.get("ts", ""),
                        "thread_ts": msg.get("thread_ts"),
                    }
                    for msg in data.get("messages", [])
                ]
            return _mock_slack_messages()
    except Exception:
        return _mock_slack_messages()


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
                return [
                    {"id": ch["id"], "name": ch["name"]}
                    for ch in data.get("channels", [])
                ]
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
