"""Nexus PM — Figma ingestion agent."""
import httpx
from config import settings


async def fetch_figma_file(file_key: str) -> dict:
    """Fetch a Figma file's structure."""
    if not settings.figma_available:
        return _mock_figma_file()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.figma.com/v1/files/{file_key}",
                headers={"X-FIGMA-TOKEN": settings.FIGMA_ACCESS_TOKEN},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "name": data.get("name", ""),
                    "lastModified": data.get("lastModified", ""),
                    "pages": [
                        {"name": page.get("name", ""), "id": page.get("id", "")}
                        for page in data.get("document", {}).get("children", [])
                    ],
                }
    except Exception:
        pass
    return _mock_figma_file()


async def fetch_figma_comments(file_key: str) -> list[dict]:
    """Fetch comments on a Figma file."""
    if not settings.figma_available:
        return _mock_figma_comments()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.figma.com/v1/files/{file_key}/comments",
                headers={"X-FIGMA-TOKEN": settings.FIGMA_ACCESS_TOKEN},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {
                        "message": c.get("message", ""),
                        "user": c.get("user", {}).get("handle", "unknown"),
                        "created_at": c.get("created_at", ""),
                    }
                    for c in data.get("comments", [])
                ]
    except Exception:
        pass
    return _mock_figma_comments()


async def fetch_figma_versions(file_key: str) -> list[dict]:
    """Fetch version history of a Figma file for timeline."""
    if not settings.figma_available:
        return _mock_figma_versions()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.figma.com/v1/files/{file_key}/versions",
                headers={"X-FIGMA-TOKEN": settings.FIGMA_ACCESS_TOKEN},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {
                        "id": v.get("id", ""),
                        "label": v.get("label", "Auto-save"),
                        "created_at": v.get("created_at", ""),
                        "user": v.get("user", {}).get("handle", "unknown"),
                    }
                    for v in data.get("versions", [])[:10]
                ]
    except Exception:
        pass
    return _mock_figma_versions()


def _mock_figma_file() -> dict:
    return {
        "name": "Mobile App v2 Design",
        "lastModified": "2024-01-15T10:30:00Z",
        "pages": [
            {"name": "Login Flow", "id": "page-1"},
            {"name": "Checkout", "id": "page-2"},
            {"name": "Navigation", "id": "page-3"},
        ],
    }


def _mock_figma_comments() -> list[dict]:
    return [
        {"message": "The login button needs to be more prominent", "user": "sarah", "created_at": "2024-01-15T10:00:00Z"},
        {"message": "Updated the checkout flow per last review", "user": "jordan", "created_at": "2024-01-15T09:30:00Z"},
        {"message": "Nav icons need spacing adjustment", "user": "mike", "created_at": "2024-01-15T08:00:00Z"},
    ]


def _mock_figma_versions() -> list[dict]:
    return [
        {"id": "v3", "label": "Nav redesign v3", "created_at": "2024-01-15T10:30:00Z", "user": "jordan"},
        {"id": "v2", "label": "Checkout flow update", "created_at": "2024-01-14T16:00:00Z", "user": "sarah"},
        {"id": "v1", "label": "Initial designs", "created_at": "2024-01-10T09:00:00Z", "user": "jordan"},
    ]
