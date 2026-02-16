"""Nexus PM — LangGraph Orchestrator: State-machine agent pipeline.

Pipeline: Ingest → Reason → Draft → Human_Interrupt → Execute
"""
import asyncio
from datetime import datetime
from config import settings

from agents.slack_agent import fetch_slack_messages_with_context
from agents.figma_agent import fetch_figma_file, fetch_figma_comments
from agents.jira_agent import fetch_jira_issues, create_jira_issue, update_jira_issue
from agents.context_fusion import fuse_context
from agents.web_agent import execute_web_action

import redis_client
from ws_manager import manager


async def run_pipeline(project_id: str, run_id: str, sources: list[str] = None):
    """Execute the full agent pipeline for a project.

    This is the main orchestration function that moves through:
    Ingest → Reason → Draft → Human_Interrupt → Execute
    """
    sources = sources or ["slack", "figma"]

    # ── Telemetry helper ──
    async def tlog(stage: str, message: str, level: str = "info"):
        """Append to Redis telemetry list and push over WebSocket."""
        redis_client.append_telemetry_log(project_id, run_id, {
            "stage": stage, "message": message, "level": level,
        })
        await manager.broadcast_telemetry(project_id, run_id, stage, message, level)

    # ── State persistence helpers ──
    def save_checkpoint(stage: str, data: dict = None):
        """Save pipeline checkpoint for resumability."""
        state = {"stage": stage, "run_id": run_id, "timestamp": datetime.utcnow().isoformat()}
        if data:
            state["data"] = data
        redis_client._set(f"agent_state:{project_id}", redis_client.json.dumps(state), ex=86400)

    def get_checkpoint() -> dict | None:
        """Retrieve the last saved checkpoint."""
        raw = redis_client._get(f"agent_state:{project_id}")
        if raw:
            return redis_client.json.loads(raw)
        return None

    # Helper to update a node's status and broadcast
    async def update_node(stage: str, status: str, description: str, details: list[str] = None):
        run = redis_client.get_agent_run(project_id, run_id)
        if not run:
            return
        for node in run.get("nodes", []):
            if node["stage"] == stage:
                node["status"] = status
                node["description"] = description
                node["timestamp"] = datetime.utcnow().strftime("%H:%M:%S")
                if details:
                    node["details"] = details
        run["currentStage"] = stage
        redis_client.update_agent_run(project_id, run_id, run)

    # ---- STAGE 1: INGEST ----
    await tlog("ingest", "Starting data ingestion from Slack, Figma, and Jira")
    save_checkpoint("ingest")

    await manager.broadcast_pulse(
        project_id, agent="Curator", action="starting ingestion",
        target="Slack & Figma", source="system", status="processing",
    )

    slack_context = {"summary": {}, "latest": [], "all": [], "is_fresh": True}
    figma_data = {"name": "Unknown", "pages": [], "comments": []}
    jira_data = []

    if "slack" in sources:
        # Fetch Slack messages with Redis context - old as summary, latest as actions
        slack_context = await fetch_slack_messages_with_context(
            project_id=project_id,
            channel=settings.SLACK_CHANNEL_ID
        )
        
        summary = slack_context["summary"]
        latest_count = len(slack_context["latest"])
        total_count = summary.get("count", 0)
        
        await tlog("ingest", f"Slack: collected {latest_count} new messages ({total_count} total)")
        await manager.broadcast_pulse(
            project_id, agent="Curator", 
            action=f"collected {latest_count} new messages ({total_count} total in history)",
            target=f"Channel: #{settings.SLACK_CHANNEL_ID}", source="slack", status="completed",
        )
        
        # Log summary info
        if summary.get("topics"):
            print(f"📊 Slack history topics: {', '.join(summary['topics'])}")
        if slack_context["is_fresh"]:
            print(f"🆕 First run - stored {total_count} messages as baseline")

    if "figma" in sources:
        figma_data = await fetch_figma_file(settings.FIGMA_FILE_KEY)
        comments = await fetch_figma_comments(settings.FIGMA_FILE_KEY)
        figma_data["comments"] = comments
        await tlog("ingest", f"Figma: {len(figma_data.get('pages', []))} pages, {len(comments)} comments")
        await manager.broadcast_pulse(
            project_id, agent="Curator",
            action=f"analyzed {len(figma_data.get('pages', []))} Figma pages, {len(comments)} comments",
            target=figma_data.get("name", "Figma file"), source="figma", status="completed",
        )

    jira_data = await fetch_jira_issues(project_key=settings.JIRA_PROJECT_KEY)
    await tlog("ingest", f"Jira: found {len(jira_data)} existing issues in {settings.JIRA_PROJECT_KEY}")
    await manager.broadcast_pulse(
        project_id, agent="Curator", action=f"found {len(jira_data)} existing Jira issues",
        target="Jira project", source="jira", status="completed",
    )

    ingest_details = []
    latest_count = len(slack_context.get("latest", []))
    total_count = slack_context.get("summary", {}).get("count", 0)
    
    if slack_context.get("all"):
        ingest_details.append(f"Slack: {latest_count} new messages ({total_count} total history)")
    if figma_data.get("pages"):
        ingest_details.append(f"Figma: {len(figma_data['pages'])} pages, {len(figma_data.get('comments', []))} comments")
    ingest_details.append(f"Jira: {len(jira_data)} existing tickets")

    await update_node("ingest", "completed",
                       f"Collected {latest_count} new messages, {len(figma_data.get('pages', []))} pages",
                       ingest_details)

    await asyncio.sleep(1)  # Simulate processing time

    # ---- STAGE 2: REASON (Context Fusion) ----
    await tlog("reason", "Starting context fusion with Gemini AI + Jira ID detection")
    save_checkpoint("reason")
    await update_node("reason", "active", "Fusing context with AI...")

    await manager.broadcast_pulse(
        project_id, agent="Synthesizer", action="fusing Slack + Figma + Jira context",
        target="Context Bridge", source="system", status="processing",
    )

    # Pass latest messages for action processing, but include summary context
    fusion_result = await fuse_context(
        slack_messages=slack_context.get("latest", []),  # Latest for actions
        figma_data=figma_data, 
        jira_issues=jira_data,
        message_summary=slack_context.get("summary", {})  # Historical context
    )

    proposals = fusion_result.get("proposals", [])
    insights = fusion_result.get("insights", [])

    await tlog("reason", f"AI fusion complete: {len(proposals)} proposals, {len(insights)} insights")

    await update_node("reason", "completed",
                       f"Identified {len(proposals)} proposals, {len(insights)} insights",
                       [fusion_result.get("summary", "Context fusion complete")] + insights[:3])

    await manager.broadcast_pulse(
        project_id, agent="Synthesizer",
        action=f"generated {len(proposals)} task proposals from context fusion",
        target="Agent Pipeline", source="system", status="completed",
    )

    await asyncio.sleep(1)

    # ---- STAGE 3: DRAFT ----
    await tlog("draft", "Creating structured change proposals for review")
    save_checkpoint("draft")
    await update_node("draft", "active", "Creating change proposals...")

    await manager.broadcast_pulse(
        project_id, agent="Scribe", action="drafting Jira change proposals",
        target="Draft queue", source="jira", status="processing",
    )

    # Store the proposals (diff data) for the DiffViewer
    diff_items = []
    for p in proposals:
        changes = []
        if p.get("type") == "update" and p.get("changes"):
            for c in p["changes"]:
                changes.append({
                    "id": f"c-{hash(c.get('field', ''))}",
                    "type": "modified" if c.get("old") else "added",
                    "field": c.get("field", ""),
                    "oldValue": c.get("old", ""),
                    "newValue": c.get("new", ""),
                    "lineNumbers": {"old": 1, "new": 1},
                })
        elif p.get("type") == "create":
            changes.append({
                "id": f"c-new-{hash(p.get('title', ''))}",
                "type": "added",
                "field": "New Ticket",
                "newValue": p.get("title", ""),
                "lineNumbers": {"old": 0, "new": 1},
            })

        diff_item = {
            "id": f"diff-{hash(p.get('title', ''))}",
            "title": p.get("title", "Untitled"),
            "description": p.get("description", ""),
            "platform": "jira",
            "author": "Agent: Scribe",
            "timestamp": datetime.utcnow().strftime("%H:%M"),
            "changes": changes,
            "status": "pending",
            "proposal": p,
        }

        # Include pre-change snapshot if available (Agent B enrichment)
        if p.get("old_state"):
            diff_item["old_state"] = p["old_state"]

        diff_items.append(diff_item)
        await tlog("draft", f"Drafted proposal: {p.get('title', 'Untitled')}")

    # Save diffs to the run
    run = redis_client.get_agent_run(project_id, run_id)
    if run:
        run["diffs"] = diff_items
        redis_client.update_agent_run(project_id, run_id, run)

    await update_node("draft", "completed",
                       f"Created {len(diff_items)} change proposals",
                       [f"Proposal: {d['title']}" for d in diff_items[:5]])

    await manager.broadcast_pulse(
        project_id, agent="Scribe",
        action=f"created {len(diff_items)} Jira change proposals",
        target="Review queue", source="jira", status="completed",
    )

    # ---- STAGE 4: HUMAN REVIEW (Interrupt) ----
    await tlog("human_review", f"Pausing for human review of {len(diff_items)} proposals")
    save_checkpoint("human_review", {"diff_count": len(diff_items)})

    await update_node("human_review", "active",
                       f"Awaiting approval for {len(diff_items)} changes",
                       [f"{len(diff_items)} proposals pending review"])

    await manager.broadcast_pulse(
        project_id, agent="Operator",
        action="waiting for human review",
        target=f"{len(diff_items)} pending proposals",
        source="system", status="processing",
        details="Open the Review & Approve panel to review changes",
    )

    # Pipeline pauses here — execution continues when PM approves via the API

    return {
        "run_id": run_id,
        "status": "awaiting_review",
        "proposals": len(diff_items),
        "insights": insights,
    }
