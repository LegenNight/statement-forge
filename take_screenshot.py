from playwright.sync_api import sync_playwright
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

def capture_previews():
    base_dir = os.path.dirname(__file__)
    storefront_path = os.path.join(base_dir, "assay_storefront_preview.png")
    tool_path = os.path.join(base_dir, "statement_forge_preview.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Assay Root Storefront Preview
        print("[*] Capturing Assay Root Storefront (http://localhost:3000/)...")
        page.goto("http://localhost:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.screenshot(path=storefront_path, full_page=False)
        print(f"  [OK] Storefront preview saved to: {storefront_path}")

        # 2. StatementForge Tool Route Preview
        print("[*] Capturing StatementForge Tool Route (http://localhost:3000/tools/statementforge)...")
        page.goto("http://localhost:3000/tools/statementforge", wait_until="networkidle")
        page.wait_for_timeout(500)
        
        # Load sample data if available to make preview informative
        sample_btn = page.locator('button:has-text("Load Sample Chase Statement")')
        if sample_btn.count() > 0:
            sample_btn.first.click()
            page.wait_for_timeout(500)

        page.screenshot(path=tool_path, full_page=False)
        print(f"  [OK] StatementForge tool preview saved to: {tool_path}")

        context.close()
        browser.close()

if __name__ == "__main__":
    capture_previews()
