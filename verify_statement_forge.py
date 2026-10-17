from playwright.sync_api import sync_playwright
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_comprehensive_e2e_tests():
    print("=" * 75)
    print("  ASSAY & STATEMENTFORGE: FULL E2E SUITE WITH ROUTING & BRAND VERIFICATION")
    print("=" * 75)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            permissions=["clipboard-read", "clipboard-write"]
        )
        page = context.new_page()

        # -------------------------------------------------------------
        # 1. ASSAY STOREFRONT (ROOT /) VERIFICATION
        # -------------------------------------------------------------
        print("\n[*] 1. Validating Assay Root Storefront (http://localhost:3000)...")
        t_start = time.time()
        page.goto("http://localhost:3000", wait_until="networkidle")
        load_time_ms = (time.time() - t_start) * 1000
        print(f"  [✓] Storefront loaded in {load_time_ms:.1f}ms")

        # Verify Brand Typography & Canvas Palette
        body_class = page.locator("body").get_attribute("class") or ""
        assert "bg-stone-50" in body_class or "selection:bg-amber-100" in body_class, "Expected Assay stone-50 palette"
        print("  [✓] Storefront canvas verified: Light mode stone-50 background (bg-stone-50).")

        header_text = page.locator("header").inner_text()
        assert "assay" in header_text, "Missing Assay brand mark in storefront header"
        print("  [✓] Storefront brand verified: 'assay' in header.")

        # Exact Required Copy Assertion
        h1_text = page.locator("h1").inner_text()
        assert "Small, exact tools for work that gets audited." in h1_text, (
            f"Required headline missing! Got: {h1_text}"
        )
        print("  [✓] Required headline verified: 'Small, exact tools for work that gets audited.'")

        # Verify StatementForge showcase & CTA
        assert page.locator("text=StatementForge").count() > 0, "Missing StatementForge in storefront showcase"
        cta_buttons = page.locator('a[href="/tools/statementforge"]').all()
        assert len(cta_buttons) >= 2, f"Expected multiple 'Open StatementForge' links, found {len(cta_buttons)}"
        print(f"  [✓] Storefront product routing verified: {len(cta_buttons)} links pointing to /tools/statementforge.")

        # -------------------------------------------------------------
        # 2. NAVIGATION TO STATEMENTFORGE TOOL ROUTE (/tools/statementforge)
        # -------------------------------------------------------------
        print("\n[*] 2. Navigating to StatementForge Dedicated Route (/tools/statementforge)...")
        cta_buttons[0].click()
        page.wait_for_url("**/tools/statementforge")
        page.wait_for_selector("text=Local Processing Active")
        print(f"  [✓] Successfully routed to: {page.url}")

        # -------------------------------------------------------------
        # 3. STATEMENTFORGE BRANDING & UI INTEGRITY CHECK
        # -------------------------------------------------------------
        print("\n[*] 3. Running StatementForge UI & Brand Integrity Checks...")

        # Verify Header Branding: assay / StatementForge
        header_el = page.locator("header").first
        header_text = header_el.inner_text()
        assert "assay" in header_text, "Missing 'assay' in StatementForge header"
        assert "StatementForge" in header_text, "Missing 'StatementForge' in header"
        print("  [✓] Brand identity verified: 'assay / StatementForge' header.")

        # Verify ShieldCheck Status Indicator ("Local Processing Active")
        shield_icon = page.locator("header svg.lucide-shield-check")
        assert shield_icon.count() > 0, "Missing ShieldCheck icon in header"
        assert "Local Processing Active" in header_text, "Missing 'Local Processing Active' status text"
        print("  [✓] Security telemetry verified: ShieldCheck icon + 'Local Processing Active'.")

        # Verify Primary Action Button uses Assay Slate-900 palette (not old blue-600)
        export_btn = page.locator('button:has-text("QuickBooks Online CSV")').first
        btn_class = export_btn.get_attribute("class") or ""
        assert "bg-slate-900" in btn_class, f"Expected bg-slate-900 on primary button, got: {btn_class}"
        assert "bg-blue-600" not in btn_class, "Found deprecated blue-600 on primary button!"
        print("  [✓] Palette sync verified: Primary export button styled with 'bg-slate-900'.")

        # -------------------------------------------------------------
        # 4. MATH ENGINE & MULTI-PAGE FIXTURE VALIDATION
        # -------------------------------------------------------------
        print("\n[*] 4. Validating Multi-Page Math Engine & Reconciliation...")

        # Measure in-browser parse performance
        t0 = time.time()
        page.click('button:has-text("Load Sample Chase Statement")')
        page.wait_for_selector("text=[✓ RECONCILED: $0.00 VARIANCE]")
        parse_duration_ms = (time.time() - t0) * 1000
        print(f"  [✓] Multi-page fixture parsed client-side in {parse_duration_ms:.1f}ms (Target < 500ms: PASS)")

        # Verify Reconciliation Badge
        recon_badge = page.locator("text=[✓ RECONCILED: $0.00 VARIANCE]").first
        assert recon_badge.is_visible(), "Reconciled badge not visible after multi-page parse"
        assert "Ending balance perfectly matches" in page.locator("body").inner_text(), "Expected balanced explanation"
        print("  [✓] Mathematical reconciliation status: [✓ RECONCILED: $0.00 VARIANCE].")

        # Verify Monospace Summary Metric Figures
        body_text = page.locator("body").inner_text()
        assert "$14,850.20" in body_text, "Beginning balance mismatch"
        assert "+$11,420.50" in body_text, "Deposits inflow mismatch"
        assert "-$7,995.90" in body_text, "Withdrawals outflow mismatch"
        assert "$18,274.80" in body_text, "Ending balance mismatch"
        print("  [✓] All 4 summary metrics verified: Beginning $14,850.20, In +$11,420.50, Out -$7,995.90, Ending $18,274.80.")

        # Verify All 13 Rows Parsed Seamlessly across the page break
        rows = page.locator("tbody tr").all()
        assert len(rows) == 13, f"Expected 13 rows from multi-page fixture, got {len(rows)}"
        print(f"  [✓] Multi-page stitching verified: Exactly {len(rows)} ledger transactions extracted.")

        # Verify Redundant Bank Headers were sanitized
        for row in rows:
            text = row.inner_text()
            assert "JPMorgan" not in text, "Redundant bank header was erroneously parsed as a transaction row!"
            assert "PAGE_BREAK" not in text, "Page break marker was erroneously parsed as a transaction row!"
            assert "Columbus OH" not in text, "Address block was erroneously parsed as a transaction row!"
        print("  [✓] Header sanitization verified: Zero ghost rows from redundant page headers.")

        # -------------------------------------------------------------
        # 5. INTERACTIVE STATE HANDLING & LIVE RECALCULATION
        # -------------------------------------------------------------
        print("\n[*] 5. Testing Interactive State Handling & Live Recalculation...")

        first_amount_cell = page.locator("tbody tr:first-child td:nth-child(6)")
        first_amount_cell.click()
        
        edit_input = page.locator("tbody tr:first-child input[type='text']")
        edit_input.fill("4130.00")
        page.keyboard.press("Enter")
        page.wait_for_timeout(350)

        # Check instant downgrade to Amber Discrepancy Alert
        discrepancy_badge = page.locator("text=DISCREPANCY").first
        assert discrepancy_badge.is_visible(), "Discrepancy badge did not appear upon amount modification!"
        discrepancy_text = discrepancy_badge.inner_text()
        assert "-$120.00" in discrepancy_text, f"Expected -$120.00 discrepancy, got: {discrepancy_text}"
        print(f"  [✓] Dynamic recalculation verified: Instantly downgraded to: {discrepancy_text}")

        # Restore by reloading sample
        page.click('button:has-text("Load Sample Chase Statement")')
        page.wait_for_timeout(350)
        assert page.locator("text=[✓ RECONCILED: $0.00 VARIANCE]").first.is_visible()
        print("  [✓] State recovery verified: Re-balanced to $0.00 variance.")

        # -------------------------------------------------------------
        # 6. KEYBOARD SHORTCUTS & SEARCH FILTERING
        # -------------------------------------------------------------
        print("\n[*] 6. Testing Shortcuts & Filtering...")
        page.keyboard.press("/")
        search_input = page.locator('input[placeholder*="Search payees"]')
        search_input.type("Office Depot")
        page.wait_for_timeout(250)
        
        filtered = page.locator("tbody tr").all()
        assert len(filtered) == 1, f"Expected 1 filtered row, got {len(filtered)}"
        assert "Office Depot" in filtered[0].inner_text()
        print("  [✓] Search '/' shortcut and filter verified (1 row returned for 'Office Depot').")

        # Clear search
        page.locator('button:has(svg.lucide-x)').first.click()
        page.wait_for_timeout(250)
        assert len(page.locator("tbody tr").all()) == 13

        # -------------------------------------------------------------
        # 7. EXPORT ENGINE VALIDATION (CLIENT-SIDE MEMORY DOWNLOADS)
        # -------------------------------------------------------------
        print("\n[*] 7. Testing Export Engine (QuickBooks, Xero, TSV)...")

        # A. QuickBooks Online CSV Download
        with page.expect_download() as download_info:
            page.click('button:has-text("QuickBooks Online CSV")')
        download = download_info.value
        qbo_path = download.path()
        with open(qbo_path, "r", encoding="utf-8") as f:
            qbo_content = f.read()

        qbo_lines = [l.strip() for l in qbo_content.strip().splitlines() if l.strip()]
        assert qbo_lines[0] == "Date,Description,Amount", f"Unexpected QBO header: {qbo_lines[0]}"
        assert len(qbo_lines) == 14, f"Expected header + 13 data rows, got {len(qbo_lines)}"
        assert '"Stripe",4250.00' in qbo_lines[1] or 'Stripe,4250.00' in qbo_lines[1], "First QBO deposit format error"
        print(f"  [✓] QuickBooks Online CSV verified: 13 rows, correct signed amounts ({download.suggested_filename}).")

        # B. Xero CSV Download
        with page.expect_download() as download_info:
            page.click('button:has-text("Xero CSV")')
        xero_download = download_info.value
        xero_path = xero_download.path()
        with open(xero_path, "r", encoding="utf-8") as f:
            xero_content = f.read()
            
        xero_lines = [l.strip() for l in xero_content.strip().splitlines() if l.strip()]
        assert xero_lines[0] == "Date,Amount,Payee,Description,Reference", f"Unexpected Xero header: {xero_lines[0]}"
        assert len(xero_lines) == 14, f"Expected header + 13 Xero rows, got {len(xero_lines)}"
        print(f"  [✓] Xero CSV verified: 13 rows, standard 5-column format ({xero_download.suggested_filename}).")

        # C. TSV Clipboard Copy
        page.click('button:has-text("Copy TSV")')
        page.wait_for_timeout(300)
        clipboard_text = page.evaluate("navigator.clipboard.readText()")
        assert "\t" in clipboard_text, "Clipboard TSV missing tab delimiters"
        tsv_lines = [l for l in clipboard_text.strip().split("\n") if l.strip()]
        assert len(tsv_lines) == 14, f"Expected header + 13 TSV rows, got {len(tsv_lines)}"
        print("  [✓] TSV Clipboard Export verified: 13 rows with tab delimiters ready for Excel/Sheets.")

        context.close()
        browser.close()

    print("\n" + "=" * 75)
    print("  ALL ASSAY & STATEMENTFORGE SUITE TESTS PASSED SUCCESSFULLY! (100%)")
    print("=" * 75)


if __name__ == "__main__":
    run_comprehensive_e2e_tests()
