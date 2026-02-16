"""Nexus PM — Agent run routes."""
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

import redis_client
from ws_manager import manager
from agents.jira_agent import create_jira_issue, update_jira_issue, fetch_jira_issues
from agents.context_fusion import _smart_fusion_from_real_data
from config import settings

router = APIRouter(prefix="/api/agents", tags=["agents"])


class TriggerRunRequest(BaseModel):
    project_id: str
    sources: list[str] = ["slack", "figma"]  # What to ingest
    description: str = ""


class RunActionRequest(BaseModel):
    action: str  # "approve" or "reject"


class DiffActionRequest(BaseModel):
    action: str  # "approve" or "reject"
    diff_id: str  # Which diff to act on


@router.post("/trigger")
async def trigger_run(req: TriggerRunRequest):
    """Trigger a new agent run for a project."""
    run = redis_client.save_agent_run(req.project_id, {
        "name": f"Sync: {req.description or 'Manual trigger'}",
        "status": "running",
        "sources": req.sources,
        "currentStage": "ingest",
        "nodes": [
            {
                "id": "n1",
                "stage": "ingest",
                "title": "Ingest",
                "description": f"Collecting data from {', '.join(req.sources)}...",
                "timestamp": "now",
                "status": "active",
                "agent": "Curator",
            },
            {
                "id": "n2",
                "stage": "reason",
                "title": "Reason",
                "description": "Waiting...",
                "timestamp": "-",
                "status": "pending",
                "agent": "Synthesizer",
            },
            {
                "id": "n3",
                "stage": "draft",
                "title": "Draft",
                "description": "Waiting...",
                "timestamp": "-",
                "status": "pending",
                "agent": "Scribe",
            },
            {
                "id": "n4",
                "stage": "human_review",
                "title": "Human Review",
                "description": "Waiting...",
                "timestamp": "-",
                "status": "pending",
                "agent": "Operator",
            },
            {
                "id": "n5",
                "stage": "execute",
                "title": "Execute",
                "description": "Waiting...",
                "timestamp": "-",
                "status": "pending",
                "agent": "Operator",
            },
        ],
    })

    # Broadcast pulse
    await manager.broadcast_pulse(
        req.project_id,
        agent="Orchestrator",
        action="started new agent run",
        target=run["name"],
        source="system",
        status="processing",
    )

    return run


@router.get("/runs/{project_id}")
async def list_runs(project_id: str):
    return redis_client.list_agent_runs(project_id)


@router.get("/runs/{project_id}/{run_id}")
async def get_run(project_id: str, run_id: str):
    run = redis_client.get_agent_run(project_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs/{project_id}/{run_id}/action")
async def run_action(project_id: str, run_id: str, req: RunActionRequest):
    """Approve or reject a pending agent run."""
    run = redis_client.get_agent_run(project_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if req.action == "approve":
        # Execute the Jira changes
        diffs = run.get("diffs", [])
        executed_changes = []
        failed_changes = []

        for diff in diffs:
            proposal = diff.get("proposal", {})
            proposal_type = proposal.get("type")

            try:
                if proposal_type == "create":
                    # Create new Jira issue
                    result = await create_jira_issue(
                        project_key=settings.JIRA_PROJECT_KEY,
                        summary=proposal.get("title", "New Issue"),
                        description=proposal.get("description", ""),
                        priority=proposal.get("priority", "Medium"),
                        issue_type="Task"
                    )
                    executed_changes.append({
                        "type": "create",
                        "title": proposal.get("title"),
                        "key": result.get("key", "UNKNOWN"),
                        "status": "created"
                    })

                elif proposal_type == "update":
                    # Update existing Jira issue
                    existing_ticket = proposal.get("existingTicket")
                    if existing_ticket:
                        updates = {}
                        for change in proposal.get("changes", []):
                            field = change.get("field", "").lower()
                            if field == "summary":
                                updates["summary"] = change.get("new", "")
                            elif field == "priority":
                                updates["priority"] = change.get("new", "")

                        if updates:
                            result = await update_jira_issue(existing_ticket, updates)
                            executed_changes.append({
                                "type": "update",
                                "title": proposal.get("title"),
                                "key": existing_ticket,
                                "status": "updated" if result.get("updated") else "failed"
                            })

            except Exception as e:
                failed_changes.append({
                    "title": proposal.get("title", "Unknown"),
                    "error": str(e)
                })

        # Update run status
        for node in run.get("nodes", []):
            if node["stage"] == "human_review":
                node["status"] = "completed"
                node["description"] = "Approved by PM"
            if node["stage"] == "execute":
                node["status"] = "completed"
                node["description"] = f"Executed {len(executed_changes)} changes"
        run["status"] = "completed"
        run["currentStage"] = "execute"
        run["executed_changes"] = executed_changes
        run["failed_changes"] = failed_changes

        await manager.broadcast_pulse(
            project_id,
            agent="Operator",
            action=f"approved and executed {len(executed_changes)} Jira changes",
            target=run["name"],
            source="jira",
            status="completed",
            details={"created": len([c for c in executed_changes if c["type"] == "create"]),
                     "updated": len([c for c in executed_changes if c["type"] == "update"]),
                     "failed": len(failed_changes)}
        )

    elif req.action == "reject":
        for node in run.get("nodes", []):
            if node["stage"] == "human_review":
                node["status"] = "error"
                node["description"] = "Rejected by PM"
        run["status"] = "failed"

        await manager.broadcast_pulse(
            project_id,
            agent="Operator",
            action="rejected run",
            target=run["name"],
            source="system",
            status="error",
        )

    redis_client.update_agent_run(project_id, run_id, run)
    return run


async def analyze_and_execute_proposal(project_id: str, proposal: dict) -> dict:
    """Smart agent that analyzes proposal and decides create vs update vs done."""
    proposal_title = proposal.get("title", "").lower()
    proposal_desc = proposal.get("description", "").lower()
    proposal_type = proposal.get("type", "create")
    existing_ticket = proposal.get("existingTicket")
    
    # Fetch current Jira issues to find best match
    jira_issues = await fetch_jira_issues(project_key=settings.JIRA_PROJECT_KEY)
    
    # If proposal has explicit existing ticket, update it
    if existing_ticket and proposal_type == "update":
        updates = {}
        for change in proposal.get("changes", []):
            field = change.get("field", "").lower()
            if field == "summary":
                updates["summary"] = change.get("new", "")
            elif field == "priority":
                updates["priority"] = change.get("new", "")
            elif field == "description":
                updates["description"] = change.get("new", "")
            elif field == "status":
                updates["status"] = change.get("new", "")
        
        if updates:
            result = await update_jira_issue(existing_ticket, updates)
            return {
                "action": "update",
                "key": existing_ticket,
                "title": proposal.get("title"),
                "updates": updates,
                "success": result.get("updated", False)
            }
    
    # Check if this is a "done" type proposal (marking something complete)
    done_keywords = ['done', 'complete', 'finished', 'resolved', 'close']
    if any(kw in proposal_title or kw in proposal_desc for kw in done_keywords):
        # Find matching ticket to mark as done
        for issue in jira_issues:
            issue_summary = issue.get("summary", "").lower()
            # Check if proposal relates to existing ticket
            if any(word in issue_summary for word in proposal_title.split()[:3] if len(word) > 3):
                result = await update_jira_issue(issue["key"], {"status": "Done"})
                return {
                    "action": "mark_done",
                    "key": issue["key"],
                    "title": issue.get("summary"),
                    "success": result.get("updated", False)
                }
    
    # Check for similar existing tickets before creating new
    for issue in jira_issues:
        issue_summary = issue.get("summary", "").lower()
        # Simple similarity check - if significant words match
        title_words = set(proposal_title.split())
        issue_words = set(issue_summary.split())
        common_words = title_words & issue_words
        
        if len(common_words) >= 2:  # If 2+ words match, consider it an update
            updates = {"summary": proposal.get("title", issue.get("summary"))}
            if proposal.get("priority"):
                updates["priority"] = proposal.get("priority")
            # Include description from Slack discussion
            if proposal.get("description"):
                updates["description"] = proposal.get("description")
            
            result = await update_jira_issue(issue["key"], updates)
            return {
                "action": "update",
                "key": issue["key"],
                "title": proposal.get("title"),
                "reason": f"Matched with existing ticket {issue['key']}",
                "success": result.get("updated", False)
            }
    
    # No match found - create new ticket
    result = await create_jira_issue(
        project_key=settings.JIRA_PROJECT_KEY,
        summary=proposal.get("title", "New Issue"),
        description=proposal.get("description", ""),
        priority=proposal.get("priority", "Medium"),
        issue_type="Task"
    )
    return {
        "action": "create",
        "key": result.get("key", "UNKNOWN"),
        "title": proposal.get("title"),
        "success": bool(result.get("key"))
    }


@router.post("/runs/{project_id}/{run_id}/diffs/{diff_id}/action")
async def diff_action(project_id: str, run_id: str, diff_id: str, req: DiffActionRequest):
    """Approve or reject an individual diff/proposal."""
    run = redis_client.get_agent_run(project_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Find the diff
    diffs = run.get("diffs", [])
    diff = None
    for d in diffs:
        if d.get("id") == diff_id:
            diff = d
            break
    
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    
    proposal = diff.get("proposal", {})
    
    if req.action == "approve":
        # Smart analysis: determine create vs update vs done
        result = await analyze_and_execute_proposal(project_id, proposal)
        
        # Update diff status
        diff["status"] = "approved"
        diff["execution_result"] = result
        
        # Broadcast to Context Bridge
        action_text = {
            "create": f"Created new Jira ticket {result['key']}",
            "update": f"Updated Jira ticket {result['key']}",
            "mark_done": f"Marked Jira ticket {result['key']} as Done"
        }.get(result['action'], f"Executed {result['action']}")
        
        await manager.broadcast_pulse(
            project_id,
            agent="Operator",
            action=action_text,
            target=proposal.get("title", "Unknown"),
            source="jira",
            status="completed" if result.get("success") else "error",
            details={
                "ticket_key": result.get("key"),
                "action_type": result.get("action"),
                "proposal_title": proposal.get("title"),
                "diff_id": diff_id
            }
        )
        
    elif req.action == "reject":
        diff["status"] = "rejected"
        
        await manager.broadcast_pulse(
            project_id,
            agent="Operator",
            action="Rejected proposal",
            target=proposal.get("title", "Unknown"),
            source="system",
            status="error",
            details={
                "proposal_title": proposal.get("title"),
                "diff_id": diff_id
            }
        )
    
    # Update run with modified diff
    redis_client.update_agent_run(project_id, run_id, run)
    return {"diff": diff, "run": run}


# ──────────────────────────────────────────────────────────────
#  Telemetry Logs
# ──────────────────────────────────────────────────────────────

@router.get("/runs/{project_id}/{run_id}/logs")
async def get_run_logs(project_id: str, run_id: str):
    """Return all telemetry log entries for a pipeline run."""
    logs = redis_client.get_telemetry_logs(project_id, run_id)
    return {"logs": logs, "count": len(logs)}


# ──────────────────────────────────────────────────────────────
#  Admin Reset
# ──────────────────────────────────────────────────────────────

@router.post("/admin/reset")
async def admin_reset():
    """Purge all Nexus PM data from Redis and re-seed defaults."""
    flushed = redis_client.flush_all_data()
    redis_client.seed_defaults()
    return {"ok": True, "flushed_keys": flushed}
