# Nexus PM — Seed Data & Testing Guide

Since you are running the project locally with empty workspaces, you need to create some "Seed Data" so the agents have something to process.

## 1. Configure the Agents

Open `backend/.env` and add these lines at the bottom (replace with your actual IDs):

```env
# Agent Data Targets
SLACK_CHANNEL_ID=C0123456789
FIGMA_FILE_KEY=abc123xyz890
JIRA_PROJECT_KEY=SCRUM
```

---

## 2. Create the Data

### 🟢 Slack (The Input)
1.  **Create a Channel**: In your Slack workspace, create a channel (e.g., `#nexus-pm-test`).
2.  **Get Channel ID**:
    *   Right-click the channel name → "Copy Link".
    *   The link looks like: `https://app.slack.com/client/T000/C12345678`.
    *   The Channel ID is the last part: **`C12345678`**.
    *   Set `SLACK_CHANNEL_ID=C12345678` in `.env`.
3.  **Add the App**: Type `/invite @NexusPM` (or whatever you named your bot) in the channel.
4.  **Post Messages**: The agent needs context to fuse. Post 2-3 messages like:
    > "We need to implement Google OAuth login by next week."
    > "Make sure it supports 2FA as per the security requirements."
    > "The Figma design for the login page is ready."

### 🔵 Figma (The Design)
1.  **Create a File**: Create a new Figma file named "Login Flow".
2.  **Get File Key**:
    *   Look at the URL: `https://www.figma.com/file/abc123xyz890/Login-Flow...`
    *   The key is the part after `/file/`: **`abc123xyz890`**.
    *   Set `FIGMA_FILE_KEY=abc123xyz890` in `.env`.
3.  **Add Content**: Create a frame named "Login Page".
4.  **Add a Comment**: Press `C` and click anywhere. Type:
    > "This is the new login screen. Note the 'Continue with Google' button."

### 🔵 Jira (The Output)
1.  **Get Project Key**:
    *   Go to your Jira project.
    *   Look at the issue keys (e.g., `SCRUM-1`, `SCRUM-2`).
    *   The project key is the prefix: **`SCRUM`**.
    *   Set `JIRA_PROJECT_KEY=SCRUM` in `.env`.

---

## 3. Run the Test

1.  **Restart Backend**: `Ctrl+C` then `python main.py` (to load new .env variables).
2.  **Go to Dashboard**: `http://localhost:5173`.
3.  **Trigger Sync**: Click the "Trigger Agent Sync" button (Quick Actions).
4.  **Watch the Feed**:
    *   You should see: "Collected X Slack messages", "Analyzed Figma file...", "Found X Jira issues".
    *   Then: "Fusing context..."
    *   Then: "Created Jira change proposals".
5.  **Review**: Go to "Review & Approve" to see the AI-generated proposal based on your Slack messages and Figma comment.
