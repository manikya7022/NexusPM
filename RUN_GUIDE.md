# Nexus PM — Complete Run & Testing Guide

## 🚀 Quick Start (Local Dev)

1.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    python main.py
    ```
2.  **Frontend**:
    ```bash
    cd app
    npm install
    npm run dev
    ```

---

## 🔑 How to Get API Keys

To enable real integrations, you need to obtain API keys and add them to `backend/.env`.

### 1. Slack (Bot Token)
*   **Go to:** [api.slack.com/apps](https://api.slack.com/apps)
*   **Create App:** Click "Create New App" -> "From scratch" -> Choose your workspace.
*   **Permissions:**
    *   Go to "OAuth & Permissions" in the sidebar.
    *   Scroll to "Scopes" -> "Bot Token Scopes".
    *   Add: `channels:history`, `chat:write`, `users:read`, `groups:history`, `im:history`.
*   **Install:** Scroll up to "OAuth Tokens for Your Workspace" and click "Install to Workspace".
*   **Copy:** Copy the **Bot User OAuth Token** (starts with `xoxb-`).
*   **Add to .env:** `SLACK_BOT_TOKEN=xoxb-...`

### 2. Figma (Personal Access Token)
*   **Go to:** Figma Desktop App or Web.
*   **Settings:** Click your profile icon -> Settings.
*   **Tokens:** Scroll to "Personal access tokens".
*   **Generate:** Click "Generate new token". Name it "Nexus PM".
*   **Copy:** Copy the token immediately (you won't see it again).
*   **Add to .env:** `FIGMA_ACCESS_TOKEN=figd-...`

### 3. Jira (API Token)
*   **Go to:** [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
*   **Create:** Click "Create API token". Label it "Nexus PM".
*   **Copy:** Copy the token.
*   **Add to .env:**
    *   `JIRA_API_TOKEN=your-token`
    *   `JIRA_EMAIL=your-jira-email@company.com`
    *   `JIRA_DOMAIN=your-domain.atlassian.net`
        *   **How to find it:** Open Jira in your browser. Look at the URL in the address bar.
        *   If the URL is `https://company-name.atlassian.net/jira/...`, then your domain is **company-name.atlassian.net**.
        *   It is **NOT** the full URL. Just the `something.atlassian.net` part.

### 4. Google Gemini (AI Context Fusion)
*   **Go to:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
*   **Create:** Click "Create API key".
*   **Copy:** Copy the key string.
*   **Add to .env:** `GEMINI_API_KEY=AIza...`

### 5. TinyFish (Web Agents)
*   **Go to:** [tinyfish.io](https://tinyfish.io)
*   **Sign up:** Create an account.
*   **Copy:** Go to Settings/API Keys and copy your key.
*   **Add to .env:** `TINYFISH_API_KEY=tf_...`

---

## 🧪 End-to-End Testing Walkthrough

Follow these steps to verify the entire system is working.

### Phase 1: Setup & Connection
1.  **Start Backend**: Ensure `python main.py` says `✅ Redis connected successfully`.
2.  **Start Frontend**: Ensure `npm run dev` opens `http://localhost:5173`.
3.  **Check WebSocket**: Look at the top-right of the dashboard. It should say "🟢 Live".
4.  **Configure Configs**:
    *   Click "Connection Vault" in the sidebar.
    *   (Optional) Enter your API keys here if you haven't added them to `.env`.
    *   Click "Test Connection" for each service. You should see a green checkmark.

### Phase 2: Triggering the Agent Pipeline
1.  **Go to Dashboard**: Click "Dashboard" in the sidebar.
2.  **Trigger Sync**:
    *   Find the "Quick Actions" card on the right.
    *   Click "Trigger Agent Sync".
3.  **Watch the Feed**:
    *   Look at the "Context Bridge" feed in the center.
    *   You should see events appearing in real-time:
        *   `Curator agent` ... `Ingesting Slack messages`
        *   `Curator agent` ... `Fetching Figma file`
        *   `Synthesizer` ... `Fusing context`
        *   `Scribe` ... `Drafting Jira proposal`

### Phase 3: Review & Execution
1.  **Wait for Completion**: Wait until you see a notification "Agent Run Complete".
2.  **Review Changes**:
    *   Click "Review & Approve" in the sidebar.
    *   You will see a "Diff Viewer" showing the proposed changes (Previous vs. Proposed).
3.  **Approve/Reject**:
    *   Click "Approve" to apply the changes to Jira.
    *   Click "Reject" to discard them.
4.  **Verify in Jira**:
    *   (If you have real keys) Go to your Jira project.
    *   Verify that a new ticket was created or an existing one updated.

---

## 🛠 Troubleshooting

**Q: My WebSocket says "Offline"**
*   Check if the backend is running.
*   Check browser console (F12) for connection errors.

**Q: I get "Authentication Failed" in Vault**
*   Double-check your API keys in `.env`.
*   Restart the backend after changing `.env`.

**Q: Agents are stuck on "Ingesting"**
*   Check the backend terminal logs for detailed error messages.
*   If using Demo Mode (no keys), ensure the mock agents are enabled in `main.py`.
