"""Headless check of the portfolio: screenshots + page errors + the reload-while-scrolled regression.

    uv run --with playwright python -I tools/verify.py [http://localhost:8777/]

Uses the system Chrome (Playwright's bundled Chromium has no GPU here and the WebGL scenes stay black).
Writes tools/out/<size>-<view>.png. Exit code 1 on any page error or a failed check.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8777/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZES = [(1440, 900, 2), (1280, 720, 1), (390, 844, 3)]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


async def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    failed = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME, args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
        )
        for w, h, dpr in SIZES:
            tag = f"{w}x{h}@{dpr}"
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
            page = await ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(URL + "?skip=1", wait_until="load")
            await page.mouse.move(w / 2, h / 2)
            await page.wait_for_function("window.__openingDone === true", timeout=20000)
            await page.wait_for_timeout(1000)
            await page.screenshot(path=os.path.join(OUT, f"{tag}-hero.png"))
            icon = await page.query_selector(".ico--named")
            if icon:
                await icon.click()
                await page.wait_for_timeout(3000)
                await page.screenshot(path=os.path.join(OUT, f"{tag}-box.png"))
            await page.mouse.wheel(0, 30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=os.path.join(OUT, f"{tag}-footer.png"))
            # reload while scrolled: the opening must still end on the hero (scrollY 0, not docked)
            await page.goto(URL, wait_until="load")
            await page.wait_for_function("window.__openingDone === true", timeout=20000)
            await page.mouse.wheel(0, 1500)
            await page.wait_for_timeout(2000)
            await page.reload(wait_until="load")
            await page.wait_for_function("window.__openingDone === true", timeout=20000)
            await page.wait_for_timeout(500)
            y = await page.evaluate("scrollY")
            docked = await page.evaluate("document.body.classList.contains('docked')")
            ok = y == 0 and not docked
            print(f"{tag:14s} errors={len(errors)} reload-check={'ok' if ok else 'FAIL (scrollY=%s docked=%s)' % (y, docked)}")
            for e in errors:
                print("   ", e[:200])
            failed |= bool(errors) or not ok
            await ctx.close()
        await browser.close()
    print("screenshots in", OUT)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
