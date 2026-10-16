from playwright.sync_api import sync_playwright
import os

def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(1000)
        screenshot_path = os.path.join(os.path.dirname(__file__), "statement_forge_preview.png")
        page.screenshot(path=screenshot_path, full_page=False)
        print(f"Screenshot saved to: {screenshot_path}")
        browser.close()

if __name__ == "__main__":
    capture()
