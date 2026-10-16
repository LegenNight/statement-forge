from playwright.sync_api import sync_playwright
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def test_statement_forge():
    print("[*] Launching browser to test StatementForge...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # 1. Load application
        page.goto("http://localhost:3000", wait_until="networkidle")
        print("[+] Page loaded successfully.")

        # 2. Verify Header & Badges
        header_text = page.locator("header").inner_text()
        assert "STATEMENTFORGE" in header_text, "Missing Logo text"
        assert "100% Client-Side Processing" in header_text, "Missing Client-Side badge"
        assert "Zero Server Uploads" in header_text, "Missing Zero Server badge"
        print("[✓] Header bar and badges verified.")

        # 3. Verify Telemetry & Reconciled Pill
        recon_pill = page.locator("text=[✓ RECONCILED: $0.00 VARIANCE]").first
        assert recon_pill.is_visible(), "Reconciled pill not visible!"
        print("[✓] Status pill is [✓ RECONCILED: $0.00 VARIANCE].")

        # 4. Verify Monospace Balance Card Values
        summary_text = page.locator("section").inner_text()
        assert "$14,850.20" in summary_text, "Beginning balance mismatch"
        assert "+$11,420.50" in summary_text, "Deposits mismatch"
        assert "-$7,995.90" in summary_text, "Withdrawals mismatch"
        assert "$18,274.80" in summary_text, "Ending balance mismatch"
        print("[✓] Monospace balance summary matches exact Chase fixture figures.")

        # 5. Verify Table Rows
        rows = page.locator("tbody tr").all()
        print(f"[+] Total table rows rendered: {len(rows)}")
        assert len(rows) == 13, f"Expected 13 rows, got {len(rows)}"

        # 6. Verify Clean Payees
        first_row = page.locator("tbody tr").first.inner_text()
        assert "Stripe" in first_row, "Expected Stripe in first row"
        print("[✓] Clean Payee names verified (Stripe).")

        # 7. Test Search Filter with "/"
        page.keyboard.press("/")
        search_input = page.locator('input[placeholder*="Filter transactions"]')
        search_input.type("Office Depot")
        page.wait_for_timeout(300)
        filtered_rows = page.locator("tbody tr").all()
        assert len(filtered_rows) == 1, f"Expected 1 filtered row, got {len(filtered_rows)}"
        print("[✓] Search filter works as expected (1 row for 'Office Depot').")
        
        # Clear search
        page.locator('button:has(svg.lucide-x)').first.click()
        page.wait_for_timeout(300)
        assert len(page.locator("tbody tr").all()) == 13, "Rows didn't reset after clearing search"
        print("[✓] Search reset successfully.")

        # 8. Test Inline Editing & Dynamic Discrepancy Calculation
        # Click on the amount of first row to edit
        amount_cell = page.locator("tbody tr:first-child td:nth-child(6)")
        amount_cell.click()
        edit_input = page.locator("tbody tr:first-child input[type='text']")
        edit_input.fill("4130.00") # Changed from 4250.00 (-$120.00 discrepancy!)
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)

        # Check that discrepancy pill appears!
        discrepancy_pill = page.locator("text=DISCREPANCY").first
        assert discrepancy_pill.is_visible(), "Discrepancy pill did not appear after editing amount!"
        print(f"[✓] Discrepancy detected and flagged in status pill: {discrepancy_pill.inner_text()}")

        # 9. Test Re-loading sample statement resets back to balanced
        page.click('button:has-text("Load Sample Chase Statement")')
        page.wait_for_timeout(400)
        recon_pill_reloaded = page.locator("text=[✓ RECONCILED: $0.00 VARIANCE]").first
        assert recon_pill_reloaded.is_visible(), "Reconciled pill did not restore after reload!"
        print("[✓] Sample reload restored balanced status.")

        # 10. Test Export buttons trigger download
        with page.expect_download() as download_info:
            page.click('button:has-text("QuickBooks Online CSV")')
        download = download_info.value
        assert "QBO" in download.suggested_filename, f"Unexpected filename: {download.suggested_filename}"
        print(f"[✓] QuickBooks CSV download triggered successfully: {download.suggested_filename}")

        with page.expect_download() as download_info:
            page.click('button:has-text("Xero CSV")')
        download = download_info.value
        assert "Xero" in download.suggested_filename, f"Unexpected filename: {download.suggested_filename}"
        print(f"[✓] Xero CSV download triggered successfully: {download.suggested_filename}")

        browser.close()
        print("\n[ALL TESTS PASSED WITH 100% SUCCESS!]")

if __name__ == "__main__":
    test_statement_forge()
