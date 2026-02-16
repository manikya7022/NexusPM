"""Nexus PM — Jira integration agent."""
import httpx
from config import settings


async def fetch_jira_issue_detail(issue_key: str) -> dict | None:
    """Fetch full ticket detail for snapshot comparison (Agent B).

    Returns summary, description text, status, priority, labels, assignee.
    Returns None if the issue cannot be fetched.
    """
    if not settings.jira_available:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue/{issue_key}",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
                params={"fields": "summary,description,status,priority,labels,assignee"},
            )
            if resp.status_code == 200:
                data = resp.json()
                fields = data.get("fields", {})
                # Extract plain text from ADF description
                desc_text = ""
                desc = fields.get("description")
                if desc and isinstance(desc, dict):
                    for block in desc.get("content", []):
                        for item in block.get("content", []):
                            if item.get("type") == "text":
                                desc_text += item.get("text", "")
                        desc_text += "\n"
                return {
                    "key": issue_key,
                    "summary": fields.get("summary", ""),
                    "description": desc_text.strip(),
                    "status": fields.get("status", {}).get("name", ""),
                    "priority": fields.get("priority", {}).get("name", ""),
                    "labels": fields.get("labels", []),
                    "assignee": (fields.get("assignee") or {}).get("displayName", "Unassigned"),
                }
    except Exception as e:
        print(f"⚠️ Error fetching issue detail for {issue_key}: {e}")
    return None

async def fetch_jira_issues(project_key: str = "PROJ", max_results: int = 20) -> list[dict]:
    """Fetch issues from a Jira project using the new JQL search API."""
    if not settings.jira_available:
        return _mock_jira_issues()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Use the new search/jql endpoint (POST instead of GET)
            resp = await client.post(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/search/jql",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
                json={
                    "jql": f"project={project_key}",
                    "maxResults": max_results,
                    "fields": ["summary", "status", "priority", "assignee"]
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                issues = data.get("issues", [])
                if issues:
                    return [
                        {
                            "key": issue["key"],
                            "summary": issue["fields"].get("summary", ""),
                            "status": issue["fields"].get("status", {}).get("name", ""),
                            "priority": issue["fields"].get("priority", {}).get("name", ""),
                            "assignee": (issue["fields"].get("assignee") or {}).get("displayName", "Unassigned"),
                        }
                        for issue in issues
                    ]
            else:
                print(f"⚠️ Jira API error: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"⚠️ Jira fetch error: {e}")
    return _mock_jira_issues()


async def create_jira_issue(project_key: str, summary: str, description: str = "",
                             issue_type: str = "Task", priority: str = "Medium") -> dict:
    """Create a new Jira issue."""
    if not settings.jira_available:
        return {"key": f"{project_key}-NEW", "summary": summary, "status": "To Do", "priority": priority}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
                json={
                    "fields": {
                        "project": {"key": project_key},
                        "summary": summary,
                        "description": {"type": "doc", "version": 1, "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": description}]}
                        ]},
                        "issuetype": {"name": issue_type},
                        "priority": {"name": priority},
                    }
                },
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return {"key": data.get("key", ""), "summary": summary, "status": "To Do", "priority": priority}
    except Exception:
        pass
    return {"key": f"{project_key}-NEW", "summary": summary, "status": "To Do", "priority": priority}


async def update_jira_issue(issue_key: str, updates: dict) -> dict:
    """Update an existing Jira issue."""
    if not settings.jira_available:
        return {"key": issue_key, "updated": True, **updates}
    try:
        fields = {}
        if "summary" in updates:
            fields["summary"] = updates["summary"]
        if "priority" in updates:
            fields["priority"] = {"name": updates["priority"]}
        if "description" in updates:
            # Format description as Atlassian Document Format (ADF)
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": updates["description"]}]
                    }
                ]
            }
        if "status" in updates:
            # Status transitions require a different API call - do transition
            await transition_issue_status(issue_key, updates["status"])

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue/{issue_key}",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
                json={"fields": fields},
            )
            return {"key": issue_key, "updated": resp.status_code == 204}
    except Exception as e:
        print(f"⚠️ Error updating issue {issue_key}: {e}")
    return {"key": issue_key, "updated": False}


async def transition_issue_status(issue_key: str, status: str) -> bool:
    """Transition an issue to a new status."""
    if not settings.jira_available:
        return True
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # First get available transitions
            resp = await client.get(
                f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue/{issue_key}/transitions",
                auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
            )
            if resp.status_code == 200:
                data = resp.json()
                transitions = data.get("transitions", [])
                
                # Find matching transition
                target_status = status.lower()
                for t in transitions:
                    if target_status in t.get("name", "").lower():
                        # Perform transition
                        trans_resp = await client.post(
                            f"https://{settings.JIRA_DOMAIN}/rest/api/3/issue/{issue_key}/transitions",
                            auth=(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN),
                            json={"transition": {"id": t["id"]}},
                        )
                        return trans_resp.status_code == 204
    except Exception as e:
        print(f"⚠️ Error transitioning issue {issue_key} to {status}: {e}")
    return False


def _mock_jira_issues() -> list[dict]:
    return [
        {"key": "PROJ-1245", "summary": "API Integration for checkout", "status": "In Progress", "priority": "High", "assignee": "Mike Chen"},
        {"key": "PROJ-1244", "summary": "Implement basic login", "status": "To Do", "priority": "Medium", "assignee": "Sarah Miller"},
        {"key": "PROJ-1243", "summary": "Navigation component updates", "status": "In Review", "priority": "Medium", "assignee": "Jordan Lee"},
        {"key": "PROJ-1242", "summary": "Design system token migration", "status": "Done", "priority": "Low", "assignee": "Alex Chen"},
    ]
