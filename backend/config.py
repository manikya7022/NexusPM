"""Nexus PM — Configuration management."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    """Application settings loaded from environment variables."""

    # Server
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "nexus-pm-dev-secret")

    # Redis / Upstash
    UPSTASH_REDIS_URL: str = os.getenv("UPSTASH_REDIS_URL", "")
    UPSTASH_REDIS_TOKEN: str = os.getenv("UPSTASH_REDIS_TOKEN", "")

    # Slack
    SLACK_BOT_TOKEN: str = os.getenv("SLACK_BOT_TOKEN", "")
    SLACK_SIGNING_SECRET: str = os.getenv("SLACK_SIGNING_SECRET", "")

    # Figma
    FIGMA_ACCESS_TOKEN: str = os.getenv("FIGMA_ACCESS_TOKEN", "")

    # Jira
    JIRA_DOMAIN: str = os.getenv("JIRA_DOMAIN", "")
    JIRA_EMAIL: str = os.getenv("JIRA_EMAIL", "")
    JIRA_API_TOKEN: str = os.getenv("JIRA_API_TOKEN", "")

    # Google Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # TinyFish
    TINYFISH_API_KEY: str = os.getenv("TINYFISH_API_KEY", "")

    # Data Source Defaults (Target IDs for Agents)
    SLACK_CHANNEL_ID: str = os.getenv("SLACK_CHANNEL_ID", "general")
    FIGMA_FILE_KEY: str = os.getenv("FIGMA_FILE_KEY", "demo-file-key")
    JIRA_PROJECT_KEY: str = os.getenv("JIRA_PROJECT_KEY", "PROJ")

    @property
    def redis_available(self) -> bool:
        return bool(self.UPSTASH_REDIS_URL)

    @property
    def slack_available(self) -> bool:
        return bool(self.SLACK_BOT_TOKEN)

    @property
    def figma_available(self) -> bool:
        return bool(self.FIGMA_ACCESS_TOKEN)

    @property
    def jira_available(self) -> bool:
        return bool(self.JIRA_DOMAIN and self.JIRA_API_TOKEN)

    @property
    def gemini_available(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def tinyfish_available(self) -> bool:
        return bool(self.TINYFISH_API_KEY)

    def get_service_status(self) -> dict:
        """Return connection status of all services."""
        return {
            "redis": {"configured": self.redis_available},
            "slack": {"configured": self.slack_available},
            "figma": {"configured": self.figma_available},
            "jira": {"configured": self.jira_available},
            "gemini": {"configured": self.gemini_available},
            "tinyfish": {"configured": self.tinyfish_available},
        }


settings = Settings()
