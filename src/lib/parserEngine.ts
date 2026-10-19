'use strict';

import {
  BankParser,
  ExtractedDocument,
  ParsedTransaction,
  ReconciliationResult,
  StatementMetadata,
  StatementParseResult,
  StatementSummary,
  SupportedBankId,
} from './types';
import { chaseParser, formatCurrency, cleanPayeeName } from './parsers/chase';
import { amexParser } from './parsers/amex';

export * from './types';

/**
 * Normalizes currency and amount strings by intercepting them before float/integer conversion.
 * Robust against PDF.js text-layer formatting errors:
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

  // Strip currency symbols, spaces, parentheses, negative signs
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
 * Robust currency parser: normalizes raw string against PDF.js text-layer formatting errors
 * before converting to float with cent precision.
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

export { formatCurrency, cleanPayeeName };

/**
 * Registry of bank parsers for modular bank support
 */
export const BANK_REGISTRY: Record<string, BankParser> = {
  CHASE: chaseParser,
  AMEX: amexParser,
};

/**
 * Auto-detects the bank from the first 3000 characters of raw extracted text
 */
export function detectBank(rawText: string): SupportedBankId {
  if (!rawText || rawText.trim().length === 0) {
    console.log('[detectBank] Detected bankId: UNKNOWN (empty text)');
    return 'UNKNOWN';
  }
  const sample = rawText.slice(0, 3000);

  // 1. Chase patterns: check for /(JPMorgan Chase|Chase Business)/i anywhere in the first few lines of the text
  if (/(JPMorgan Chase|Chase Business)/i.test(sample)) {
    console.log('[detectBank] Detected bankId: CHASE');
    return 'CHASE';
  }

  const sampleLower = sample.toLowerCase();

  // 2. American Express patterns
  if (
    sample.includes('american express') ||
    sample.includes('amex') ||
    sample.includes('business platinum') ||
    sample.includes('business gold')
  ) {
    console.log('[detectBank] Detected bankId: AMEX');
    return 'AMEX';
  }

  // 3. Bank of America patterns
  if (sample.includes('bank of america') || sample.includes('bofa')) {
    console.log('[detectBank] Detected bankId: BOFA');
    return 'BOFA';
  }

  // 4. Wells Fargo patterns
  if (sample.includes('wells fargo')) {
    console.log('[detectBank] Detected bankId: WELLS_FARGO');
    return 'WELLS_FARGO';
  }

  console.log('[detectBank] Detected bankId: UNKNOWN');
  return 'UNKNOWN';
}

/**
 * Convert a date string (MM/DD or MM/DD/YYYY) to a sortable timestamp
 */
export function parseDateToTimestamp(dateStr: string, defaultYear: number = 2026): number {
  if (!dateStr) return 0;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    return new Date(y, m - 1, d).getTime();
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    return new Date(defaultYear, m - 1, d).getTime();
  }
  return 0;
}

/**
 * Sorts transactions strictly chronologically (earliest to latest)
 */
export function sortTransactionsChronologically(
  transactions: ParsedTransaction[],
  defaultYear: number = 2026
): ParsedTransaction[] {
  return [...transactions].sort((a, b) => {
    const tA = parseDateToTimestamp(a.date, defaultYear);
    const tB = parseDateToTimestamp(b.date, defaultYear);
    if (tA !== tB) {
      return tA - tB;
    }
    // If same date, CREDIT before DEBIT, then by ID
    if (a.type !== b.type) {
      if (a.type === 'CREDIT') return -1;
      if (b.type === 'CREDIT') return 1;
    }
    return a.id.localeCompare(b.id);
  });
}

export const UNRECOGNIZED_STATEMENT_ERROR =
  'Could not recognize this statement layout. Please ensure it is an original PDF from a supported bank.';

/**
 * Globally sanitizes and normalizes all transaction line items and summary balances
 * before executing the strict $0.00 variance reconciliation math.
 */
export function normalizeStatementAmounts(result: StatementParseResult): StatementParseResult {
  if (!result || result.bankId === 'UNKNOWN') return result;

  // 1. Normalize summary balances
  if (result.summary) {
    result.summary.beginningBalance = parseCurrency(result.summary.beginningBalance);
    result.summary.totalDeposits = parseCurrency(result.summary.totalDeposits);
    result.summary.totalElectronicWithdrawals = parseCurrency(result.summary.totalElectronicWithdrawals);
    result.summary.checksPaid = parseCurrency(result.summary.checksPaid);
    result.summary.endingBalance = parseCurrency(result.summary.endingBalance);
  }

  // 2. Normalize transaction line items
  if (result.transactions && result.transactions.length > 0) {
    result.transactions.forEach((tx) => {
      const normalizedRaw = parseCurrency(tx.rawAmount);
      tx.rawAmount = normalizedRaw;
      tx.amount = tx.type === 'CREDIT' ? normalizedRaw : -normalizedRaw;
    });
  }

  // 3. Strict $0.00 variance reconciliation math
  if (result.summary && result.transactions) {
    const beginningBalance = result.summary.beginningBalance;
    const endingBalance = result.summary.endingBalance;

    const parsedCredits = result.transactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((s, t) => s + t.rawAmount, 0);
    const parsedDebits = result.transactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((s, t) => s + t.rawAmount, 0);
    const parsedChecks = result.transactions
      .filter((t) => t.type === 'CHECK')
      .reduce((s, t) => s + t.rawAmount, 0);

    const calculatedEnding = Math.round((beginningBalance + parsedCredits - parsedDebits - parsedChecks) * 100) / 100;
    const totalDiscrepancy = Math.round((calculatedEnding - endingBalance) * 100) / 100;
    const isBalanced = Math.abs(totalDiscrepancy) < 0.01;

    const flaggedRowIndices: number[] = [];
    if (!isBalanced) {
      result.transactions.forEach((tx, idx) => {
        if (tx.rawAmount <= 0) {
          tx.isFlagged = true;
          flaggedRowIndices.push(idx);
        }
      });
    }

    result.reconciliation = {
      status: isBalanced ? 'BALANCED' : 'MISMATCH',
      diff: isBalanced ? 0.0 : totalDiscrepancy,
      beginningBalance,
      totalCredits: parsedCredits,
      totalDebits: parsedDebits,
      totalChecks: parsedChecks,
      calculatedEnding,
      statementEnding: endingBalance,
      flaggedRowIndices,
      details: isBalanced
        ? 'All transactions reconcile with beginning and ending statement balances to the cent.'
        : `Discrepancy of ${formatCurrency(totalDiscrepancy, true)} detected between statement summary and transaction ledger.`,
    };
  }

  return result;
}

/**
 * Parse a single statement document with auto-detection
 */
export function parseStatement(
  rawText: string,
  fileName: string = 'statement.pdf',
  forcedBank?: SupportedBankId
): StatementParseResult {
  const bankId = forcedBank || detectBank(rawText);
  const parser = BANK_REGISTRY[bankId];

  if (!parser || bankId === 'UNKNOWN') {
    return {
      metadata: {
        bankId: 'UNKNOWN',
        bankName: 'Unknown Bank',
        accountNumber: 'N/A',
        statementPeriod: 'Unknown Period',
        startDate: '',
        endDate: '',
        statementType: 'Unrecognized Statement',
        fileCount: 1,
        sourceFiles: [fileName],
      },
      summary: {
        beginningBalance: 0,
        totalDeposits: 0,
        totalElectronicWithdrawals: 0,
        checksPaid: 0,
        endingBalance: 0,
      },
      transactions: [],
      reconciliation: {
        status: 'MISMATCH',
        diff: 0,
        beginningBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        totalChecks: 0,
        calculatedEnding: 0,
        statementEnding: 0,
        flaggedRowIndices: [],
        details: UNRECOGNIZED_STATEMENT_ERROR,
      },
      rawText,
      bankId: 'UNKNOWN',
      error: UNRECOGNIZED_STATEMENT_ERROR,
    };
  }

  const result = parser.parse(rawText, fileName);
  if (!result.transactions || result.transactions.length === 0) {
    result.error = UNRECOGNIZED_STATEMENT_ERROR;
  }
  return normalizeStatementAmounts(result);
}

/**
 * Parse multiple statements simultaneously, aggregate totals, and chronologically sort all transactions
 */
export function parseMultipleStatements(documents: ExtractedDocument[]): StatementParseResult {
  if (!documents || documents.length === 0) {
    return {
      metadata: {
        bankId: 'UNKNOWN',
        bankName: 'Unknown Bank',
        accountNumber: 'N/A',
        statementPeriod: 'Unknown Period',
        startDate: '',
        endDate: '',
        statementType: 'Unrecognized Statement',
        fileCount: 0,
        sourceFiles: [],
      },
      summary: {
        beginningBalance: 0,
        totalDeposits: 0,
        totalElectronicWithdrawals: 0,
        checksPaid: 0,
        endingBalance: 0,
      },
      transactions: [],
      reconciliation: {
        status: 'MISMATCH',
        diff: 0,
        beginningBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        totalChecks: 0,
        calculatedEnding: 0,
        statementEnding: 0,
        flaggedRowIndices: [],
        details: UNRECOGNIZED_STATEMENT_ERROR,
      },
      rawText: '',
      bankId: 'UNKNOWN',
      error: UNRECOGNIZED_STATEMENT_ERROR,
    };
  }

  if (documents.length === 1) {
    return parseStatement(documents[0].text, documents[0].fileName);
  }

  // Parse each individual statement
  const individualResults = documents.map((doc) => parseStatement(doc.text, doc.fileName));

  const totalTxCount = individualResults.reduce((acc, r) => acc + (r.transactions?.length || 0), 0);
  const allUnknown = individualResults.every((r) => r.bankId === 'UNKNOWN');

  if (totalTxCount === 0 || allUnknown) {
    return {
      metadata: {
        bankId: 'UNKNOWN',
        bankName: 'Unknown Bank',
        accountNumber: 'N/A',
        statementPeriod: 'Unknown Period',
        startDate: '',
        endDate: '',
        statementType: 'Unrecognized Statement',
        fileCount: documents.length,
        sourceFiles: documents.map((d) => d.fileName),
      },
      summary: {
        beginningBalance: 0,
        totalDeposits: 0,
        totalElectronicWithdrawals: 0,
        checksPaid: 0,
        endingBalance: 0,
      },
      transactions: [],
      reconciliation: {
        status: 'MISMATCH',
        diff: 0,
        beginningBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        totalChecks: 0,
        calculatedEnding: 0,
        statementEnding: 0,
        flaggedRowIndices: [],
        details: UNRECOGNIZED_STATEMENT_ERROR,
      },
      rawText: documents.map((d) => `=== FILE: ${d.fileName} ===\n${d.text}`).join('\n\n'),
      bankId: 'UNKNOWN',
      error: UNRECOGNIZED_STATEMENT_ERROR,
    };
  }

  // Determine chronological order of statements using start dates
  const sortedStatements = [...individualResults].sort((a, b) => {
    const tA = parseDateToTimestamp(a.metadata.startDate);
    const tB = parseDateToTimestamp(b.metadata.startDate);
    return tA - tB;
  });

  const earliestStatement = sortedStatements[0];
  const latestStatement = sortedStatements[sortedStatements.length - 1];

  // Aggregate all transactions
  const allRawTransactions: ParsedTransaction[] = [];
  individualResults.forEach((res) => {
    allRawTransactions.push(...res.transactions);
  });

  // Sort aggregated transactions chronologically
  const sortedTransactions = sortTransactionsChronologically(allRawTransactions);

  // Re-index transaction IDs sequentially
  const transactions: ParsedTransaction[] = sortedTransactions.map((tx, idx) => ({
    ...tx,
    id: `tx_${idx + 1}`,
  }));

  // Aggregate summary metrics across all statements
  const beginningBalance = parseCurrency(earliestStatement.summary.beginningBalance);
  const endingBalance = parseCurrency(latestStatement.summary.endingBalance);

  const totalDeposits = individualResults.reduce((sum, r) => sum + parseCurrency(r.summary.totalDeposits), 0);
  const totalElectronicWithdrawals = individualResults.reduce((sum, r) => sum + parseCurrency(r.summary.totalElectronicWithdrawals), 0);
  const checksPaid = individualResults.reduce((sum, r) => sum + parseCurrency(r.summary.checksPaid), 0);

  // Consolidated reconciliation
  const parsedCredits = transactions.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + parseCurrency(t.rawAmount), 0);
  const parsedDebits = transactions.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + parseCurrency(t.rawAmount), 0);
  const parsedChecks = transactions.filter((t) => t.type === 'CHECK').reduce((s, t) => s + parseCurrency(t.rawAmount), 0);

  const calculatedEnding = Math.round((beginningBalance + parsedCredits - parsedDebits - parsedChecks) * 100) / 100;
  const totalDiscrepancy = Math.round((calculatedEnding - endingBalance) * 100) / 100;
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
    statementEnding: endingBalance,
    flaggedRowIndices,
    details: isBalanced
      ? `All transactions across ${documents.length} statements reconcile to the cent with $0.00 variance.`
      : `Discrepancy of ${formatCurrency(totalDiscrepancy, true)} across ${documents.length} combined statements.`,
  };

  // Determine bank branding
  const uniqueBanks = Array.from(new Set(individualResults.map((r) => r.metadata.bankName)));
  const bankName = uniqueBanks.length === 1 ? uniqueBanks[0] : `Multi-Bank (${uniqueBanks.join(', ')})`;
  const bankId = uniqueBanks.length === 1 ? individualResults[0].metadata.bankId : 'CHASE';

  // Consolidated account numbers & period
  const uniqueAccounts = Array.from(new Set(individualResults.map((r) => r.metadata.accountNumber)));
  const accountNumber = uniqueAccounts.join(', ');
  const statementPeriod = `${earliestStatement.metadata.startDate || 'Start'} – ${latestStatement.metadata.endDate || 'End'} (${documents.length} statements)`;

  const metadata: StatementMetadata = {
    bankId,
    bankName,
    accountNumber,
    statementPeriod,
    startDate: earliestStatement.metadata.startDate,
    endDate: latestStatement.metadata.endDate,
    statementType: uniqueBanks.length === 1 ? individualResults[0].metadata.statementType : 'Consolidated Business Accounts',
    fileCount: documents.length,
    sourceFiles: documents.map((d) => d.fileName),
  };

  const summary: StatementSummary = {
    beginningBalance,
    totalDeposits,
    totalElectronicWithdrawals,
    checksPaid,
    endingBalance,
  };

  const rawText = documents.map((d) => `=== FILE: ${d.fileName} ===\n${d.text}`).join('\n\n');

  return {
    metadata,
    summary,
    transactions,
    reconciliation,
    rawText,
    bankId,
  };
}

/**
 * Dynamically recompute reconciliation when rows are edited, added, or deleted in the UI
 */
export function recalculateReconciliation(
  beginningBalance: number,
  statementEndingBalance: number,
  transactions: ParsedTransaction[]
): ReconciliationResult {
  const normBeginning = parseCurrency(beginningBalance);
  const normEnding = parseCurrency(statementEndingBalance);

  const totalCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + parseCurrency(t.rawAmount), 0);

  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + parseCurrency(t.rawAmount), 0);

  const totalChecks = transactions
    .filter((t) => t.type === 'CHECK')
    .reduce((sum, t) => sum + parseCurrency(t.rawAmount), 0);

  const calculatedEnding = Math.round((normBeginning + totalCredits - totalDebits - totalChecks) * 100) / 100;
  const rawDiff = Math.round((calculatedEnding - normEnding) * 100) / 100;

  const isBalanced = Math.abs(rawDiff) < 0.01;
  const flaggedRowIndices: number[] = [];

  if (!isBalanced) {
    transactions.forEach((tx, idx) => {
      if (parseCurrency(tx.rawAmount) <= 0) {
        flaggedRowIndices.push(idx);
      }
    });
  }

  return {
    status: isBalanced ? 'BALANCED' : 'MISMATCH',
    diff: isBalanced ? 0.0 : rawDiff,
    beginningBalance: normBeginning,
    totalCredits,
    totalDebits,
    totalChecks,
    calculatedEnding,
    statementEnding: normEnding,
    flaggedRowIndices,
    details: isBalanced
      ? 'All transactions reconcile with beginning and ending statement balances to the cent.'
      : `Discrepancy of ${formatCurrency(rawDiff, true)} detected between transaction ledger and statement balance.`,
  };
}
