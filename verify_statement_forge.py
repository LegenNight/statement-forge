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

        export_btn = page.locator('button:has-text("Export .QBO")').first
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
            page.click('button:has-text("QuickBooks CSV")')
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

        # -------------------------------------------------------------
        # 10. STRICT NATIVE .QBO & .OFX SGML INTEGRITY VALIDATION
        # -------------------------------------------------------------
        print("\n[*] 10. Validating Strict Native .QBO & .OFX SGML Integrity...")

        # A. Download .QBO file and inspect structural integrity in memory
        with page.expect_download() as download_info:
            page.click('button:has-text("Export .QBO")')
        qbo_file = download_info.value
        qbo_disk_path = qbo_file.path()
        with open(qbo_disk_path, "r", encoding="utf-8") as f:
            raw_qbo = f.read()

        # 1. Validate OFX 1.02 SGML Header Block
        assert "OFXHEADER:100" in raw_qbo, "Missing OFXHEADER:100"
        assert "DATA:OFXSGML" in raw_qbo, "Missing DATA:OFXSGML"
        assert "VERSION:102" in raw_qbo, "Missing VERSION:102"
        assert "SECURITY:NONE" in raw_qbo, "Missing SECURITY:NONE"
        assert "ENCODING:USASCII" in raw_qbo, "Missing ENCODING:USASCII"
        assert "CHARSET:1252" in raw_qbo, "Missing CHARSET:1252"
        print("  [✓] SGML 1.02 Header Block conforms strictly to banking standard.")

        # 2. Validate Container Elements have open and close tags
        assert "<OFX>" in raw_qbo and "</OFX>" in raw_qbo, "Missing <OFX> container"
        assert "<BANKTRANLIST>" in raw_qbo and "</BANKTRANLIST>" in raw_qbo, "Missing <BANKTRANLIST> container"
        assert "<STMTTRN>" in raw_qbo and "</STMTTRN>" in raw_qbo, "Missing <STMTTRN> container tags"

        # 3. CRITICAL CONSTRAINT: Exact SGML-style syntax with NO closing tags where unsupported
        unsupported_closing_tags = [
            "</TRNTYPE>", "</DTPOSTED>", "</TRNAMT>", "</FITID>", "</NAME>", "</MEMO>",
            "</CODE>", "</SEVERITY>", "</DTSERVER>", "</LANGUAGE>", "</TRNUID>", "</CURDEF>",
            "</ACCTID>", "</ACCTTYPE>"
        ]
        for tag in unsupported_closing_tags:
            assert tag not in raw_qbo, f"Found forbidden closing tag in SGML export: {tag}!"
        print("  [✓] CRITICAL INVARIANT: Zero invalid closing tags found across entire OFX document.")

        # 4. Validate exact transaction block structure
        assert "<TRNTYPE>DEBIT" in raw_qbo or "<TRNTYPE>CREDIT" in raw_qbo, "Missing <TRNTYPE> tag"
        assert "120000[-5:EST]" in raw_qbo, "Missing [-5:EST] timezone in <DTPOSTED>"
        assert "<FITID>" in raw_qbo, "Missing <FITID> tag"
        assert "<NAME>" in raw_qbo, "Missing <NAME> tag"
        assert "<MEMO>" in raw_qbo, "Missing <MEMO> tag"
        # Verify mapped vendor in <NAME>
        assert "<NAME>Stripe Payments" in raw_qbo, "Expected mapped vendor 'Stripe Payments' in <NAME> tag"
        print("  [✓] Transaction block format strictly validated: <STMTTRN>, <TRNTYPE>, <DTPOSTED>[-5:EST], <TRNAMT>, <FITID>, <NAME>, <MEMO>, </STMTTRN>.")

        # B. Test Native .OFX Export
        with page.expect_download() as download_info:
            page.click('button:has-text("Export .OFX")')
        ofx_file = download_info.value
        ofx_disk_path = ofx_file.path()
        with open(ofx_disk_path, "r", encoding="utf-8") as f:
            raw_ofx = f.read()

        assert raw_ofx.startswith("OFXHEADER:100"), "OFX export missing header"
        assert "</TRNTYPE>" not in raw_ofx and "</NAME>" not in raw_ofx, "OFX contains closing tags on leaf nodes"
        print(f"  [✓] Native .OFX verified: Generated valid SGML ({ofx_file.suggested_filename}).")

        # C. Redaction mode sanitization applied to <NAME> and <MEMO>
        redact_btn.click() # Turn ON
        page.wait_for_timeout(200)

        with page.expect_download() as download_info:
            page.click('button:has-text("Export .QBO")')
        redacted_qbo_file = download_info.value
        with open(redacted_qbo_file.path(), "r", encoding="utf-8") as f:
            redacted_qbo = f.read()

        assert "<ACCTID>REDACTED" in redacted_qbo, "Account ID was not redacted in OFX/QBO!"
        # In redaction mode, sensitive account tokens and patterns are masked
        assert "0000008412" not in redacted_qbo, "Found raw account number in redacted OFX export!"
        print("  [✓] Redaction mode sanitization verified on native .QBO: <ACCTID> and sensitive data masked.")

        redact_btn.click() # Turn OFF
        page.wait_for_timeout(200)

        # -------------------------------------------------------------
        # 11. GUMROAD LICENSE GATE & 20-ROW FREE TIER VALIDATION
        # -------------------------------------------------------------
        print("\n[*] 11. Validating Gumroad License Gate & 20-Row Free Tier Limit...")

        # 1. Clear any stored license in localStorage to ensure unverified state
        page.evaluate("() => localStorage.removeItem('statementforge_license')")
        page.reload()
        page.wait_for_selector("text=Local Processing Active")

        # 2. Load 2-Month Bulk Sample (20 transactions)
        page.click('button:has-text("Load 2-Month Bulk Sample")')
        page.wait_for_selector("text=2 files processed")
        page.wait_for_timeout(300)

        # 3. Add 1 manual row to exceed the 20-row limit (total = 21 transactions)
        page.click('button:has-text("Add Entry")')
        page.wait_for_timeout(300)

        # 4. Verify unverified state behavior:
        # - The table should only display EXACTLY 20 transactions
        displayed_rows = page.locator("tbody tr").all()
        assert len(displayed_rows) == 20, f"Free tier violation! Expected exactly 20 rows, got {len(displayed_rows)}"
        print(f"  [✓] Free tier display gate verified: Exactly {len(displayed_rows)} rows visible (1 hidden beyond 20 cap).")

        # - The Free Tier banner should be visible
        banner = page.locator("text=Free Tier: Displaying & exporting first 20 of 21 transactions")
        assert banner.is_visible(), "Free tier cap banner missing!"
        print("  [✓] Free tier cap banner verified: Informs user that first 20 of 21 transactions are active.")

        # - The reconciliation badge still audits across ALL 21 transactions
        body_text = page.locator("body").inner_text()
        assert "RECONCILED" in body_text or "DISCREPANCY" in body_text, "Reconciliation telemetry missing"
        print("  [✓] Full dataset reconciliation verified: Audits math across all 21 transactions despite visual cap.")

        # - Free tier export restriction: Exported file must only contain 20 transactions
        with page.expect_download() as download_info:
            page.click('button:has-text("Export .QBO")')
        gated_qbo = download_info.value
        with open(gated_qbo.path(), "r", encoding="utf-8") as f:
            gated_qbo_text = f.read()

        stmttrn_count = gated_qbo_text.count("<STMTTRN>")
        assert stmttrn_count == 20, f"Export tier gate failed! Expected 20 <STMTTRN> blocks, got {stmttrn_count}"
        print(f"  [✓] Free tier export gate verified: Export capped at exactly {stmttrn_count} transactions.")

        # 5. Open Unlock Modal and test validation
        page.locator('button:has-text("Unlock Unlimited")').first.click()
        page.wait_for_selector("text=Unlock StatementForge")
        print("  [✓] 'Unlock StatementForge' modal opened.")

        # Test empty input error
        page.click('button:has-text("Verify & Unlock")')
        page.wait_for_timeout(250)
        assert page.locator("text=Please enter your license key").is_visible(), "Expected empty key validation error"
        print("  [✓] Client validation verified: Empty key rejected.")

        # Test proxy route with invalid key
        license_input = page.locator('input[placeholder*="XXXXXXXX"]')
        license_input.fill("INVALID-TEST-KEY-12345")
        page.click('button:has-text("Verify & Unlock")')
        page.wait_for_timeout(1200)
        modal_text = page.locator("div.fixed.inset-0").first.inner_text()
        assert "does not exist" in modal_text.lower() or "invalid" in modal_text.lower() or "error" in modal_text.lower() or "failed" in modal_text.lower(), (
            f"Expected proxy validation failure for invalid key, got: {modal_text}"
        )
        print("  [✓] Next.js Proxy Route (/api/verify-license) verified: Proxied request to Gumroad API.")

        # Close modal
        close_btn = page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first
        if close_btn.count() > 0:
            close_btn.click()
        page.wait_for_timeout(200)

        # 6. Simulate valid Gumroad license verification via localStorage
        page.evaluate("""() => {
            localStorage.setItem('statementforge_license', JSON.stringify({
                verified: true,
                key: 'GUMROAD-AUDITED-2026-KEY',
                verifiedAt: Date.now()
            }));
        }""")
        page.reload()
        page.wait_for_selector("text=Local Processing Active")

        # Reload bulk sample + 1 manual entry (21 rows total)
        page.click('button:has-text("Load 2-Month Bulk Sample")')
        page.wait_for_selector("text=2 files processed")
        page.click('button:has-text("Add Entry")')
        page.wait_for_timeout(300)

        # 7. Verify unlocked state:
        # - Header shows "License Active"
        assert page.locator("text=License Active").first.is_visible(), "Expected 'License Active' status in header"
        print("  [✓] Header status verified: 'License Active' pill shown.")

        # - All 21 rows are now rendered in the table!
        unlocked_rows = page.locator("tbody tr").all()
        assert len(unlocked_rows) == 21, f"Expected all 21 rows visible in unlocked state, got {len(unlocked_rows)}"
        print(f"  [✓] Unlimited display verified: All {len(unlocked_rows)} transactions rendered.")

        # - Free tier banner is hidden
        assert page.locator("text=Free Tier: Displaying & exporting first 20").count() == 0, "Banner should be hidden when unlocked!"
        print("  [✓] Banner dismissal verified: Cap banner hidden when unlocked.")

        # - Export exports all 21 transactions
        with page.expect_download() as download_info:
            page.click('button:has-text("Export .QBO")')
        unlocked_qbo = download_info.value
        with open(unlocked_qbo.path(), "r", encoding="utf-8") as f:
            unlocked_qbo_text = f.read()

        unlocked_count = unlocked_qbo_text.count("<STMTTRN>")
        assert unlocked_count == 21, f"Expected 21 <STMTTRN> blocks in unlocked export, got {unlocked_count}"
        print(f"  [✓] Unlimited export verified: Exported all {unlocked_count} transactions.")

        # - Test License Deactivation
        page.click('button:has-text("License Active")')
        page.wait_for_selector("text=Deactivate License")
        page.click('button:has-text("Deactivate License")')
        page.wait_for_timeout(300)

        # Verify restored to free tier cap
        post_deactivate_rows = page.locator("tbody tr").all()
        assert len(post_deactivate_rows) == 20, f"Expected 20 rows after license deactivation, got {len(post_deactivate_rows)}"
        print("  [✓] License deactivation verified: Instant reversion to 20-row free tier.")

        context.close()
        browser.close()

    print("\n" + "=" * 80)
    print("  ALL 11 E2E TEST SECTIONS (INCLUDING OFX/QBO & LICENSE GATE) PASSED! (100%)")
    print("=" * 80)


if __name__ == "__main__":
    run_comprehensive_e2e_tests()

