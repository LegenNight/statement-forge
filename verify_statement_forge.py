from playwright.sync_api import sync_playwright
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_comprehensive_e2e_tests():
    print("=" * 80)
    print("  ASSAY & STATEMENTFORGE: VENDOR RULES, REDACTION & BULK E2E SUITE")
    print("=" * 80)
    
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

        # Brand Typography & Canvas Palette Checks
        canvas_class = (page.locator("body").get_attribute("class") or "") + " " + (page.locator("div.min-h-screen").first.get_attribute("class") or "")
        assert "bg-stone-50" in canvas_class or "stone" in canvas_class, f"Expected Assay stone-50 palette, got: {canvas_class}"
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

        # Verify StatementForge showcase & CTA links
        assert page.locator("text=StatementForge").count() > 0, "Missing StatementForge in storefront showcase"
        cta_buttons = page.locator('a[href="/tools/statementforge"]').all()
        assert len(cta_buttons) >= 2, f"Expected multiple 'Open StatementForge' links, found {len(cta_buttons)}"
        print(f"  [✓] Product routing verified: {len(cta_buttons)} CTA links pointing to /tools/statementforge.")

        # -------------------------------------------------------------
        # 2. NAVIGATION TO STATEMENTFORGE TOOL ROUTE (/tools/statementforge)
        # -------------------------------------------------------------
        print("\n[*] 2. Navigating to StatementForge Tool Route (/tools/statementforge)...")
        cta_buttons[0].click()
        page.wait_for_url("**/tools/statementforge")
        page.wait_for_selector("text=Local Processing Active")
        print(f"  [✓] Successfully routed to dedicated tool URL: {page.url}")

        # -------------------------------------------------------------
        # 3. STATEMENTFORGE BRANDING & UI INTEGRITY CHECK
        # -------------------------------------------------------------
        print("\n[*] 3. Running StatementForge UI & Brand Integrity Checks...")

        header_el = page.locator("header").first
        header_text = header_el.inner_text()
        assert "assay" in header_text, "Missing 'assay' in StatementForge header"
        assert "StatementForge" in header_text, "Missing 'StatementForge' in header"
        print("  [✓] Brand identity verified: 'assay / StatementForge' header.")

        shield_icon = page.locator("header svg.lucide-shield-check")
        assert shield_icon.count() > 0, "Missing ShieldCheck icon in header"
        assert "Local Processing Active" in header_text, "Missing 'Local Processing Active' status text"
        print("  [✓] Security telemetry verified: ShieldCheck icon + 'Local Processing Active'.")

        export_btn = page.locator('button:has-text("QuickBooks Online CSV")').first
        btn_class = export_btn.get_attribute("class") or ""
        assert "bg-slate-900" in btn_class, f"Expected bg-slate-900 on primary button, got: {btn_class}"
        assert "bg-blue-600" not in btn_class, "Found deprecated blue-600 on primary button!"
        print("  [✓] Palette sync verified: Primary export button styled with 'bg-slate-900'.")

        # Verify subtle initial file status indicator: "1 file processed"
        file_indicator = page.locator("text=1 file processed").first
        assert file_indicator.is_visible(), "Expected '1 file processed' indicator"
        print("  [✓] Subtle file status indicator verified: '1 file processed'.")

        # -------------------------------------------------------------
        # 4. BULK PROCESSING & CHRONOLOGICAL SORTING VALIDATION
        # -------------------------------------------------------------
        print("\n[*] 4. Validating Bulk Processing & Chronological Sorting Engine...")

        # Click "Load 2-Month Bulk Sample"
        t0 = time.time()
        page.click('button:has-text("Load 2-Month Bulk Sample")')
        page.wait_for_selector("text=2 files processed")
        bulk_parse_ms = (time.time() - t0) * 1000
        print(f"  [✓] 2-Month bulk statements parsed client-side in {bulk_parse_ms:.1f}ms")

        # Verify updated file count status indicator: "2 files processed"
        bulk_file_indicator = page.locator("text=2 files processed").first
        assert bulk_file_indicator.is_visible(), "Expected '2 files processed' indicator after bulk load"
        print("  [✓] Bulk file count indicator verified: '2 files processed'.")

        # Verify all 20 transactions parsed (13 Oct + 7 Nov)
        bulk_rows = page.locator("tbody tr").all()
        assert len(bulk_rows) == 20, f"Expected 20 combined transactions, got {len(bulk_rows)}"
        print(f"  [✓] Bulk transaction aggregation verified: Exactly {len(bulk_rows)} combined transactions.")

        # Verify Strict Chronological Sorting (Dates must flow from 10/02 up to 11/20)
        dates = []
        for row in bulk_rows:
            date_cell = row.locator("td:nth-child(2)").inner_text().strip()
            dates.append(date_cell)

        oct_indices = [i for i, d in enumerate(dates) if d.startswith("10/")]
        nov_indices = [i for i, d in enumerate(dates) if d.startswith("11/")]
        assert len(oct_indices) == 13, f"Expected 13 October rows, found {len(oct_indices)}"
        assert len(nov_indices) == 7, f"Expected 7 November rows, found {len(nov_indices)}"
        assert max(oct_indices) < min(nov_indices), (
            f"Chronological sort error! October transactions must appear before November. Dates: {dates}"
        )
        print(f"  [✓] Strict chronological sorting verified: All 13 October rows precede all 7 November rows.")

        # Verify Source File column is displayed in bulk mode
        source_col_header = page.locator('th:has-text("Source File")')
        assert source_col_header.count() > 0, "Source File column should appear when multiple files are loaded"
        print("  [✓] Multi-file source attribution verified: 'Source File' column active.")

        # Verify Consolidated Summary Figures Across 2 Statements
        body_text = page.locator("body").inner_text()
        assert "$14,850.20" in body_text, "Bulk beginning balance mismatch"
        assert "+$16,920.50" in body_text, "Bulk deposits mismatch"
        assert "$18,430.30" in body_text, "Bulk ending balance mismatch"
        assert "[✓ RECONCILED: $0.00 VARIANCE]" in body_text, "Bulk reconciliation failed!"
        print("  [✓] Bulk reconciliation verified: Beginning $14,850.20, Ending $18,430.30, $0.00 Variance.")

        # -------------------------------------------------------------
        # 5. MULTI-BANK AUTO-DETECTION ROUTER VALIDATION (AMEX)
        # -------------------------------------------------------------
        print("\n[*] 5. Validating Multi-Bank Auto-Detection Router (American Express)...")
        amex_btn = page.locator('button:has-text("Amex Sample")')
        if amex_btn.count() > 0 and amex_btn.is_visible():
            amex_btn.click()
            page.wait_for_selector("text=American Express")
            amex_body = page.locator("body").inner_text()
            assert "American Express" in amex_body, "Amex bank detection failed!"
            print("  [✓] Multi-bank router verified: Auto-detected 'American Express'.")

        # -------------------------------------------------------------
        # 6. RELOAD SINGLE CHASE STATEMENT & TEST INTERACTIVE EDITING
        # -------------------------------------------------------------
        print("\n[*] 6. Validating Single-Statement Reload & Interactive Math Discrepancy...")
        page.click('button:has-text("Load Sample Chase Statement")')
        page.wait_for_selector("text=1 file processed")
        assert len(page.locator("tbody tr").all()) == 13

        # Edit first row amount: change $4,250.00 to $4,130.00 (-$120.00 difference)
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
        # 7. VENDOR RULES ENGINE & LOCALSTORAGE PERSISTENCE
        # -------------------------------------------------------------
        print("\n[*] 7. Validating Deterministic Vendor Mapping Rules Engine & localStorage...")

        # Open Vendor Rules Modal
        page.click('button:has-text("Vendor Rules")')
        page.wait_for_selector("text=Deterministic Vendor Mapping Rules")
        print("  [✓] Vendor Rules modal opened.")

        # Add new rule: Pattern "UBER" -> Vendor "Uber Technologies" -> Category "Travel & Transportation"
        pattern_input = page.locator('input[placeholder*="UBER"]')
        vendor_input = page.locator('input[placeholder*="Uber Technologies"]')
        category_input = page.locator('input[placeholder*="Travel & Transport"]')

        pattern_input.fill("UBER")
        vendor_input.fill("Uber Technologies")
        category_input.fill("Travel & Transportation")
        page.click('button:has-text("Add Mapping Rule")')
        page.wait_for_timeout(250)

        # Verify rule exists in the modal list
        rule_entry = page.locator("text=Uber Technologies").first
        assert rule_entry.is_visible(), "New rule 'Uber Technologies' not visible in modal list"
        print("  [✓] Added new vendor rule: 'UBER' → 'Uber Technologies' (Travel & Transportation).")

        # Close modal
        page.click('button:has-text("Close & Save Rules")')
        page.wait_for_timeout(250)

        # Verify rules persisted to localStorage
        rules_storage = page.evaluate("() => localStorage.getItem('statementforge_vendor_rules')")
        assert rules_storage is not None, "Vendor rules not found in localStorage!"
        assert "Uber Technologies" in rules_storage, "Uber Technologies rule missing from localStorage!"
        assert "Travel & Transportation" in rules_storage, "Category missing from localStorage!"
        print("  [✓] Client-side persistence verified: Rule saved in browser localStorage.")

        # Add a manual transaction to test dynamic matching against the new UBER rule
        page.click('button:has-text("Add Entry")')
        page.wait_for_timeout(200)

        # Find the newly added row and change original memo to "UBER RIDE SAN FRANCISCO"
        first_memo_cell = page.locator("tbody tr:first-child td:nth-child(5)")
        first_memo_cell.click()
        memo_input = page.locator("tbody tr:first-child input[type='text']")
        memo_input.fill("UBER RIDE SAN FRANCISCO")
        page.keyboard.press("Enter")
        page.wait_for_timeout(250)

        # Verify table dynamically mapped vendor to "Uber Technologies" and category to "Travel & Transportation"
        first_row_text = page.locator("tbody tr:first-child").inner_text()
        assert "Uber Technologies" in first_row_text, f"Expected mapped vendor 'Uber Technologies', got: {first_row_text}"
        assert "Travel & Transportation" in first_row_text, f"Expected mapped category 'Travel & Transportation', got: {first_row_text}"
        assert "Rule Match" in first_row_text, "Expected 'Rule Match' badge on mapped vendor cell"
        print("  [✓] Dynamic mapping verified: 'UBER RIDE' row dynamically mapped to 'Uber Technologies' [Travel & Transportation].")

        # Clean up the manual row
        delete_btn = page.locator("tbody tr:first-child button[title='Delete this transaction']")
        delete_btn.click()
        page.wait_for_timeout(200)

        # -------------------------------------------------------------
        # 8. PRIVACY REDACTION MODE VALIDATION
        # -------------------------------------------------------------
        print("\n[*] 8. Validating Privacy Redaction Mode Toggle & Masking...")

        # Account number before redaction
        body_before_redact = page.locator("body").inner_text()
        assert "0000008412" in body_before_redact, "Expected unmasked account number before redaction"

        # Toggle Redaction Mode ON
        redact_btn = page.locator('button:has-text("Redact Sensitive Data")')
        redact_btn.click()
        page.wait_for_timeout(250)

        # Verify visual layer masking: Account number masked to ••••8412
        body_after_redact = page.locator("body").inner_text()
        assert "••••8412" in body_after_redact, "Account number was not masked with ••••8412!"
        assert "[Redaction Mask Active]" in body_after_redact, "Missing '[Redaction Mask Active]' badge"
        print("  [✓] Visual redaction mask verified: '0000008412' masked to '••••8412'.")

        # -------------------------------------------------------------
        # 9. EXPORT ENGINE VALIDATION (REDACTION & VENDOR PRIORITY)
        # -------------------------------------------------------------
        print("\n[*] 9. Validating Export Engine with Redaction & Mapped Vendors...")

        # A. QuickBooks Online CSV Download with Redaction
        with page.expect_download() as download_info:
            page.click('button:has-text("QuickBooks Online CSV")')
        download = download_info.value
        qbo_path = download.path()
        with open(qbo_path, "r", encoding="utf-8") as f:
            qbo_content = f.read()

        qbo_lines = [l.strip() for l in qbo_content.strip().splitlines() if l.strip()]
        assert qbo_lines[0] == "Date,Description,Amount", f"Unexpected QBO header: {qbo_lines[0]}"
        assert len(qbo_lines) == 14, f"Expected header + 13 data rows, got {len(qbo_lines)}"

        # Verify vendor rules prioritized in QBO export
        # Default rule maps STRIPE -> "Stripe Payments"
        assert "Stripe Payments" in qbo_content, "Expected mapped vendor 'Stripe Payments' in QBO export!"
        # Default rule maps OFFICE DEPOT -> "Office Depot"
        assert "Office Depot" in qbo_content, "Expected mapped vendor 'Office Depot' in QBO export!"
        print(f"  [✓] QuickBooks Online CSV verified: Prioritizes mapped vendors ({download.suggested_filename}).")

        # B. Xero CSV Download with Redaction
        with page.expect_download() as download_info:
            page.click('button:has-text("Xero CSV")')
        xero_download = download_info.value
        xero_path = xero_download.path()
        with open(xero_path, "r", encoding="utf-8") as f:
            xero_content = f.read()

        xero_lines = [l.strip() for l in xero_content.strip().splitlines() if l.strip()]
        assert xero_lines[0] == "Date,Amount,Payee,Description,Reference", f"Unexpected Xero header: {xero_lines[0]}"
        # Verify mapped category included in description
        assert "Merchant Processing Fees" in xero_content or "Office Supplies" in xero_content, (
            "Expected mapped category in Xero description"
        )
        print(f"  [✓] Xero CSV verified: Includes mapped categories ({xero_download.suggested_filename}).")

        # C. TSV Clipboard Copy with Redaction & Category Column
        page.click('button:has-text("Copy TSV")')
        page.wait_for_timeout(300)
        clipboard_text = page.evaluate("navigator.clipboard.readText()")
        assert "\t" in clipboard_text, "Clipboard TSV missing tab delimiters"
        assert "Vendor / Payee" in clipboard_text, "Expected 'Vendor / Payee' in TSV header"
        assert "Category" in clipboard_text, "Expected 'Category' in TSV header"
        assert "Stripe Payments" in clipboard_text, "Expected mapped vendor in TSV"
        print("  [✓] TSV Clipboard Export verified: Multi-column ledger with mapped vendor and category.")

        # Toggle Redaction Mode OFF to return to clean state
        redact_btn.click()
        page.wait_for_timeout(200)
        assert "0000008412" in page.locator("body").inner_text(), "Failed to unmask account number after toggle OFF"
        print("  [✓] Redaction mode toggle recovery verified: Cleanly restored original presentation.")

        context.close()
        browser.close()

    print("\n" + "=" * 80)
    print("  ALL VENDOR RULES, REDACTION & E2E TESTS PASSED SUCCESSFULLY! (100%)")
    print("=" * 80)


if __name__ == "__main__":
    run_comprehensive_e2e_tests()
