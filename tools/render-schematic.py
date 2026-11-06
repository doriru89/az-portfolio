"""Render assets/screens/src/<name>.html (1600x1000) to assets/screens/<name>.jpg.

    uv run --with playwright,pillow python -I tools/render-schematic.py lenovo
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright
from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def main() -> None:
    name = sys.argv[1]
    src = os.path.join(ROOT, "assets", "screens", "src", f"{name}.html")
    png = os.path.join(ROOT, "assets", "screens", "src", f"{name}.png")
    jpg = os.path.join(ROOT, "assets", "screens", f"{name}.jpg")
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME)
        page = await (await browser.new_context(viewport={"width": 1600, "height": 1000})).new_page()
        await page.goto("file://" + src, wait_until="load")
        await page.wait_for_timeout(600)
        await page.screenshot(path=png)
        await browser.close()
    Image.open(png).convert("RGB").save(jpg, quality=88)
    os.remove(png)
    print("wrote", jpg)


if __name__ == "__main__":
    asyncio.run(main())
