# 🛸 Nexus PM: Enterprise Agentic Lifecycle Orchestrator

**Nexus PM** is a production-grade multi-agent workforce designed to solve the "Reliability Gap" in AI automation. It bridges the gap between design (Figma), communication (Slack), and execution (Jira) using a **Human-in-the-Loop (HITL)** safety architecture and **Self-Healing Web Agents**.



## 🌟 The Billion-Dollar Differentiator
Most AI agents fail when a website updates its UI or requires 2FA. Nexus PM is built with:
- **Self-Healing Vision:** If a UI element moves, the agent re-locates it using Gemini 1.5 Pro vision and continues.
- **Context Fusion:** Merges visual Figma deltas with unstructured Slack DM/channel history.
- **Persistent Memory:** Powered by Upstash Redis, the agent survives crashes and retains session cookies to bypass repeated logins.

---

## 🏗️ Multi-Agent Architecture
The system uses **LangGraph** to coordinate three specialized agent personas:

1. **👁️ The Visionary (Design Analyst):** Scans Figma frames and identifies pixel-level deltas.
2. **✍️ The Architect (Context Specialist):** Scrapes Slack threads/DMs and maps conversations to technical requirements.
3. **🏗️ The Operator (Web Executor):** Drives the **TinyFish API** to physically navigate Jira, handle 2FA handshakes, and create/update tickets.



---

## ✨ Key Features
- **Project Command Center:** A Next.js dashboard to manage multiple projects simultaneously.
- **Human-Verified Workflows:** The agent drafts Jira tickets in a "Shadow State" and pings Slack for PM approval before publishing.
- **Git-Style History:** A visual tree of all changes made across the product lifecycle.
- **Session Vault:** Encrypted Redis storage for auth tokens to ensure seamless enterprise integration.

## 🛠️ Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Orchestration** | LangGraph (Python) |
| **LLMs** | Gemini 1.5 Pro (Multimodal), Gemini 1.5 Flash |
| **Web Agent** | TinyFish API |
| **Database/Memory** | Upstash Redis |
| **Frontend** | Next.js 15, Tailwind CSS, Framer Motion |
| **Communication** | Slack SDK, Jira REST API, Figma API |

## 🚀 Quick Start (Replit / Local)

1. **Clone the Repo:**
   ```bash
   git clone [https://github.com/your-username/nexus-pm-engine.git](https://github.com/your-username/nexus-pm-engine.git)
