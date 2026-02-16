"""Nexus PM — Environment Cleanup + Intertwined Data Seeding.

Phases:
  1. PURGE  — Delete all old Slack messages, Figma comments, and Jira tickets
             associated with the configured API keys.
  2. SEED   — Create realistic, cross-referenced data across all three platforms
             centred around a "Global Search Bar" feature discussion.

Run:  cd backend && python seed_data.py
"""
import os, re, sys, json, time, random
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Force reload .env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

# ─── Config ───────────────────────────────────────────────
SLACK_TOKEN       = os.getenv("SLACK_BOT_TOKEN", "")
FIGMA_TOKEN       = os.getenv("FIGMA_ACCESS_TOKEN", "")
FIGMA_FILE_KEY    = os.getenv("FIGMA_FILE_KEY", "")
JIRA_DOMAIN       = os.getenv("JIRA_DOMAIN", "")
JIRA_EMAIL        = os.getenv("JIRA_EMAIL", "")
JIRA_TOKEN        = os.getenv("JIRA_API_TOKEN", "")
JIRA_PROJECT_KEY  = os.getenv("JIRA_PROJECT_KEY", "SCRUM")
SLACK_CHANNEL_ID  = os.getenv("SLACK_CHANNEL_ID", "")

results = {"slack_channel": "", "figma_file_key": FIGMA_FILE_KEY, "jira_tickets": []}


# ═══════════════════════════════════════════════════════════════
#  PHASE 1 — PURGE ALL OLD DATA FROM REAL PLATFORMS
# ═══════════════════════════════════════════════════════════════

def purge_slack():
    """Delete ALL messages from every channel the bot has access to."""
    if not SLACK_TOKEN:
        print("⚠️  SLACK_BOT_TOKEN not set — skipping Slack purge")
        return
    headers = {"Authorization": f"Bearer {SLACK_TOKEN}", "Content-Type": "application/json"}
    client = httpx.Client(timeout=30)

    print("\n🧹 SLACK — Purging messages...")

    # 1. List all channels the bot is in
    resp = client.get("https://slack.com/api/conversations.list", headers=headers,
                      params={"types": "public_channel,private_channel", "limit": 200,
                              "exclude_archived": "true"})
    channels = resp.json().get("channels", [])
    print(f"   Found {len(channels)} channels")

    for ch in channels:
        ch_id = ch["id"]
        ch_name = ch["name"]
        deleted = 0

        # Paginate through all messages
        cursor = None
        while True:
            params = {"channel": ch_id, "limit": 100}
            if cursor:
                params["cursor"] = cursor
            resp = client.get("https://slack.com/api/conversations.history",
                              headers=headers, params=params)
            data = resp.json()
            if not data.get("ok"):
                print(f"   ⚠️  Cannot read #{ch_name}: {data.get('error')}")
                break

            msgs = data.get("messages", [])
            if not msgs:
                break

            for msg in msgs:
                ts = msg.get("ts")
                if not ts:
                    continue
                # Delete the message (chat.delete works for bot messages)
                del_resp = client.post("https://slack.com/api/chat.delete",
                                       headers=headers,
                                       json={"channel": ch_id, "ts": ts})
                if del_resp.json().get("ok"):
                    deleted += 1
                else:
                    # If we can't delete (e.g. other user's message), skip
                    pass
                time.sleep(0.15)  # Rate limit

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

        if deleted > 0:
            print(f"   🗑  #{ch_name}: deleted {deleted} messages")

    print("   ✅ Slack purge complete")


def purge_figma():
    """Delete ALL comments from the configured Figma file."""
    if not FIGMA_TOKEN or not FIGMA_FILE_KEY:
        print("⚠️  FIGMA credentials not set — skipping Figma purge")
        return
    headers = {"X-FIGMA-TOKEN": FIGMA_TOKEN}
    client = httpx.Client(timeout=30)

    print(f"\n🧹 FIGMA — Purging comments from file {FIGMA_FILE_KEY}...")

    # 1. Get all comments
    resp = client.get(f"https://api.figma.com/v1/files/{FIGMA_FILE_KEY}/comments",
                      headers=headers)
    if resp.status_code != 200:
        print(f"   ❌ Cannot access file: {resp.status_code}")
        return

    comments = resp.json().get("comments", [])
    print(f"   Found {len(comments)} comments")

    # 2. Delete each comment
    deleted = 0
    for c in comments:
        comment_id = c.get("id")
        if not comment_id:
            continue
        del_resp = client.delete(
            f"https://api.figma.com/v1/files/{FIGMA_FILE_KEY}/comments/{comment_id}",
            headers=headers)
        if del_resp.status_code in (200, 204):
            deleted += 1
        time.sleep(0.3)

    print(f"   🗑  Deleted {deleted}/{len(comments)} comments")
    print("   ✅ Figma purge complete")


def purge_jira():
    """Delete ALL issues from the configured Jira project."""
    if not all([JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT_KEY]):
        print("⚠️  JIRA credentials incomplete — skipping Jira purge")
        return

    auth = (JIRA_EMAIL, JIRA_TOKEN)
    client = httpx.Client(auth=auth, timeout=30)

    print(f"\n🧹 JIRA — Purging issues from project {JIRA_PROJECT_KEY}...")

    # Paginate through all issues
    total_deleted = 0
    while True:
        resp = client.post(
            f"https://{JIRA_DOMAIN}/rest/api/3/search/jql",
            headers={"Content-Type": "application/json"},
            json={"jql": f"project = {JIRA_PROJECT_KEY}"})
        if resp.status_code != 200:
            print(f"   ⚠️  Search failed: {resp.status_code} {resp.text[:200]}")
            break

        data = resp.json()
        issues = data.get("issues", [])
        if not issues:
            break

        print(f"   Found {len(issues)} issues to delete...")
        for issue in issues:
            issue_id = issue["id"]
            # Get the key via detail endpoint
            detail = client.get(f"https://{JIRA_DOMAIN}/rest/api/3/issue/{issue_id}",
                               params={"fields": "summary"})
            key = detail.json().get("key", issue_id) if detail.status_code == 200 else issue_id

            del_resp = client.delete(
                f"https://{JIRA_DOMAIN}/rest/api/3/issue/{issue_id}",
                params={"deleteSubtasks": "true"})
            if del_resp.status_code in (200, 204):
                print(f"   🗑  Deleted {key}")
                total_deleted += 1
            else:
                print(f"   ⚠️  Failed to delete {key}: {del_resp.status_code}")
            time.sleep(0.2)

    print(f"   ✅ Jira purge complete — deleted {total_deleted} issues")


# ═══════════════════════════════════════════════════════════════
#  PHASE 2 — INTERTWINED DATA SEEDING ("Global Search Bar")
# ═══════════════════════════════════════════════════════════════

def seed_slack():
    """Seed Slack with an intertwined discussion about the Global Search Bar."""
    if not SLACK_TOKEN:
        print("⚠️  SLACK_BOT_TOKEN not set — skipping Slack")
        return
    headers = {"Authorization": f"Bearer {SLACK_TOKEN}", "Content-Type": "application/json"}
    client = httpx.Client(timeout=30)

    print("\n🟢 SLACK — Seeding intertwined messages...")

    # Determine channel: use SLACK_CHANNEL_ID or create/find nexus-pm-test
    channel_id = SLACK_CHANNEL_ID
    channel_name = "nexus-pm-test"

    if not channel_id:
        resp = client.get("https://slack.com/api/conversations.list", headers=headers,
                          params={"types": "public_channel", "limit": 200})
        existing = resp.json().get("channels", [])
        channel_id = next((c["id"] for c in existing if c["name"] == channel_name), None)
        if not channel_id:
            resp = client.post("https://slack.com/api/conversations.create", headers=headers,
                               json={"name": channel_name, "is_private": False})
            data = resp.json()
            if data.get("ok"):
                channel_id = data["channel"]["id"]
                print(f"   ✅ Created #{channel_name} ({channel_id})")
            else:
                channel_id = next((c["id"] for c in existing if c["name"] == "general"), None)
                print(f"   ⚠️  Falling back to #general ({channel_id})")

    if not channel_id:
        print("   ❌ No channel available — skipping")
        return

    # Join channel
    client.post("https://slack.com/api/conversations.join", headers=headers,
                json={"channel": channel_id})

    results["slack_channel"] = channel_id

    # ── The intertwined messages ──
    # These reference a specific Jira ticket (SCRUM-XX — will be filled after creation)
    # and the Figma file, creating a realistic cross-platform thread.
    messages = [
        # Message 1 — PM kicks off the feature discussion
        "📋 *Feature Kickoff — Global Search Bar*\n"
        "Team, we're prioritising the Global Search Bar for this sprint. "
        "It needs to search across projects, messages, and files. "
        "I'll create a Jira ticket shortly. Design mockups are in Figma.",

        # Message 2 — Designer references Figma
        f"🎨 *Design Update*: I've uploaded the search bar mockups to Figma "
        f"(file: `{FIGMA_FILE_KEY}`). Key decisions:\n"
        f"• Rounded corners (12px radius)\n"
        f"• Glassmorphism backdrop\n"
        f"• Auto-complete dropdown with keyboard navigation",

        # Message 3 — Dev1 asks about architecture
        "🔧 *Tech Question*: For the search backend, should we use Elasticsearch "
        "or implement a simpler full-text search with PostgreSQL? "
        "Elasticsearch gives us fuzzy matching but adds infra complexity.",

        # Message 4 — PM references Jira
        "I've created the Jira ticket for this — we need to implement the search API "
        "endpoint, the React component, and the indexing pipeline. "
        "Let's target Sprint 3 for delivery. Priority is High.",

        # Message 5 — Stakeholder weighs in
        "⚡ *Stakeholder Input*: The search bar needs to be accessible from every page "
        "via `Cmd+K` shortcut. This is a blocker for the enterprise demo next week. "
        "Please prioritise the keyboard shortcut implementation.",

        # Message 6 — Dev1 commits to implementation
        "👍 I'll implement the search API using Elasticsearch. "
        "Need to handle: indexing pipeline, fuzzy matching, result ranking, "
        "and the `Cmd+K` shortcut on the frontend. Will update the Jira ticket with estimates.",

        # Message 7 — Designer follows up on Figma
        "🎨 Following up on the Figma comments — I've rounded the corners to 12px "
        "and added the glassmorphism effect. The auto-complete dropdown now shows "
        "recent searches and trending queries. Check the updated frames!",

        # Message 8 — PM wraps up
        "✅ *Action Items Summary*:\n"
        "• Dev1 → Implement Elasticsearch search API\n"
        "• Designer → Finalise search bar component in Figma\n"
        "• Stakeholder → Review Cmd+K shortcut in staging\n"
        "Let's sync again Thursday. All updates go through the Jira ticket.",
    ]

    print(f"   Posting {len(messages)} intertwined messages to channel {channel_id}...")
    for msg in messages:
        resp = client.post("https://slack.com/api/chat.postMessage", headers=headers,
                           json={"channel": channel_id, "text": msg})
        if not resp.json().get("ok"):
            print(f"   ⚠️  Failed: {resp.json().get('error')}")
        time.sleep(0.4)

    print(f"   🎉 Slack seeding complete — {len(messages)} messages posted")


def seed_figma():
    """Seed Figma with comments referencing the Slack discussion."""
    if not FIGMA_TOKEN or not FIGMA_FILE_KEY:
        print("⚠️  FIGMA credentials not set — skipping Figma")
        return
    headers = {"X-FIGMA-TOKEN": FIGMA_TOKEN, "Content-Type": "application/json"}
    client = httpx.Client(timeout=30)

    print(f"\n🔵 FIGMA — Seeding comments on file {FIGMA_FILE_KEY}...")

    # Verify file exists (with rate limit retry)
    for attempt in range(3):
        resp = client.get(f"https://api.figma.com/v1/files/{FIGMA_FILE_KEY}", headers=headers)
        if resp.status_code == 429:
            wait = 10 * (attempt + 1)
            print(f"   ⏳ Rate limited — waiting {wait}s...")
            time.sleep(wait)
            continue
        break

    if resp.status_code != 200:
        print(f"   ❌ Cannot access file: {resp.status_code}")
        return
    file_name = resp.json().get("name", "Unknown")
    print(f"   ✅ Found file: '{file_name}'")

    # Comments that reference the Slack discussion
    comments = [
        "Following the Slack thread on Global Search Bar — I've rounded the corners "
        "to 12px and added the glassmorphism backdrop effect. The auto-complete dropdown "
        "shows recent searches + trending queries as discussed.",

        "Re: Cmd+K shortcut from the Slack standup — adding a visual indicator "
        "in the top nav showing '⌘K to search'. This should be discoverable "
        "without cluttering the UI. Tagging this for the Jira ticket.",
    ]

    for i, comment in enumerate(comments):
        payload = {
            "message": comment,
            "client_meta": {"x": random.randint(100, 800), "y": random.randint(100, 600)}
        }
        resp = client.post(
            f"https://api.figma.com/v1/files/{FIGMA_FILE_KEY}/comments",
            headers=headers, json=payload)
        if resp.status_code in (200, 201):
            print(f"   ✅ Posted comment {i+1}/{len(comments)}")
        else:
            print(f"   ⚠️  Failed: {resp.status_code} {resp.text[:100]}")
        time.sleep(0.5)

    print("   🎉 Figma seeding complete")


def seed_jira():
    """Seed Jira with tickets that match the Slack/Figma discussion."""
    if not all([JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT_KEY]):
        print("⚠️  JIRA credentials incomplete — skipping Jira")
        return

    auth = (JIRA_EMAIL, JIRA_TOKEN)
    headers = {"Content-Type": "application/json"}
    client = httpx.Client(auth=auth, timeout=30)
    base_url = f"https://{JIRA_DOMAIN}/rest/api/3/issue"

    print(f"\n🟠 JIRA — Seeding issues into {JIRA_PROJECT_KEY}...")

    issues = [
        {
            "summary": "Implement Global Search Bar",
            "description": (
                "Implement a full-text search bar accessible from every page via Cmd+K.\n\n"
                "Requirements:\n"
                "- Elasticsearch-powered search API\n"
                "- React component with auto-complete dropdown\n"
                "- Fuzzy matching and result ranking\n"
                "- Keyboard navigation (arrow keys + Enter)\n"
                "- Glassmorphism design (12px rounded corners)\n\n"
                "References Figma mockups and Slack #nexus-pm-test discussion."
            ),
            "issuetype": "Story",
            "priority": "High",
        },
        {
            "summary": "Search API — Elasticsearch Integration",
            "description": (
                "Set up Elasticsearch indexing pipeline for cross-platform search.\n"
                "Index: projects, messages, files, tickets.\n"
                "Implement fuzzy matching and relevance ranking."
            ),
            "issuetype": "Task",
            "priority": "High",
        },
        {
            "summary": "Cmd+K Keyboard Shortcut for Global Search",
            "description": (
                "Implement Cmd+K (Ctrl+K on Windows) keyboard shortcut to open "
                "the search bar from any page. Blocker for enterprise demo.\n"
                "Add visual indicator in top nav: '⌘K to search'."
            ),
            "issuetype": "Task",
            "priority": "Highest",
        },
    ]

    for issue in issues:
        payload = {
            "fields": {
                "project": {"key": JIRA_PROJECT_KEY},
                "summary": issue["summary"],
                "description": {
                    "type": "doc", "version": 1,
                    "content": [{"type": "paragraph",
                                 "content": [{"type": "text", "text": issue["description"]}]}]
                },
                "issuetype": {"name": issue["issuetype"]},
                "priority": {"name": issue["priority"]},
            }
        }
        resp = client.post(base_url, headers=headers, json=payload)
        if resp.status_code in (200, 201):
            key = resp.json().get("key")
            results["jira_tickets"].append(key)
            print(f"   ✅ Created {key}: {issue['summary']}")
        else:
            print(f"   ⚠️  Failed: {resp.status_code} {resp.text[:150]}")
        time.sleep(0.5)

    print("   🎉 Jira seeding complete")


# ═══════════════════════════════════════════════════════════════
#  PHASE 3 — FLUSH REDIS
# ═══════════════════════════════════════════════════════════════

def flush_redis():
    """Flush all Nexus PM data from local Redis."""
    try:
        import redis as redis_lib
        url = os.getenv("UPSTASH_REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(url, decode_responses=True, socket_connect_timeout=5)
        r.ping()

        patterns = ["project:*", "conn:*", "run:*", "slack_messages:*",
                     "slack_last_processed:*", "agent_state:*", "telemetry:*"]
        total = 0
        for pat in patterns:
            keys = r.keys(pat)
            if keys:
                r.delete(*keys)
                total += len(keys)

        print(f"\n🧹 REDIS — Flushed {total} keys")
    except Exception as e:
        print(f"\n⚠️  Redis flush failed: {e} (will be re-seeded on backend restart)")


# ═══════════════════════════════════════════════════════════════
#  MAIN — Purge → Flush Redis → Seed
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 65)
    print("  Nexus PM — Full Environment Reset + Intertwined Seeding")
    print("=" * 65)

    # ── Phase 1: Purge ──
    print("\n" + "─" * 65)
    print("  PHASE 1: PURGING OLD DATA FROM ALL PLATFORMS")
    print("─" * 65)
    purge_slack()
    purge_figma()
    purge_jira()
    flush_redis()

    # ── Phase 2: Seed ──
    print("\n" + "─" * 65)
    print("  PHASE 2: SEEDING INTERTWINED DATA (Global Search Bar)")
    print("─" * 65)
    seed_jira()   # Create Jira tickets first so we can reference IDs
    seed_slack()
    seed_figma()

    # ── Summary ──
    print("\n" + "=" * 65)
    print("  ✅ COMPLETE — Summary")
    print("=" * 65)
    print(f"  Slack channel:  {results['slack_channel']}")
    print(f"  Figma file:     {results['figma_file_key']}")
    print(f"  Jira tickets:   {', '.join(results['jira_tickets'])}")

    # Auto-update .env with channel ID if needed
    if results["slack_channel"]:
        env_content = env_path.read_text()
        new_val = f"SLACK_CHANNEL_ID={results['slack_channel']}"
        if "SLACK_CHANNEL_ID=" in env_content:
            env_content = re.sub(r'^SLACK_CHANNEL_ID=.*$', new_val, env_content, flags=re.MULTILINE)
        else:
            env_content += f"\n{new_val}\n"
        env_path.write_text(env_content)
        print(f"\n  ✅ .env updated with SLACK_CHANNEL_ID={results['slack_channel']}")

    print("\n🔄 Restart the backend (Ctrl+C → python main.py) to reload .env")
    print("🚀 Then trigger 'Agent Sync' from the Dashboard!")
