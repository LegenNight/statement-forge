'use strict';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Cpu,
  FileSpreadsheet,
  Download,
  Terminal,
  Check,
  ChevronRight,
  Layers,
  ExternalLink,
} from 'lucide-react';

export default function AssayStorefront() {
  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* 1. TOP NAVIGATION */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-stone-200/80 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-40 transition-all">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-semibold text-slate-900 text-xl tracking-tight">assay</span>
            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200">
              tools
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#tools" className="hover:text-slate-900 transition-colors">
              Tools
            </a>
            <a href="#architecture" className="hover:text-slate-900 transition-colors">
              Architecture
            </a>
            <a href="#pipeline" className="hover:text-slate-900 transition-colors">
              Pipeline
            </a>
            <a href="#privacy" className="hover:text-slate-900 transition-colors">
              Privacy
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-500 font-medium"
            title="All tools execute 100% in local browser memory"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero-Server Engine</span>
          </div>

          <Link
            href="/tools/statementforge"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 shadow-sm hover:shadow"
          >
            <span>Open StatementForge</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <main className="flex-1">
        <section className="relative px-6 sm:px-10 pt-20 pb-20 max-w-5xl mx-auto text-center">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-stone-200/90 shadow-2xs mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-600">
              Assay Suite • Local-First Financial Software
            </span>
          </div>

          {/* Exact Required Copy Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto leading-[1.12]">
            Small, exact tools for work that gets audited.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Financial reconciliations, regulatory statement conversions, and ledger preparations executed entirely in your browser memory. No cloud servers, no hallucinating LLMs, zero data retention.
          </p>

          {/* Primary CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/tools/statementforge"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span>Launch StatementForge</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#architecture"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium bg-white hover:bg-stone-100 text-slate-700 border border-stone-200 transition-colors duration-200"
            >
              <span>Audit Architecture</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Trust Metrics Bar */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-10 border-t border-stone-200 text-left">
            <div className="bg-white/60 p-5 rounded-2xl border border-stone-200/60 shadow-2xs">
              <div className="font-mono text-xl font-bold text-slate-900 tracking-tight">0 bytes</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Transmitted to servers</div>
              <div className="text-xs text-slate-500 mt-1 leading-normal">
                All parsing, OCR and math run inside local JavaScript memory.
              </div>
            </div>

            <div className="bg-white/60 p-5 rounded-2xl border border-stone-200/60 shadow-2xs">
              <div className="font-mono text-xl font-bold text-emerald-700 tracking-tight">$0.00</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Variance verification</div>
              <div className="text-xs text-slate-500 mt-1 leading-normal">
                Deterministic cent-precision math confirms balance integrity before export.
              </div>
            </div>

            <div className="bg-white/60 p-5 rounded-2xl border border-stone-200/60 shadow-2xs">
              <div className="font-mono text-xl font-bold text-amber-800 tracking-tight">Multi-Page</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Stitching & Sanitization</div>
              <div className="text-xs text-slate-500 mt-1 leading-normal">
                Eliminates repetitive bank headers and repairs broken across-page memos.
              </div>
            </div>
          </div>
        </section>

        {/* 3. FEATURED PRODUCT: STATEMENTFORGE */}
        <section id="tools" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-amber-800 font-medium">
                Active Production Tool
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">StatementForge</h2>
            </div>
            <Link
              href="/tools/statementforge"
              className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1 group"
            >
              <span>Open tool</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Product Showcase Card */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-[0_12px_40px_rgb(0,0,0,0.04)] border border-stone-200/80 transition-all hover:border-stone-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chase Business Checking Specialist</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                  Convert Chase Business PDFs to verified ledger rows in seconds.
                </h3>

                <p className="text-sm text-slate-600 leading-relaxed">
                  StatementForge extracts deposits, electronic withdrawals, and checks from standard Chase Business Checking PDFs. It continuously checks ledger debits and credits against your beginning and ending balances—guaranteeing a $0.00 mathematical variance before you export.
                </p>

                <div className="space-y-2.5 pt-2">
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Multi-Page Header Sanitization:</strong> Automatically filters repeated page banners, address lines, and pagination tags.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Clean Merchant Names:</strong> Normalizes POS junk text like <code>POS DEBIT 8421 SQUARE INC</code> into readable payees.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Standard Output Formats:</strong> Export one-click QuickBooks Online CSV, Xero CSV, 4-Column Ledger, or TSV for Excel.</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/tools/statementforge"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm hover:shadow"
                  >
                    <span>Open StatementForge</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/tools/statementforge"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Try Multi-Page Sample</span>
                  </Link>
                </div>
              </div>

              {/* Product Preview Mockup */}
              <div className="lg:col-span-5 bg-stone-50 rounded-2xl p-5 border border-stone-200/90 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 font-sans font-medium">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>chase_statement_oct2026.pdf</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-sans font-semibold">
                    ✓ Balanced
                  </span>
                </div>

                {/* Telemetry Mockup */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-slate-400 font-sans text-[10px]">Beginning</span>
                    <div className="font-bold text-slate-800 mt-0.5">$14,850.20</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-slate-400 font-sans text-[10px]">Ending</span>
                    <div className="font-bold text-slate-800 mt-0.5">$18,274.80</div>
                  </div>
                </div>

                {/* Ledger preview snippet */}
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs text-[11px]">
                  <div className="bg-stone-100/70 px-3 py-1.5 text-[10px] text-slate-500 font-sans uppercase font-medium border-b border-stone-200 flex justify-between">
                    <span>Payee</span>
                    <span>Amount</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    <div className="px-3 py-2 flex justify-between items-center">
                      <span className="text-slate-800 font-sans truncate pr-2">Stripe Payout</span>
                      <span className="text-emerald-700 font-semibold tabular-nums">+$4,250.00</span>
                    </div>
                    <div className="px-3 py-2 flex justify-between items-center">
                      <span className="text-slate-800 font-sans truncate pr-2">Google Cloud Platform</span>
                      <span className="text-slate-800 tabular-nums">-$1,840.50</span>
                    </div>
                    <div className="px-3 py-2 flex justify-between items-center">
                      <span className="text-slate-800 font-sans truncate pr-2">Office Depot</span>
                      <span className="text-slate-800 tabular-nums">-$245.90</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-sans text-center pt-1">
                  13 verified rows • 0 server roundtrips
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. ARCHITECTURE & PHILOSOPHY */}
        <section id="architecture" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto border-t border-stone-200">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-800 font-medium">
              Core Principles
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mt-2">
              Why Assay tools don’t touch the cloud.
            </h2>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Accounting records and bank statements are sensitive by definition. We built Assay on physical zero-retention architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-7 rounded-2xl border border-stone-200 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-slate-800 mb-5">
                <Cpu className="w-5 h-5 text-amber-800" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Deterministic Engine</h3>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                No LLM hallucinations or generative guesses. Every date, memo, and cent is parsed using rigid regular expressions and strict double-entry math.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-stone-200 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-slate-800 mb-5">
                <Lock className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Zero Cloud Uploads</h3>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                PDF text extraction and normalization execute entirely within Web Workers and browser memory. Your bank data never crosses a network cable.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-stone-200 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-slate-800 mb-5">
                <FileSpreadsheet className="w-5 h-5 text-slate-800" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Audit-Ready Ledger</h3>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                Immediate reconciliation validation ensures Beginning + In - Out matches your statement’s printed ending balance before you push to QuickBooks or Xero.
              </p>
            </div>
          </div>
        </section>

        {/* 5. ROADMAP / PIPELINE */}
        <section id="pipeline" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto border-t border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-amber-800 font-medium">
                The Assay Pipeline
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Upcoming audit utilities</h2>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Single-purpose precision calculators for compliance officers, CPAs, and financial operators.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tool 02 */}
            <div className="bg-white/80 p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-slate-400">TOOL 02</span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold">
                  In Development
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">StripeLedger</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Deterministic gross payout, transaction fee, and reserve hold reconciler for automated 1099-K reporting and bookkeeping matching.
              </p>
            </div>

            {/* Tool 03 */}
            <div className="bg-white/80 p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-slate-400">TOOL 03</span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200 font-semibold">
                  Planned
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">InvoiceAudit</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Cross-jurisdictional tax reverse-charge and multi-currency exchange rate auditor for international SaaS accounts payable.
              </p>
            </div>
          </div>
        </section>

        {/* 6. BOTTOM PRIVACY BANNER */}
        <section id="privacy" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Server Upload Guarantee</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Ready to parse your Chase business statement?
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                Open StatementForge right now. No sign-up, no credit card, and no backend data transmission.
              </p>
            </div>

            <Link
              href="/tools/statementforge"
              className="shrink-0 flex items-center gap-2 px-6 py-3.5 rounded-full text-xs font-bold bg-white text-slate-900 hover:bg-stone-100 transition-all shadow-md hover:shadow-lg"
            >
              <span>Open StatementForge</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* 7. MINIMAL ASSAY FOOTER */}
      <footer className="bg-white border-t border-stone-200 py-8 px-6 sm:px-10 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 tracking-tight">assay</span>
            <span className="text-stone-300">•</span>
            <span>Small, exact tools for work that gets audited.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/tools/statementforge" className="hover:text-slate-900 transition-colors">
              StatementForge
            </Link>
            <span className="text-stone-300">•</span>
            <span className="font-mono text-[11px] text-slate-400">100% Client-Side Memory</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
