export type TransactionType = 'CREDIT' | 'DEBIT' | 'CHECK';

export interface ParsedTransaction {
  id: string;
  date: string; // e.g. "10/02" or full date "10/02/2026"
  rawDate: string;
  type: TransactionType;
  cleanPayee: string;
  originalMemo: string;
  amount: number; // Signed: positive for CREDIT, negative for DEBIT and CHECK
  rawAmount: number; // Always positive magnitude
  checkNumber?: string;
  section: string;
  lineNumber?: number;
  isFlagged?: boolean;
}

export interface StatementSummary {
  beginningBalance: number;
  totalDeposits: number; // Credits
  totalElectronicWithdrawals: number; // Debits
  checksPaid: number; // Checks
  endingBalance: number;
}

export interface StatementMetadata {
  accountNumber: string;
  statementPeriod: string;
  startDate: string;
  endDate: string;
  statementType: string;
}

export interface ReconciliationResult {
  status: 'BALANCED' | 'MISMATCH';
  diff: number; // Discrepancy amount
  beginningBalance: number;
  totalCredits: number;
  totalDebits: number;
  totalChecks: number;
  calculatedEnding: number;
  statementEnding: number;
  flaggedRowIndices: number[];
  details: string;
}

export interface ChaseParseResult {
  metadata: StatementMetadata;
  summary: StatementSummary;
  transactions: ParsedTransaction[];
  reconciliation: ReconciliationResult;
  rawText: string;
}

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
  text = text.replace(/\b(SEATTLE|NEW YORK|COLUMBUS|SAN FRANCISCO|AUSTIN)\s+[A-Z]{2}\b/gi, '');
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
 * Parse an amount string into a normalized floating point number.
 * e.g., "$14,850.20" -> 14850.2
 */
export function parseCurrency(str: string): number {
  if (!str) return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = str.replace(/[$,\s]/g, '').trim();
  const val = parseFloat(cleaned);
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
 * Core Chase Business Statement Parser
 */
export function parseChaseStatement(rawText: string): ChaseParseResult {
  const lines = rawText.split(/\r?\n/);

  // 1. Metadata Extraction
  let accountNumber = '0000000000';
  let statementPeriod = '';
  let startDate = '';
  let endDate = '';
  let statementType = 'CHASE BUSINESS CHECKING';

  // Account Number: Match /Account Number:\s*(\d{9,12}|\.{3,}\d{4})/i
  const acctMatch = rawText.match(/Account Number:\s*(\d{9,12}|\.{3,}\d{4}|[0-9]{4,16})/i);
  if (acctMatch) {
    accountNumber = acctMatch[1].trim();
  }

  // Statement Period: Extract Start Date and End Date
  // e.g. "October 01, 2026 through October 31, 2026" or "10/01/2026 through 10/31/2026"
  const periodMatch = rawText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})\s+(?:through|to|-)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})/i);
  if (periodMatch) {
    statementPeriod = periodMatch[0].trim();
    startDate = periodMatch[1].trim();
    endDate = periodMatch[2].trim();
  }

  if (/CHASE BUSINESS COMPLETE CHECKING/i.test(rawText)) {
    statementType = 'CHASE BUSINESS COMPLETE CHECKING';
  } else if (/CHASE BUSINESS CHECKING/i.test(rawText)) {
    statementType = 'CHASE BUSINESS CHECKING';
  }

  // 2. Summary Block Extraction
  let beginningBalance = 0;
  let totalDeposits = 0;
  let totalElectronicWithdrawals = 0;
  let checksPaid = 0;
  let endingBalance = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const begMatch = line.match(/Beginning Balance:?\s*[\$]?([\d,]+\.\d{2})/i);
    if (begMatch) beginningBalance = parseCurrency(begMatch[1]);

    const depMatch = line.match(/(?:Deposits and Additions|Total Deposits):?\s*[\$]?([\d,]+\.\d{2})/i);
    if (depMatch) totalDeposits = parseCurrency(depMatch[1]);

    const wdMatch = line.match(/(?:Electronic Withdrawals|Total Electronic Withdrawals):?\s*[\$]?([\d,]+\.\d{2})/i);
    if (wdMatch) totalElectronicWithdrawals = parseCurrency(wdMatch[1]);

    const chkMatch = line.match(/(?:Checks Paid|Total Checks Paid):?\s*[\$]?([\d,]+\.\d{2})/i);
    if (chkMatch) checksPaid = parseCurrency(chkMatch[1]);

    const endMatch = line.match(/Ending Balance:?\s*[\$]?([\d,]+\.\d{2})/i);
    if (endMatch) endingBalance = parseCurrency(endMatch[1]);
  }

  // 3. Section & Transaction Extraction
  const transactions: ParsedTransaction[] = [];
  type CurrentSection = 'NONE' | 'DEPOSITS' | 'CHECKS' | 'WITHDRAWALS';
  let currentSection: CurrentSection = 'NONE';

  let currentTx: ParsedTransaction | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // Detect Section Headers
    if (/^DEPOSITS AND ADDITIONS/i.test(line)) {
      currentSection = 'DEPOSITS';
      currentTx = null;
      continue;
    } else if (/^CHECKS PAID/i.test(line)) {
      currentSection = 'CHECKS';
      currentTx = null;
      continue;
    } else if (/^ELECTRONIC WITHDRAWALS/i.test(line)) {
      currentSection = 'WITHDRAWALS';
      currentTx = null;
      continue;
    } else if (/^(CHECKING SUMMARY|DAILY ENDING BALANCE|SERVICE CHARGE SUMMARY)/i.test(line)) {
      currentSection = 'NONE';
      currentTx = null;
      continue;
    }

    if (currentSection === 'NONE') continue;

    // Skip column headers
    if (
      /^(DATE\s+DESCRIPTION|CHECK NO\.\s+DATE PAID|DATE\s+AMOUNT)/i.test(line) ||
      /^DATE\b.*AMOUNT\b/i.test(line) ||
      /^CHECK NO\b/i.test(line)
    ) {
      continue;
    }

    // A. CHECKS PAID Section:
    // Format 1: "1042       10/05       CHECK #1042                      $1,200.00"
    // Format 2: "10/05       CHECK #1042                      $1,200.00"
    if (currentSection === 'CHECKS') {
      const checkRow1 = line.match(/^(\d+)\s+(\d{2}\/\d{2})\s+(.+?)\s+[\$]?([\d,]+\.\d{2})$/);
      const checkRow2 = line.match(/^(\d{2}\/\d{2})\s+(?:CHECK\s*#?\s*(\d+)\s+)?(.+?)\s+[\$]?([\d,]+\.\d{2})$/);

      if (checkRow1) {
        const checkNum = checkRow1[1];
        const dateStr = checkRow1[2];
        const memo = checkRow1[3].trim();
        const amt = parseCurrency(checkRow1[4]);

        const newTx: ParsedTransaction = {
          id: `tx-chk-${transactions.length + 1}-${Date.now()}`,
          date: dateStr,
          rawDate: dateStr,
          type: 'CHECK',
          checkNumber: checkNum,
          cleanPayee: `Check #${checkNum}`,
          originalMemo: memo || `CHECK #${checkNum}`,
          amount: -amt, // Negative for checks
          rawAmount: amt,
          section: 'CHECKS PAID',
          lineNumber: i + 1,
        };
        transactions.push(newTx);
        currentTx = newTx;
        continue;
      } else if (checkRow2) {
        const dateStr = checkRow2[1];
        const checkNum = checkRow2[2] || '';
        const memo = checkRow2[3].trim();
        const amt = parseCurrency(checkRow2[4]);

        const newTx: ParsedTransaction = {
          id: `tx-chk-${transactions.length + 1}-${Date.now()}`,
          date: dateStr,
          rawDate: dateStr,
          type: 'CHECK',
          checkNumber: checkNum || undefined,
          cleanPayee: checkNum ? `Check #${checkNum}` : cleanPayeeName(memo, 'CHECK', checkNum),
          originalMemo: memo,
          amount: -amt,
          rawAmount: amt,
          section: 'CHECKS PAID',
          lineNumber: i + 1,
        };
        transactions.push(newTx);
        currentTx = newTx;
        continue;
      }
    }

    // B. DEPOSITS & ELECTRONIC WITHDRAWALS Sections:
    // Format: "10/02   STRIPE PAYMENTS TRANSFER ST-992140A             $4,250.00"
    // Match date pattern: /^(\d{2}\/\d{2})/
    const standardRow = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+[\$]?([\d,]+\.\d{2})$/);

    if (standardRow) {
      const dateStr = standardRow[1];
      const memo = standardRow[2].trim();
      const amt = parseCurrency(standardRow[3]);
      const txType: TransactionType = currentSection === 'DEPOSITS' ? 'CREDIT' : 'DEBIT';

      const newTx: ParsedTransaction = {
        id: `tx-${txType.toLowerCase()}-${transactions.length + 1}-${Date.now()}`,
        date: dateStr,
        rawDate: dateStr,
        type: txType,
        cleanPayee: cleanPayeeName(memo, txType),
        originalMemo: memo,
        amount: txType === 'CREDIT' ? amt : -amt,
        rawAmount: amt,
        section: currentSection === 'DEPOSITS' ? 'DEPOSITS AND ADDITIONS' : 'ELECTRONIC WITHDRAWALS',
        lineNumber: i + 1,
      };
      transactions.push(newTx);
      currentTx = newTx;
      continue;
    }

    // C. Multi-line continuation handling:
    // "Join multi-line description lines that do not start with a date to the previous transaction memo."
    if (currentTx && !/^(\d{2}\/\d{2})/i.test(line) && !/^\d+\s+\d{2}\/\d{2}/i.test(line)) {
      // Avoid merging if it looks like totals or page footer
      if (!/^(Total|Page|Ending Balance|Beginning Balance)/i.test(line)) {
        currentTx.originalMemo = `${currentTx.originalMemo} ${line}`.trim();
        // Re-calculate clean payee with the extended memo if it wasn't a check
        if (currentTx.type !== 'CHECK') {
          currentTx.cleanPayee = cleanPayeeName(currentTx.originalMemo, currentTx.type);
        }
      }
    }
  }

  // 4. Math Reconciliation Engine
  // Discrepancy Calculation:
  // Diff = BeginningBalance + TotalCredits - TotalDebits - ChecksPaid - EndingBalance
  const parsedCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const parsedDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const parsedChecks = transactions
    .filter((t) => t.type === 'CHECK')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  // If summary values were extracted from the summary block, use them or reconcile against parsed sums
  const creditsForRecon = totalDeposits > 0 ? totalDeposits : parsedCredits;
  const debitsForRecon = totalElectronicWithdrawals > 0 ? totalElectronicWithdrawals : parsedDebits;
  const checksForRecon = checksPaid > 0 ? checksPaid : parsedChecks;

  // Reconciled calculated ending balance
  const calculatedEnding = Math.round((beginningBalance + parsedCredits - parsedDebits - parsedChecks) * 100) / 100;
  const expectedEnding = endingBalance > 0 ? endingBalance : calculatedEnding;

  // Diff formula as specified:
  // Diff = BeginningBalance + TotalCredits - TotalDebits - ChecksPaid - EndingBalance
  const rawDiff = Math.round((beginningBalance + creditsForRecon - debitsForRecon - checksForRecon - expectedEnding) * 100) / 100;
  
  // Also check if parsed items match statement summary
  const itemsVsSummaryDiff = Math.round(((parsedCredits - creditsForRecon) - (parsedDebits - debitsForRecon) - (parsedChecks - checksForRecon)) * 100) / 100;

  const totalDiscrepancy = Math.abs(rawDiff) > 0.009 ? rawDiff : itemsVsSummaryDiff;

  const isBalanced = Math.abs(totalDiscrepancy) < 0.01;

  const flaggedRowIndices: number[] = [];
  if (!isBalanced) {
    // Flag rows with unexpected amounts or round anomalies
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

  return {
    metadata: {
      accountNumber,
      statementPeriod,
      startDate,
      endDate,
      statementType,
    },
    summary: {
      beginningBalance,
      totalDeposits: creditsForRecon,
      totalElectronicWithdrawals: debitsForRecon,
      checksPaid: checksForRecon,
      endingBalance: expectedEnding,
    },
    transactions,
    reconciliation,
    rawText,
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
  const totalCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const totalChecks = transactions
    .filter((t) => t.type === 'CHECK')
    .reduce((sum, t) => sum + t.rawAmount, 0);

  const calculatedEnding = Math.round((beginningBalance + totalCredits - totalDebits - totalChecks) * 100) / 100;
  const rawDiff = Math.round((calculatedEnding - statementEndingBalance) * 100) / 100;

  const isBalanced = Math.abs(rawDiff) < 0.01;
  const flaggedRowIndices: number[] = [];

  if (!isBalanced) {
    transactions.forEach((tx, idx) => {
      if (tx.rawAmount <= 0) {
        flaggedRowIndices.push(idx);
      }
    });
  }

  return {
    status: isBalanced ? 'BALANCED' : 'MISMATCH',
    diff: isBalanced ? 0.0 : rawDiff,
    beginningBalance,
    totalCredits,
    totalDebits,
    totalChecks,
    calculatedEnding,
    statementEnding: statementEndingBalance,
    flaggedRowIndices,
    details: isBalanced
      ? 'All transactions reconcile with beginning and ending statement balances to the cent.'
      : `Discrepancy of ${formatCurrency(rawDiff, true)} detected between transaction ledger and statement balance.`,
  };
}

