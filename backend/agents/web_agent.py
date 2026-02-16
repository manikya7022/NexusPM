"""Nexus PM — Web Agent (TinyFish API) with self-healing capability."""
from config import settings


async def execute_web_action(url: str, action: str, selector: str = "", data: dict = None) -> dict:
    """Execute a web automation action via TinyFish API.

    Supports self-healing: if a button moves, takes a screenshot,
    uses Gemini to re-locate it, and retries.
    """
    if not settings.tinyfish_available:
        return _mock_web_action(url, action)

    import httpx

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Try the action
            resp = await client.post(
                "https://api.tinyfish.io/v1/actions",
                headers={"Authorization": f"Bearer {settings.TINYFISH_API_KEY}"},
                json={
                    "url": url,
                    "action": action,
                    "selector": selector,
                    "data": data or {},
                },
            )
            result = resp.json()

            if result.get("success"):
                return {"success": True, "message": f"Action '{action}' completed", "data": result}

            # Step 2: Self-healing — element not found, take screenshot and retry
            if result.get("error") == "element_not_found" and settings.gemini_available:
                return await _self_heal(client, url, action, selector, data)

            return {"success": False, "message": result.get("error", "Unknown error"), "data": result}

    except Exception as e:
        return {"success": False, "message": str(e)}


async def _self_heal(client, url: str, action: str, selector: str, data: dict) -> dict:
    """Self-healing: screenshot → Gemini re-locate → retry."""
    try:
        # Take screenshot
        screenshot_resp = await client.post(
            "https://api.tinyfish.io/v1/screenshot",
            headers={"Authorization": f"Bearer {settings.TINYFISH_API_KEY}"},
            json={"url": url},
        )
        screenshot_data = screenshot_resp.json()

        if not screenshot_data.get("screenshot_url"):
            return {"success": False, "message": "Self-heal: Could not capture screenshot"}

        # Use Gemini to find the new selector
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-pro",
            google_api_key=settings.GEMINI_API_KEY,
        )

        prompt = f"""I'm trying to perform the action "{action}" on a web page at {url}.
The original CSS selector "{selector}" no longer works - the element may have moved.

Looking at this page screenshot, what would be the new CSS selector for this element?
Return ONLY the CSS selector, nothing else.

Screenshot URL: {screenshot_data['screenshot_url']}"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        new_selector = response.content.strip().strip('"').strip("'")

        # Retry with new selector
        retry_resp = await client.post(
            "https://api.tinyfish.io/v1/actions",
            headers={"Authorization": f"Bearer {settings.TINYFISH_API_KEY}"},
            json={
                "url": url,
                "action": action,
                "selector": new_selector,
                "data": data or {},
            },
        )
        retry_result = retry_resp.json()

        if retry_result.get("success"):
            return {
                "success": True,
                "message": f"Self-healed: Found element at '{new_selector}'",
                "healed": True,
                "oldSelector": selector,
                "newSelector": new_selector,
            }

        return {"success": False, "message": "Self-heal attempted but still failed"}

    except Exception as e:
        return {"success": False, "message": f"Self-heal error: {e}"}


def _mock_web_action(url: str, action: str) -> dict:
    return {
        "success": True,
        "message": f"[DEMO] Action '{action}' on {url} simulated",
        "demo": True,
    }
