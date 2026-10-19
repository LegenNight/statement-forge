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
  text = text.replace(/^PAYPAL\s+(INST\s+XFER|DES:.*|TRANSFER)?\s*/i, 'PayPal ');
  text = text.replace(/^WIRE\s+TRANSFER\s+(INCOMING|OUTGOING)?\s*/i, '');
  text = text.replace(/^CLIENT\s+RETAINER\s+(DIRECT\s+DEPOSIT)?\s*/i, '');
  text = text.replace(/^DIRECT\s+DEPOSIT\s*/i, '');
  text = text.replace(/^DEBIT\s+CARD\s+PURCHASE(\s*-\s*|\s+)?/i, '');

  if (/Amazon Marketplace/i.test(text)) {
    return 'Amazon Marketplace';
  }

  // Specific merchant patterns
  if (/STRIPE\s+PAYMENTS/i.test(text)) {
    return 'Stripe';
  }
  if (/AWS\s+CLOUD\s+SERVICES/i.test(text)) {
    return 'AWS Cloud Services';
  }
  if (/GOOGLE\s+WORKSPACE/i.test(text)) {
    return 'Google Workspace';
  }
  if (/GUSTO\s+PAYROLL/i.test(text)) {
    return 'Gusto Payroll';
  }
  if (/GITHUB/i.test(text)) {
    return 'GitHub Inc';
  }
  if (/VERCEL/i.test(text)) {
    return 'Vercel';
  }
  if (/OFFICE\s+DEPOT/i.test(text)) {
    return 'Office Depot';
  }
  if (/ACME\s+CORP/i.test(text)) {
    return 'Acme Corp';
  }
  if (/METRO\s+DIGITAL/i.test(text)) {
    return 'Metro Digital';
  }

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

  // Account Number: Match /Account Number:\s*(\d{9,12}|\.{3,}\d{4})/i
  const acctMatch = rawText.match(/Account Number:\s*(\d{9,12}|\.{3,}\d{4}|[0-9]{4,16})/i);
  if (acctMatch) {
    accountNumber = acctMatch[1].trim();
  }

  // Statement Period: Extract Start Date and End Date
  const periodMatch = rawText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})\s+(?:through|to|-)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})/i);
  if (periodMatch) {
    startDate = periodMatch[1].trim();
    endDate = periodMatch[2].trim();
    statementPeriod = `${startDate} – ${endDate}`;
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
      const match = line.match(/Beginning Balance:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (match) beginningBalance = parseCurrency(match[1]);
    } else if (/Deposits and Additions/i.test(line) && !/DATE\s+DESCRIPTION/i.test(line)) {
      const match = line.match(/Deposits and Additions:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (match) totalDeposits = parseCurrency(match[1]);
    } else if (/Electronic Withdrawals/i.test(line) && !/DATE\s+DESCRIPTION/i.test(line)) {
      const match = line.match(/Electronic Withdrawals:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (match) totalElectronicWithdrawals = parseCurrency(match[1]);
    } else if (/Checks Paid/i.test(line) && !/CHECK NO\./i.test(line)) {
      const match = line.match(/Checks Paid:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (match) checksPaid = parseCurrency(match[1]);
    } else if (/Ending Balance/i.test(line) && !/DAILY ENDING BALANCE/i.test(line)) {
      const match = line.match(/Ending Balance:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (match) endingBalance = parseCurrency(match[1]);
    }
  }

  // 3. Section-Based Transaction Parsing
  const transactions: ParsedTransaction[] = [];
  type CurrentSection = 'NONE' | 'DEPOSITS' | 'WITHDRAWALS' | 'CHECKS';
  let currentSection: CurrentSection = 'NONE';
  let activeTx: ParsedTransaction | null = null;
  let txCounter = 1;

  function commitActiveTx() {
    if (activeTx) {
      activeTx.cleanPayee = cleanPayeeName(activeTx.originalMemo, activeTx.type, activeTx.checkNumber);
      transactions.push(activeTx);
      activeTx = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    // Section header detection
    if (/^DEPOSITS AND ADDITIONS/i.test(trimmed)) {
      commitActiveTx();
      currentSection = 'DEPOSITS';
      continue;
    } else if (/^CHECKS PAID/i.test(trimmed)) {
      commitActiveTx();
      currentSection = 'CHECKS';
      continue;
    } else if (/^ELECTRONIC WITHDRAWALS/i.test(trimmed)) {
      commitActiveTx();
      currentSection = 'WITHDRAWALS';
      continue;
    } else if (
      /^DAILY ENDING BALANCE/i.test(trimmed) ||
      /^SERVICE CHARGE SUMMARY/i.test(trimmed) ||
      /^FEES PAID/i.test(trimmed)
    ) {
      commitActiveTx();
      currentSection = 'NONE';
      continue;
    }

    if (currentSection === 'NONE') {
      continue;
    }

    // Strip redundant bank headers
    if (isRedundantHeaderOrFooter(trimmed)) {
      continue;
    }

    if (/^(DATE\s+DESCRIPTION|CHECK NO\.\s+DATE PAID)/i.test(trimmed)) {
      continue;
    }

    // Section: CHECKS PAID
    if (currentSection === 'CHECKS') {
      const checkRowMatch = trimmed.match(/^(\d{3,6})\s+(\d{2}\/\d{2})\s+(.*?)\s*\$?([0-9.,]*\d[0-9.,]*)$/);
      if (checkRowMatch) {
        commitActiveTx();
        const checkNum = checkRowMatch[1];
        const dateStr = checkRowMatch[2];
        const desc = checkRowMatch[3].trim() || `Check #${checkNum}`;
        const rawAmt = parseCurrency(checkRowMatch[4]);

        activeTx = {
          id: `tx_${txCounter++}`,
          date: dateStr,
          rawDate: dateStr,
          type: 'CHECK',
          cleanPayee: `Check #${checkNum}`,
          originalMemo: desc,
          amount: -rawAmt,
          rawAmount: rawAmt,
          checkNumber: checkNum,
          section: 'Checks Paid',
          lineNumber: i + 1,
          bankId: 'CHASE',
          bankName: 'JPMorgan Chase',
          sourceFile: sourceFileName,
        };
        commitActiveTx();
        continue;
      }
    }

    // Section: DEPOSITS or WITHDRAWALS
    const dateRowMatch = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s*\$?([0-9.,]*\d[0-9.,]*)$/);
    if (dateRowMatch) {
      commitActiveTx();
      const dateStr = dateRowMatch[1];
      const memo = dateRowMatch[2].trim();
      const rawAmt = parseCurrency(dateRowMatch[3]);
      const txType: TransactionType = currentSection === 'DEPOSITS' ? 'CREDIT' : 'DEBIT';

      activeTx = {
        id: `tx_${txCounter++}`,
        date: dateStr,
        rawDate: dateStr,
        type: txType,
        cleanPayee: '',
        originalMemo: memo,
        amount: txType === 'CREDIT' ? rawAmt : -rawAmt,
        rawAmount: rawAmt,
        section: currentSection === 'DEPOSITS' ? 'Deposits and Additions' : 'Electronic Withdrawals',
        lineNumber: i + 1,
        bankId: 'CHASE',
        bankName: 'JPMorgan Chase',
        sourceFile: sourceFileName,
      };
      continue;
    }

    // Multi-line memo continuation
    if (activeTx) {
      if (!isRedundantHeaderOrFooter(trimmed)) {
        activeTx.originalMemo += ' ' + trimmed;
      }
    }
  }

  commitActiveTx();

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
    const s = first1000Chars.toLowerCase();
    return (
      s.includes('jpmorgan chase') ||
      s.includes('chase bank') ||
      s.includes('chase business') ||
      s.includes('columbus oh 43218')
    );
  },
  parse(rawText: string, sourceFileName?: string): StatementParseResult {
    return parseChaseStatement(rawText, sourceFileName);
  },
};
