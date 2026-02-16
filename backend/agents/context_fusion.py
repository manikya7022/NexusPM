"""Nexus PM — Context Fusion via Gemini 1.5 Pro."""
import re
from config import settings
from agents.jira_agent import fetch_jira_issue_detail


# Regex pattern matching common Jira ticket IDs in Slack messages
_TICKET_RE = re.compile(r'\b([A-Z][A-Z0-9]+-\d+)\b')


def _extract_ticket_ids(messages: list[dict]) -> set[str]:
    """Scan Slack messages for Jira ticket IDs (e.g. SCRUM-32)."""
    ids: set[str] = set()
    for msg in messages:
        text = msg.get("text", "")
        ids.update(_TICKET_RE.findall(text))
    return ids


async def _build_snapshots(ticket_ids: set[str], jira_issues: list[dict]) -> dict[str, dict]:
    """Agent B: fetch pre-change snapshots for each detected ticket ID."""
    known_keys = {issue.get("key") for issue in jira_issues}
    snapshots: dict[str, dict] = {}
    for tid in ticket_ids:
        if tid in known_keys:
            detail = await fetch_jira_issue_detail(tid)
            if detail:
                snapshots[tid] = detail
    return snapshots


async def fuse_context(slack_messages: list[dict], figma_data: dict, jira_issues: list[dict], message_summary: dict = None) -> dict:
    """Merge Slack messages + Figma visual data + Jira state using Gemini 1.5 Pro.

    Args:
        slack_messages: Latest/new messages requiring action
        figma_data: Figma design data
        jira_issues: Existing Jira tickets
        message_summary: Historical context from Redis (topics, count, etc.)
    
    Returns structured task proposals.
    """
    # ── Phase 3A: Detect Jira ticket IDs in Slack messages ──
    detected_ids = _extract_ticket_ids(slack_messages)
    if detected_ids:
        print(f"🔍 Detected Jira IDs in messages: {detected_ids}")

    # ── Phase 3B: Build pre-change snapshots (Agent B) ──
    snapshots = await _build_snapshots(detected_ids, jira_issues)
    if snapshots:
        print(f"📸 Built snapshots for: {list(snapshots.keys())}")

    # Always try to generate intelligent proposals from real data
    # Only fall back to mock if Gemini fails completely
    
    if settings.gemini_available:
        try:
            import google.generativeai as genai
            import json

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.0-flash')

            # Build historical context from summary
            historical_context = ""
            if message_summary:
                historical_context = f"""
## Historical Context (from {message_summary.get('count', 0)} previous messages)
Topics discussed: {', '.join(message_summary.get('topics', []))}
Active users: {', '.join(message_summary.get('unique_users', [])[:5])}
"""

            # Include detected ticket IDs for the AI
            ticket_hint = ""
            if detected_ids:
                ticket_hint = f"\n## Jira Ticket IDs Detected in Messages\n{', '.join(detected_ids)}\nIMPORTANT: The above IDs were explicitly mentioned in Slack messages. Any proposal related to these should be an UPDATE with the existingTicket field.\n"
            
            prompt = f"""You are a Product Management AI assistant. Analyze the following REAL data from multiple sources and generate structured task proposals.

## NEW Slack Messages (REQUIRING ACTION - these are the latest messages since last check)
{_format_slack(slack_messages[:20])}
{historical_context}
{ticket_hint}

## Figma Design Data
File: {figma_data.get('name', 'Unknown')}
Pages: {', '.join(p['name'] for p in figma_data.get('pages', []))}
Comments: {_format_figma_comments(figma_data.get('comments', []))}

## Current Jira Issues
{_format_jira(jira_issues[:10])}

## Instructions
CRITICAL: Focus on the NEW Slack messages above - these are the LATEST messages that require action.
The historical context shows what was already discussed.

Look for in NEW messages:
- Technical decisions mentioned (OAuth, PKCE, MFA, etc.)
- Questions that need follow-up
- Tasks people committed to
- Blockers or issues raised
- Design updates from Figma
- References to existing Jira tickets (like {', '.join(detected_ids) if detected_ids else 'SCRUM-XX'})

For each message, decide:
1. If it references an existing Jira ticket → create UPDATE proposal with existingTicket field
2. If it relates to an existing ticket by topic → create UPDATE proposal
3. If it's a new topic → create CREATE proposal
4. If no action needed → skip it

Generate 2-4 proposals based on NEW content only.

Return ONLY a valid JSON object with this exact structure:
{{
  "summary": "Brief summary of what was analyzed",
  "proposals": [
    {{
      "type": "create" or "update",
      "title": "Clear action-oriented title",
      "description": "Detailed description based on NEW Slack content",
      "priority": "High/Medium/Low",
      "relatedSlackMessages": ["actual message text from NEW messages"],
      "relatedFigmaPages": ["page names if relevant"],
      "existingTicket": "TICKET-123" (only if type is update and ticket exists),
      "changes": [{{"field": "Field Name", "old": "old value", "new": "new value"}}]
    }}
  ],
  "insights": ["key observation 1", "key observation 2"]
}}

IMPORTANT: Use ONLY NEW messages for proposals. Historical context is for background only."""

            response = model.generate_content(prompt)

            # Try to parse JSON from response
            text = response.text
            # Find JSON block
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            try:
                result = json.loads(text.strip())
                # Validate that proposals are based on real data
                if result.get("proposals") and len(result["proposals"]) > 0:
                    # ── Enrich update proposals with pre-change snapshots ──
                    for p in result["proposals"]:
                        ticket_key = p.get("existingTicket")
                        if ticket_key and ticket_key in snapshots:
                            snap = snapshots[ticket_key]
                            p["old_state"] = snap
                            # Enrich changes with actual old values
                            if not p.get("changes"):
                                p["changes"] = []
                    print(f"✅ Gemini AI generated {len(result['proposals'])} proposals")
                    return result
            except json.JSONDecodeError:
                print(f"⚠️ Gemini returned non-JSON response, using smart fallback")
                
        except Exception as e:
            print(f"⚠️ Gemini fusion error: {e}, using smart fallback")
    
    # Smart fallback: generate proposals from actual Slack messages
    return _smart_fusion_from_real_data(
        slack_messages, figma_data, jira_issues, message_summary,
        detected_ids=detected_ids, snapshots=snapshots,
    )


def _format_slack(messages: list[dict]) -> str:
    return "\n".join(f"- @{m.get('user', '?')}: {m.get('text', '')}" for m in messages)


def _format_figma_comments(comments: list[dict]) -> str:
    return "\n".join(f"- @{c.get('user', '?')}: {c.get('message', '')}" for c in comments)


def _format_jira(issues: list[dict]) -> str:
    return "\n".join(f"- [{i['key']}] {i['summary']} ({i['status']}, {i['priority']})" for i in issues)


def _smart_fusion_from_real_data(slack_messages: list, figma_data: dict, jira_issues: list,
                                  message_summary: dict = None, *, detected_ids: set = None,
                                  snapshots: dict = None) -> dict:
    """Generate proposals by analyzing real Slack messages and matching to existing tickets."""
    import re
    
    detected_ids = detected_ids or set()
    snapshots = snapshots or {}
    
    proposals = []
    insights = []
    
    # Get historical context
    history_count = message_summary.get('count', 0) if message_summary else 0
    history_topics = message_summary.get('topics', []) if message_summary else []
    
    # Build a search index of existing tickets for matching
    ticket_index = {}
    for issue in jira_issues:
        key = issue.get('key', '')
        summary = issue.get('summary', '').lower()
        # Index by words in summary
        words = set(summary.split())
        ticket_index[key] = {
            'issue': issue,
            'words': words,
            'summary': summary
        }
    
    # Keywords to look for in messages
    action_keywords = ['need', 'should', 'must', 'implement', 'create', 'add', 'fix', 'update', 'refactor', 'build', 'handle', 'work on']
    priority_keywords = {'critical': 'High', 'blocker': 'High', 'urgent': 'High', 'high': 'High', 
                        'medium': 'Medium', 'low': 'Low'}
    
    # Analyze each message for action items
    for msg in slack_messages:
        text = msg.get('text', '').lower()
        original_text = msg.get('text', '')
        user = msg.get('user', 'unknown')
        
        # Skip system messages
        if 'has joined' in text or 'has left' in text:
            continue
        
        # Skip messages that don't have action items
        has_action = any(kw in text for kw in action_keywords)
        ticket_patterns = ['create a ticket', 'create ticket', 'new ticket', 'create new', 'sprint']
        has_ticket_request = any(p in text for p in ticket_patterns)
        
        if not has_action and not has_ticket_request:
            continue
        
        # Extract the core topic/task from the message
        clean_text = original_text
        for prefix in ['we should', 'we need to', 'need to', 'should', 'create a ticket for', 'create new ticket for', 'let\'s']:
            if clean_text.lower().startswith(prefix):
                clean_text = clean_text[len(prefix):].strip()
        
        # Get key words from this message for matching
        message_words = set(clean_text.lower().split())
        # Filter out common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}
        content_words = message_words - stop_words
        
        # Try to match with existing tickets
        best_match = None
        best_score = 0
        
        for key, ticket_data in ticket_index.items():
            ticket_words = ticket_data['words']
            # Calculate overlap
            common = content_words & ticket_words
            if len(common) > 0:
                score = len(common) / max(len(content_words), len(ticket_words))
                if score > best_score and score > 0.3:  # At least 30% overlap
                    best_score = score
                    best_match = ticket_data['issue']
        
        # Determine priority
        priority = 'Medium'
        for kw, pri in priority_keywords.items():
            if kw in text:
                priority = pri
                break
        
        # Check for sprint mentions
        sprint_match = re.search(r'sprint\s*(\d+)', text, re.IGNORECASE)
        sprint_info = f" (Target: Sprint {sprint_match.group(1)})" if sprint_match else ""
        
        if best_match:
            # This relates to an existing ticket - create UPDATE proposal
            existing_key = best_match['key']
            existing_summary = best_match['summary']
            
            # Check if we already have this update proposal
            existing_proposal = next((p for p in proposals if p.get('existingTicket') == existing_key), None)
            
            if existing_proposal:
                # Add this message to existing proposal
                existing_proposal['relatedSlackMessages'].append(original_text)
                existing_proposal['description'] += f"\n\n@{user}: {original_text}"
            else:
                # Create new update proposal
                proposals.append({
                    "type": "update",
                    "title": f"Update {existing_key}: {existing_summary}",
                    "description": f"New discussion from Slack regarding this ticket:\n\n@{user}{sprint_info}:\n{original_text}\n\nConsider updating ticket based on this discussion.",
                    "priority": priority,
                    "existingTicket": existing_key,
                    "relatedSlackMessages": [original_text],
                    "relatedFigmaPages": [],
                    "changes": [{"field": "description", "old": "", "new": f"Additional context from Slack: {original_text[:100]}..."}],
                })
                insights.append(f"📝 Message from {user} relates to {existing_key}")
        else:
            # No matching ticket - create NEW ticket proposal
            # Generate title from message content
            title_text = clean_text[:70] if len(clean_text) > 70 else clean_text
            if len(title_text) < 10:
                title_text = f"Task: {original_text[:60]}..."
            
            # Capitalize and clean
            title = title_text[0].upper() + title_text[1:] if title_text else "New task from Slack discussion"
            
            # Check for duplicates
            is_duplicate = any(p['title'].lower() == title.lower() for p in proposals if p['type'] == 'create')
            
            if not is_duplicate and len([p for p in proposals if p['type'] == 'create']) < 3:
                proposals.append({
                    "type": "create",
                    "title": title,
                    "description": f"Based on Slack discussion from @{user}{sprint_info}:\n\n{original_text}\n\n---\nAction: Create ticket to track this work item.",
                    "priority": priority,
                    "relatedSlackMessages": [original_text],
                    "relatedFigmaPages": [],
                    "sprint": sprint_match.group(1) if sprint_match else None,
                })
                insights.append(f"✨ New task identified from {user}: {title[:50]}...")
        
        # Additional insights
        if 'blocker' in text or 'blocking' in text:
            insights.append(f"⚠️ Blocker mentioned by {user}")
        if 'bug' in text or 'error' in text or 'issue' in text:
            insights.append(f"🐛 Potential bug mentioned by {user}")
        if 'figma' in text or 'design' in text:
            insights.append(f"🎨 Design discussion by {user}")
    
    # If no proposals found, don't create generic ones - just return empty
    if not proposals:
        return {
            "summary": f"Analyzed {len(slack_messages)} messages{history_count > 0 and f' (with {history_count} historical)' or ''}. No specific action items identified.",
            "proposals": [],
            "insights": insights if insights else ["No immediate action items from recent discussions"],
        }
    
    # Include historical context in summary
    history_info = f" (with {history_count} messages history)" if history_count > 0 else ""
    topics_info = f" Topics: {', '.join(history_topics)}" if history_topics else ""
    
    return {
        "summary": f"Analyzed {len(slack_messages)} new Slack messages{history_info} and found {len(proposals)} action items.{topics_info}",
        "proposals": proposals[:5],
        "insights": insights[:6] if insights else ["Team is actively discussing implementation details"],
    }


def _mock_fusion(slack_messages: list, figma_data: dict, jira_issues: list) -> dict:
    """Legacy mock fusion - only used as last resort."""
    # Use real Jira issue keys if available, otherwise use placeholder
    existing_tickets = [issue.get("key", f"PROJ-{1240+i}") for i, issue in enumerate(jira_issues[:3])]
    
    # Ensure we have at least some ticket references
    if len(existing_tickets) < 2:
        existing_tickets = ["PROJ-1244", "PROJ-1243"]
    
    return {
        "summary": f"Analysis of {len(slack_messages)} Slack messages, {len(figma_data.get('pages', []))} Figma pages, and {len(jira_issues)} Jira tickets reveals 3 action items.",
        "proposals": [
            {
                "type": "update",
                "title": "Implement OAuth + MFA login flow",
                "description": f"Based on Slack discussion, update {existing_tickets[0]} to include OAuth (Google, GitHub) and email-based MFA.",
                "priority": "High",
                "relatedSlackMessages": ["sarah: The login flow needs OAuth + MFA support"],
                "relatedFigmaPages": ["Login Flow"],
                "existingTicket": existing_tickets[0],
                "changes": [
                    {"field": "Summary", "old": "Implement basic login", "new": "Implement OAuth + MFA login flow"},
                    {"field": "Priority", "old": "Medium", "new": "High"},
                    {"field": "Description", "old": "", "new": "Add Google OAuth, GitHub OAuth, and email-based MFA"},
                ],
            },
            {
                "type": "create",
                "title": "Checkout flow redesign tickets",
                "description": "Create tracking tickets for the checkout redesign as requested by @alex.",
                "priority": "Medium",
                "relatedSlackMessages": ["alex: Can someone create Jira tickets for the checkout redesign?"],
                "relatedFigmaPages": ["Checkout"],
            },
            {
                "type": "update" if len(existing_tickets) > 1 else "create",
                "title": "Navigation component updates",
                "description": f"Sync {existing_tickets[1] if len(existing_tickets) > 1 else 'new ticket'} with latest Figma nav designs uploaded by @jordan.",
                "priority": "Medium",
                "relatedSlackMessages": ["jordan: I've updated the Figma frames for the mobile nav"],
                "relatedFigmaPages": ["Navigation"],
                "existingTicket": existing_tickets[1] if len(existing_tickets) > 1 else None,
                "changes": [
                    {"field": "Design Link", "old": "", "new": "Updated Figma frames available"},
                    {"field": "Status", "old": "In Review", "new": "Ready for Dev"},
                ] if len(existing_tickets) > 1 else [],
            },
        ],
        "insights": [
            "Login flow needs significant scope expansion (OAuth + MFA)",
            "Checkout redesign has no tracking tickets yet - gap found",
            "Navigation component has new Figma designs ready for development",
            "All API integration work appears to be on track",
        ],
    }
