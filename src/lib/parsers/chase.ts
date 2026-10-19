'use strict';

import {
  BankParser,
  ParsedTransaction,
  ReconciliationResult,
  StatementParseResult,
  StatementSummary,
  StatementMetadata,
  TransactionType,
} from '../types';

/**
 * Strips noise, bank routing codes, store IDs, and transaction prefixes
 * to produce clean merchant names for QuickBooks and Xero.
 */
export function cleanPayeeName(originalMemo: string, type: TransactionType, checkNumber?: string): string {
  if (type === 'CHECK' && checkNumber) {
    return `Check #${checkNumber}`;
  }

  let text = originalMemo.trim();

  // If starts with check memo
  if (/^CHECK\s*#?\s*\d+/i.test(text)) {
    const m = text.match(/^CHECK\s*#?\s*(\d+)/i);
    return m ? `Check #${m[1]}` : text;
  }

  // Remove common banking prefixes
  text = text.replace(/^SQ\s*\*?\s*/i, ''); // Square
  text = text.replace(/^AMZN\s+MKTPLACE(\s+PMTS)?(\s*\*[\w\-]+|\s+)?/i, 'Amazon Marketplace ');
  text = text.replace(/^AMAZON\.COM(\s*\*[\w\-]+|\s+)?/i, 'Amazon ');
  text = text.replace(/^ACH\s+(DEBIT|CREDIT)(\s*-\s*|\s+)?/i, '');
  text = text.replace(/^CARD\s+PURCHASE(\s+\d{2}\/\d{2})?\s*/i, '');
  text = text.replace(/^ZELLE\s+PAYMENT\s+FROM\s+/i, '');
  text = text.replace(/^DEPOSIT\s*-\s*MOBILE\s+CHECK\s+\d+\s*/i, '');
  text = text.replace(/^PAYPAL\s+(INST\s+XFER|DES:.*|TRANSFER)?\s*/i, 'PayPal ');
  text = text.replace(/^WIRE\s+TRANSFER\s+(INCOMING|OUTGOING)?\s*/i, '');
  text = text.replace(/^CLIENT\s+RETAINER\s+(DIRECT\s+DEPOSIT)?\s*/i, '');
  text = text.replace(/^DIRECT\s+DEPOSIT\s*/i, '');
  text = text.replace(/^DEBIT\s+CARD\s+PURCHASE(\s*-\s*|\s+)?/i, '');

  if (/Amazon Marketplace/i.test(text) || /AMZN\s+MKTP/i.test(text)) {
    return 'Amazon';
  }

  // Specific merchant patterns
  if (/STRIPE/i.test(text)) return 'Stripe';
  if (/ADOBE/i.test(text)) return 'Adobe';
  if (/FIGMA/i.test(text)) return 'Figma';
  if (/QUICKBOOKS/i.test(text)) return 'QuickBooks';
  if (/STAPLES/i.test(text)) return 'Staples';
  if (/DOORDASH/i.test(text)) return 'DoorDash';
  if (/UBER/i.test(text)) return 'Uber';
  if (/ZOOM/i.test(text)) return 'Zoom';
  if (/NOTION/i.test(text)) return 'Notion';
  if (/FACEBK/i.test(text)) return 'Facebook Ads';
  if (/PAYPAL/i.test(text)) return 'PayPal';
  if (/DELTA\s+AIR/i.test(text)) return 'Delta Air Lines';
  if (/INTEREST\s+PAYMENT/i.test(text)) return 'Interest Payment';
  if (/MONTHLY\s+SERVICE\s+FEE/i.test(text)) return 'Monthly Service Fee';
  if (/AWS\s+CLOUD\s+SERVICES/i.test(text)) return 'AWS Cloud Services';
  if (/GOOGLE/i.test(text)) return 'Google Workspace';
  if (/GUSTO/i.test(text)) return 'Gusto Payroll';
  if (/GITHUB/i.test(text)) return 'GitHub Inc';
  if (/VERCEL/i.test(text)) return 'Vercel';
  if (/OFFICE\s+DEPOT/i.test(text)) return 'Office Depot';
  if (/ACME\s+CORP/i.test(text)) return 'Acme Corp';
  if (/METRO\s+DIGITAL/i.test(text)) return 'Metro Digital';

  // Remove reference codes, invoice suffixes, store IDs
  text = text.replace(/STORE\s*#?\d+/gi, '');
  text = text.replace(/#\d+/g, '');
  text = text.replace(/\bST-[A-Z0-9]+\b/gi, '');
  text = text.replace(/\bPE-[A-Z0-9]+\b/gi, '');
  text = text.replace(/\b\*[A-Z0-9]{4,}\b/gi, '');
  text = text.replace(/\b[A-Z0-9]{8,}\b/gi, '');
  text = text.replace(/\b(SEATTLE|NEW YORK|COLUMBUS|SAN FRANCISCO|AUSTIN|ATLANTA|MEMPHIS)\s+[A-Z]{2}\b/gi, '');
  text = text.replace(/\bINVOICE\s+\d+\b/gi, '');
  text = text.replace(/\b(BILLING|WEB SERVICES|MONTHLY CHARGE|SUPPLY ORDER|PLATFORM HOSTING|TAXES & SALARY|ENTERPRISE SEATS)\b/gi, '');

  // Strip trailing whitespace, punctuation, and normalize spaces
  text = text.replace(/[*_#\-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // If empty after stripping, fall back to cleaned original
  if (!text) {
    text = originalMemo.trim();
  }

  // Title case words, keeping known acronyms uppercase
  const acronyms = new Set(['AWS', 'AI', 'API', 'GUSTO', 'AMZN', 'ACH', 'ID', 'LLC', 'INC', 'CORP', 'PC', 'US', 'USA']);
  const words = text.split(' ').map((w) => {
    const upper = w.toUpperCase();
    if (acronyms.has(upper)) return upper;
    if (w.length <= 2 && upper === w) return upper;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return words.join(' ');
}

/**
 * Normalizes a currency or amount string against PDF.js text-layer formatting errors:
 * 1. Strips all commas entirely.
 * 2. If a string contains multiple periods (e.g. misreading a thousands comma as a decimal),
 *    removes all but the very last period.
 */
export function normalizeCurrencyString(raw: string | number): string {
  if (typeof raw === 'number') {
    return isNaN(raw) ? '0.00' : raw.toFixed(2);
  }
  if (!raw || typeof raw !== 'string') {
    return '0.00';
  }

  let str = raw.trim();

  // Detect negative signs (e.g. -123, -$123, or accounting parens (123))
  const isNegative = str.startsWith('-') || /^\(.*\)$/.test(str) || str.endsWith('-');

  // Remove currency symbols, spaces, parentheses, negative signs
  str = str.replace(/[$,\s()\-]/g, '');

  // Strip separators: Remove all commas entirely
  str = str.replace(/,/g, '');

  // If a string contains multiple periods, remove all but the very last period
  const lastDotIndex = str.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    const beforeLastDot = str.substring(0, lastDotIndex).replace(/\./g, '');
    const afterLastDot = str.substring(lastDotIndex + 1);
    str = beforeLastDot + '.' + afterLastDot;
  }

  if (!str || str === '.') {
    return '0.00';
  }

  return isNegative ? `-${str}` : str;
}

/**
 * Parse an amount string into a normalized floating point number.
 * e.g., "$14,850.20" -> 14850.2
 * e.g., "1.234.56" -> 1234.56
 */
export function parseCurrency(str: string | number): number {
  if (typeof str === 'number') {
    return isNaN(str) ? 0 : Math.round(str * 100) / 100;
  }
  if (!str) return 0;
  const normalized = normalizeCurrencyString(str);
  const val = parseFloat(normalized);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/**
 * Format number to standard accounting string: "$14,850.20"
 */
export function formatCurrency(amount: number, showSign: boolean = false): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (showSign) {
    if (amount > 0) return `+$${formatted}`;
    if (amount < 0) return `-$${formatted}`;
    return `$${formatted}`;
  }

  return isNeg ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Detect redundant headers, footers, address blocks, and page breaks that repeat on pages 2+
 */
export function isRedundantHeaderOrFooter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^---PAGE_BREAK---$/i.test(trimmed)) return true;
  if (/^Page\s+\d+(\s+of\s+\d+)?$/i.test(trimmed)) return true;
  if (/JPMorgan Chase Bank/i.test(trimmed)) return true;
  if (/^P\s*O\s*Box\s*\d+/i.test(trimmed)) return true;
  if (/^Columbus\s+OH\s+[\d\-]+/i.test(trimmed)) return true;
  if (/^CHASE BUSINESS (COMPLETE )?CHECKING$/i.test(trimmed)) return true;
  if (/Account Number:\s*(\d{9,12}|\.{3,}\d{4}|[0-9]{4,16})/i.test(trimmed)) return true;
  if (/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})\s+(?:through|to|-)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})/i.test(trimmed)) return true;
  if (/^(DATE\s+DESCRIPTION|CHECK NO\.\s+DATE PAID|DATE\s+AMOUNT)/i.test(trimmed)) return true;
  if (/^DATE\b.*AMOUNT\b/i.test(trimmed)) return true;
  if (/^CHECK NO\b/i.test(trimmed)) return true;
  if (/^TRANSACTION DETAILS?(\s*\(continued\))?$/i.test(trimmed)) return true;
  if (/Sample statement with fictional data/i.test(trimmed)) return true;
  if (/Deposits and credits are shown as positive amounts/i.test(trimmed)) return true;
  return false;
}

/**
 * Core Chase Business Statement Parser
 */
export function parseChaseStatement(rawText: string, sourceFileName: string = 'chase_statement.pdf'): StatementParseResult {
  const lines = rawText.split(/\r?\n/);

  // 1. Metadata Extraction
  let accountNumber = '0000000000';
  let statementPeriod = '';
  let startDate = '';
  let endDate = '';
  let statementType = 'Chase Business Complete Checking';

  const acctMatch = rawText.match(/Account Number:\s*(\d{9,12}|\.{3,}\d{4}|[0-9]{4,16})/i);
  if (acctMatch) {
    accountNumber = acctMatch[1].trim();
  }

  const periodMatch = rawText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})\s+(?:through|to|-)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})/i);
  if (periodMatch) {
    startDate = periodMatch[1].trim();
    endDate = periodMatch[2].trim();
    statementPeriod = `${startDate} \u2013 ${endDate}`;
  } else {
    statementPeriod = 'Current Period';
  }

  if (/CHASE BUSINESS COMPLETE CHECKING/i.test(rawText)) {
    statementType = 'Chase Business Complete Checking';
  } else if (/CHASE TOTAL BUSINESS CHECKING/i.test(rawText)) {
    statementType = 'Chase Total Business Checking';
  }

  // 2. Summary Block Extraction
  let beginningBalance = 0;
  let totalDeposits = 0;
  let totalElectronicWithdrawals = 0;
  let checksPaid = 0;
  let endingBalance = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/Beginning Balance/i.test(line)) {
      const match = line.match(/Beginning Balance:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) beginningBalance = parseCurrency(match[1]);
    } else if (/Deposits and Additions/i.test(line) && !/DATE\s+DESCRIPTION/i.test(line)) {
      const match = line.match(/Deposits and Additions:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) totalDeposits = Math.abs(parseCurrency(match[1]));
    } else if (/Electronic Withdrawals/i.test(line) && !/DATE\s+DESCRIPTION/i.test(line)) {
      const match = line.match(/Electronic Withdrawals:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) totalElectronicWithdrawals += Math.abs(parseCurrency(match[1]));
    } else if (/(ATM\s*&\s*Debit Card Withdrawals|Other Withdrawals)/i.test(line)) {
      const match = line.match(/(?:ATM\s*&\s*Debit Card Withdrawals|Other Withdrawals):?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) totalElectronicWithdrawals += Math.abs(parseCurrency(match[1]));
    } else if (/^Fees:?\s*/i.test(line.trim())) {
      const match = line.match(/Fees:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) totalElectronicWithdrawals += Math.abs(parseCurrency(match[1]));
    } else if (/Checks Paid/i.test(line) && !/CHECK NO\./i.test(line)) {
      const match = line.match(/Checks Paid:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) checksPaid = Math.abs(parseCurrency(match[1]));
    } else if (/Ending Balance/i.test(line) && !/DAILY ENDING BALANCE/i.test(line)) {
      const match = line.match(/Ending Balance:?\s*(-?\$?\s*-?[0-9.,]*\d[0-9.,]*)/i);
      if (match) endingBalance = parseCurrency(match[1]);
    }
  }

  // ─── 3. Transaction Extraction Engine ───────────────────────────────────────
  //
  // Two-phase approach:
  //
  // Phase A — Named-section fast path (handles standard categorised Chase layouts):
  //   Recognises "DEPOSITS AND ADDITIONS", "ELECTRONIC WITHDRAWALS", "CHECKS PAID",
  //   and "TRANSACTION DETAIL" section headers and uses a state machine to route
  //   each row into the correct transaction type with maximum precision.
  //
  // Phase B — Dynamic table discovery (fallback for any other layout):
  //   If Phase A produces zero rows, scans the document for the first line that
  //   looks like a transaction row (MM/DD … currency), walks back up to 5 lines
  //   to fuzzy-map column positions from the nearest header, then streams rows
  //   until a resilient summary-keyword boundary is hit.

  const transactions: ParsedTransaction[] = [];
  let txCounter = 1;
  let activeTx: ParsedTransaction | null = null;

  // Resilient stop-boundary keywords for both phases
  const SUMMARY_STOP_RE = /\b(ENDING\s+BALANCE|DAILY\s+ENDING|BEGINNING\s+BALANCE|TOTAL\s+DEPOSITS|TOTAL\s+WITHDRAWALS|SERVICE\s+CHARGE|FEES\s+PAID|SUMMARY|SUBTOTAL|ACCOUNT\s+ACTIVITY\s+SUMMARY)\b/i;

  function commitActiveTx() {
    if (activeTx) {
      activeTx.cleanPayee = cleanPayeeName(activeTx.originalMemo, activeTx.type, activeTx.checkNumber);
      transactions.push(activeTx);
      activeTx = null;
    }
  }

  /**
   * Infer CREDIT / DEBIT / CHECK from memo text and amount sign.
   * sectionHint is 'DEPOSITS' | 'WITHDRAWALS' | 'CHECKS' | 'DYNAMIC'
   */
  function classifyRow(
    memo: string,
    rawAmtStr: string,
    sectionHint: 'DEPOSITS' | 'WITHDRAWALS' | 'CHECKS' | 'DYNAMIC'
  ): { txType: TransactionType; txSection: string } {
    if (sectionHint === 'DEPOSITS') return { txType: 'CREDIT', txSection: 'Deposits and Additions' };
    if (sectionHint === 'WITHDRAWALS') return { txType: 'DEBIT', txSection: 'Electronic Withdrawals' };
    if (sectionHint === 'CHECKS') return { txType: 'CHECK', txSection: 'Checks Paid' };

    // 1. If memo contains "Deposit" (case-insensitive), strictly force type to CREDIT before checking for Check or #
    if (/deposit/i.test(memo)) {
      return { txType: 'CREDIT', txSection: 'Deposits and Additions' };
    }

    const isNeg = rawAmtStr.startsWith('-') || /^\(/.test(rawAmtStr) || rawAmtStr.endsWith('-');
    const checkMatch = memo.match(/\bCHECK\s*(?:NO\.?|#)?\s*(\d+)\b/i);

    if (checkMatch) return { txType: 'CHECK', txSection: 'Checks Paid' };
    if (isNeg) return { txType: 'DEBIT', txSection: 'Electronic Withdrawals' };
    if (
      rawAmtStr.startsWith('+') ||
      /(?:DIRECT\s+DEPOSIT|MOBILE\s+DEPOSIT|ATM\s+DEPOSIT|\bDEPOSIT\b|\bCREDIT\b|\bREFUND\b|INTEREST|TRANSFER\s+IN|CLIENT\s+RETAINER|INCOMING|PAYMENT\s+FROM|\bZELLE\b)/i.test(memo)
    ) {
      return { txType: 'CREDIT', txSection: 'Deposits and Additions' };
    }
    if (/(?:\bDEBIT\b|\bWITHDRAWAL\b|\bPURCHASE\b|PAYMENT\s+TO|\bFEE\b|\bCHARGE\b|PAYROLL|OUTGOING|TRANSFER\s+TO)/i.test(memo)) {
      return { txType: 'DEBIT', txSection: 'Electronic Withdrawals' };
    }
    return { txType: 'CREDIT', txSection: 'Deposits and Additions' };
  }

  // ── Phase A: Named-section fast path ─────────────────────────────────────────
  type CurrentSection = 'NONE' | 'DEPOSITS' | 'WITHDRAWALS' | 'CHECKS' | 'TRANSACTION_DETAIL';
  let currentSection: CurrentSection = 'NONE';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Section header transitions
    if (/^DEPOSITS AND ADDITIONS/i.test(trimmed)) {
      commitActiveTx(); currentSection = 'DEPOSITS'; continue;
    } else if (/^CHECKS PAID/i.test(trimmed)) {
      commitActiveTx(); currentSection = 'CHECKS'; continue;
    } else if (/^ELECTRONIC WITHDRAWALS/i.test(trimmed)) {
      commitActiveTx(); currentSection = 'WITHDRAWALS'; continue;
    } else if (/^TRANSACTION DETAILS?/i.test(trimmed)) {
      commitActiveTx(); currentSection = 'TRANSACTION_DETAIL'; continue;
    } else if (
      /^DAILY ENDING BALANCE/i.test(trimmed) ||
      /^SERVICE CHARGE SUMMARY/i.test(trimmed) ||
      /^FEES PAID/i.test(trimmed) ||
      (SUMMARY_STOP_RE.test(trimmed) && !/^(Beginning|Deposits and|Electronic|Checks Paid|Ending)/i.test(trimmed))
    ) {
      commitActiveTx(); currentSection = 'NONE'; continue;
    }

    if (currentSection === 'NONE') continue;
    if (isRedundantHeaderOrFooter(trimmed)) continue;
    if (/^(DATE\s+DESCRIPTION|CHECK NO\.\s+DATE PAID)/i.test(trimmed)) continue;

    // CHECKS PAID and TRANSACTION_DETAIL: check-number rows (CHECKNO  DATE  MEMO  AMT)
    if (currentSection === 'CHECKS' || currentSection === 'TRANSACTION_DETAIL') {
      const crm = trimmed.match(/^(\d{3,6})\s+(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9.,]*\d[0-9.,]*)$/);
      if (crm) {
        commitActiveTx();
        const [, checkNum, dateStr, desc, amtRaw] = crm;
        const rawAmt = Math.abs(parseCurrency(amtRaw));
        activeTx = {
          id: `tx_${txCounter++}`, date: dateStr, rawDate: dateStr,
          type: 'CHECK', cleanPayee: `Check #${checkNum}`,
          originalMemo: desc.trim() || `Check #${checkNum}`,
          amount: -rawAmt, rawAmount: rawAmt, checkNumber: checkNum,
          section: 'Checks Paid', lineNumber: i + 1,
          bankId: 'CHASE', bankName: 'JPMorgan Chase', sourceFile: sourceFileName,
        };
        commitActiveTx();
        continue;
      }
    }

    // Standard date-rows (DATE  MEMO  AMOUNT  [RUNNING_BALANCE])
    const rowWithBalance = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9,.]+\.[0-9]{2})\s+(-?\$?[0-9,.]+\.[0-9]{2})$/);
    const rowSingle      = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9.,]*\d[0-9.,]*)$/);
    const dateMatch = rowWithBalance || rowSingle;

    if (dateMatch) {
      commitActiveTx();
      const dateStr   = dateMatch[1];
      let   memo      = dateMatch[2].replace(/\s*-$/, '').trim();
      let   rawAmtStr = dateMatch[3].trim();
      if (dateMatch[2].trim().endsWith('-') && !rawAmtStr.startsWith('-')) {
        rawAmtStr = '-' + rawAmtStr;
      }
      const rawAmt    = Math.abs(parseCurrency(rawAmtStr));

      const hint: 'DEPOSITS' | 'WITHDRAWALS' | 'CHECKS' | 'DYNAMIC' =
        currentSection === 'DEPOSITS' ? 'DEPOSITS' :
        currentSection === 'WITHDRAWALS' ? 'WITHDRAWALS' :
        currentSection === 'CHECKS' ? 'CHECKS' : 'DYNAMIC';

      const { txType, txSection } = classifyRow(memo, rawAmtStr, hint);
      const checkMatch = txType === 'CHECK' ? memo.match(/\bCHECK\s*#?\s*(\d+)\b/i) : null;

      activeTx = {
        id: `tx_${txCounter++}`, date: dateStr, rawDate: dateStr,
        type: txType, cleanPayee: checkMatch ? `Check #${checkMatch[1]}` : '',
        originalMemo: memo,
        amount: txType === 'CREDIT' ? rawAmt : -rawAmt, rawAmount: rawAmt,
        checkNumber: checkMatch ? checkMatch[1] : undefined,
        section: txSection, lineNumber: i + 1,
        bankId: 'CHASE', bankName: 'JPMorgan Chase', sourceFile: sourceFileName,
      };
      continue;
    }

    // Multi-line memo continuation
    if (activeTx && !isRedundantHeaderOrFooter(trimmed)) {
      activeTx.originalMemo += ' ' + trimmed;
    }
  }

  commitActiveTx();
  console.log('[ChaseParser] Extracted transactions.length after Phase A:', transactions.length);

  // ── Phase B: Dynamic table discovery (runs only when Phase A found nothing) ──
  //
  // Step 1 — Scan for the first line that looks like a transaction row.
  // Step 2 — Walk back up to 5 lines and fuzzy-map column positions from the
  //          nearest header row (DATE, DESCRIPTION/MEMO, AMOUNT).
  // Step 3 — Stream extraction forward, stopping on any summary-keyword boundary.
  //
  if (transactions.length === 0) {
    // Canonical transaction date at line start
    const TX_DATE_RE = /^\d{2}\/\d{2}\b/;
    // Any currency-looking token anywhere on the line
    const CURRENCY_TOKEN_RE = /\$?[0-9]{1,3}(?:[,.][0-9]{3})*(?:\.[0-9]{2})/;

    // Step 1 — find first transaction line
    let firstTxLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (TX_DATE_RE.test(t) && CURRENCY_TOKEN_RE.test(t) && !isRedundantHeaderOrFooter(t)) {
        firstTxLine = i;
        break;
      }
    }

    if (firstTxLine !== -1) {
      // Step 2 — fuzzy column mapping
      let descColIdx = -1;
      let amtColIdx  = -1;

      for (let h = firstTxLine - 1; h >= Math.max(0, firstTxLine - 5); h--) {
        const headerLine  = lines[h];
        const headerUpper = headerLine.toUpperCase();
        const amtIdx = Math.max(
          headerUpper.lastIndexOf('AMOUNT'),
          headerUpper.lastIndexOf('DEBIT'),
          headerUpper.lastIndexOf('CREDIT'),
        );
        const descIdx = Math.max(
          headerUpper.indexOf('DESCRIPTION'),
          headerUpper.indexOf('DETAIL'),
          headerUpper.indexOf('MEMO'),
        );
        if (amtIdx !== -1) {
          amtColIdx  = amtIdx;
          descColIdx = descIdx !== -1 ? descIdx : -1;
          break;
        }
      }

      // Step 3 — dynamic extraction with resilient boundary
      let dynTx: ParsedTransaction | null = null;

      function commitDynTx() {
        if (dynTx) {
          dynTx.cleanPayee = cleanPayeeName(dynTx.originalMemo, dynTx.type, dynTx.checkNumber);
          transactions.push(dynTx);
          dynTx = null;
        }
      }

      for (let i = firstTxLine; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed) continue;

        // Resilient stop on summary keywords
        if (SUMMARY_STOP_RE.test(trimmed)) { commitDynTx(); break; }
        if (isRedundantHeaderOrFooter(trimmed)) continue;
        if (/^(DATE|CHECK NO\.)/i.test(trimmed) && !/\d{2}\/\d{2}/.test(trimmed)) continue;

        // Check-number rows
        const crm = trimmed.match(/^(\d{3,6})\s+(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9.,]*\d[0-9.,]*)$/);
        if (crm) {
          commitDynTx();
          const [, checkNum, dateStr, desc, amtRaw] = crm;
          const rawAmt = Math.abs(parseCurrency(amtRaw));
          dynTx = {
            id: `tx_${txCounter++}`, date: dateStr, rawDate: dateStr,
            type: 'CHECK', cleanPayee: `Check #${checkNum}`,
            originalMemo: desc.trim() || `Check #${checkNum}`,
            amount: -rawAmt, rawAmount: rawAmt, checkNumber: checkNum,
            section: 'Checks Paid', lineNumber: i + 1,
            bankId: 'CHASE', bankName: 'JPMorgan Chase', sourceFile: sourceFileName,
          };
          commitDynTx();
          continue;
        }

        // Standard date-rows
        const rowWithBalance = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9,.]+\.[0-9]{2})\s+(-?\$?[0-9,.]+\.[0-9]{2})$/);
        const rowSingle      = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9.,]*\d[0-9.,]*)$/);
        const dateMatch = rowWithBalance || rowSingle;

        if (dateMatch) {
          commitDynTx();
          const dateStr   = dateMatch[1];
          let   memo      = dateMatch[2].replace(/\s*-$/, '').trim();
          let   rawAmtStr = dateMatch[3].trim();
          if (dateMatch[2].trim().endsWith('-') && !rawAmtStr.startsWith('-')) {
            rawAmtStr = '-' + rawAmtStr;
          }
          const rawAmt    = Math.abs(parseCurrency(rawAmtStr));

          // Refine memo using fuzzy column map (fixed-width PDF layouts)
          if (descColIdx >= 0 && amtColIdx > descColIdx && rawLine.length > amtColIdx) {
            const candidate = rawLine.substring(descColIdx, amtColIdx).trim();
            if (candidate.length > 2) memo = candidate.replace(/\s*-$/, '').trim();
          }

          const { txType, txSection } = classifyRow(memo, rawAmtStr, 'DYNAMIC');
          const checkMatch = txType === 'CHECK' ? memo.match(/\bCHECK\s*#?\s*(\d+)\b/i) : null;

          dynTx = {
            id: `tx_${txCounter++}`, date: dateStr, rawDate: dateStr,
            type: txType, cleanPayee: checkMatch ? `Check #${checkMatch[1]}` : '',
            originalMemo: memo,
            amount: txType === 'CREDIT' ? rawAmt : -rawAmt, rawAmount: rawAmt,
            checkNumber: checkMatch ? checkMatch[1] : undefined,
            section: txSection, lineNumber: i + 1,
            bankId: 'CHASE', bankName: 'JPMorgan Chase', sourceFile: sourceFileName,
          };
          continue;
        }

        // Multi-line memo continuation
        if (dynTx && !isRedundantHeaderOrFooter(trimmed)) {
          dynTx.originalMemo += ' ' + trimmed;
        }
      }

      commitDynTx();
    }
  }
  console.log('[ChaseParser] Extracted transactions.length after Phase B:', transactions.length);

  // 4. Mathematical Reconciliation Engine
  const parsedCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const parsedDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const parsedChecks = transactions
    .filter((t) => t.type === 'CHECK')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const creditsForRecon = totalDeposits > 0 ? totalDeposits : parsedCredits;
  const debitsForRecon = totalElectronicWithdrawals > 0 ? totalElectronicWithdrawals : parsedDebits;
  const checksForRecon = checksPaid > 0 ? checksPaid : parsedChecks;
  const expectedEnding = endingBalance !== 0 ? endingBalance : beginningBalance + creditsForRecon - debitsForRecon - checksForRecon;

  const calculatedEnding = Math.round((beginningBalance + parsedCredits - parsedDebits - parsedChecks) * 100) / 100;
  const totalDiscrepancy = Math.round((calculatedEnding - expectedEnding) * 100) / 100;
  const isBalanced = Math.abs(totalDiscrepancy) < 0.01;

  const flaggedRowIndices: number[] = [];
  if (!isBalanced) {
    transactions.forEach((tx, idx) => {
      if (tx.rawAmount <= 0) {
        tx.isFlagged = true;
        flaggedRowIndices.push(idx);
      }
    });
  }

  const reconciliation: ReconciliationResult = {
    status: isBalanced ? 'BALANCED' : 'MISMATCH',
    diff: isBalanced ? 0.0 : totalDiscrepancy,
    beginningBalance,
    totalCredits: parsedCredits,
    totalDebits: parsedDebits,
    totalChecks: parsedChecks,
    calculatedEnding,
    statementEnding: expectedEnding,
    flaggedRowIndices,
    details: isBalanced
      ? 'All transactions reconcile with beginning and ending statement balances to the cent.'
      : `Discrepancy of ${formatCurrency(totalDiscrepancy, true)} detected between statement summary and transaction ledger.`,
  };

  const metadata: StatementMetadata = {
    bankId: 'CHASE',
    bankName: 'JPMorgan Chase',
    accountNumber,
    statementPeriod,
    startDate,
    endDate,
    statementType,
    fileCount: 1,
    sourceFiles: [sourceFileName],
  };

  const summary: StatementSummary = {
    beginningBalance,
    totalDeposits: creditsForRecon,
    totalElectronicWithdrawals: debitsForRecon,
    checksPaid: checksForRecon,
    endingBalance: expectedEnding,
  };

  return {
    metadata,
    summary,
    transactions,
    reconciliation,
    rawText,
    bankId: 'CHASE',
  };
}

export const chaseParser: BankParser = {
  bankId: 'CHASE',
  bankName: 'JPMorgan Chase',
  detect(first1000Chars: string): boolean {
    return /(JPMorgan Chase|Chase Business)/i.test(first1000Chars);
  },
  parse(rawText: string, sourceFileName?: string): StatementParseResult {
    return parseChaseStatement(rawText, sourceFileName);
  },
};
