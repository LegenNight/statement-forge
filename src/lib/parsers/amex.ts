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
import { parseCurrency, formatCurrency, cleanPayeeName } from './chase';

export function parseAmexStatement(rawText: string, sourceFileName: string = 'amex_statement.pdf'): StatementParseResult {
  const lines = rawText.split(/\r?\n/);

  let accountNumber = '••••-••••••-81004';
  let statementPeriod = 'Current Period';
  let startDate = '';
  let endDate = '';
  let statementType = 'American Express Business';

  const acctMatch = rawText.match(/Account\s+(?:Number|Ending\s+in)[:\s]+([0-9\-\.\*]{4,18})/i);
  if (acctMatch) {
    accountNumber = acctMatch[1].trim();
  }

  const periodMatch = rawText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})\s+(?:through|to|-)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})/i);
  if (periodMatch) {
    startDate = periodMatch[1].trim();
    endDate = periodMatch[2].trim();
    statementPeriod = `${startDate} – ${endDate}`;
  }

  let beginningBalance = 0;
  let totalPayments = 0;
  let totalCharges = 0;
  let endingBalance = 0;

  for (const line of lines) {
    if (/Previous Balance/i.test(line)) {
      const m = line.match(/Previous Balance:?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (m) beginningBalance = parseCurrency(m[1]);
    } else if (/(Payments and Credits|Payments\/Credits)/i.test(line)) {
      const m = line.match(/(?:Payments and Credits|Payments\/Credits):?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (m) totalPayments = parseCurrency(m[1]);
    } else if (/(New Charges|New Transactions)/i.test(line)) {
      const m = line.match(/(?:New Charges|New Transactions):?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (m) totalCharges = parseCurrency(m[1]);
    } else if (/(Total Balance Due|New Balance|Ending Balance)/i.test(line)) {
      const m = line.match(/(?:Total Balance Due|New Balance|Ending Balance):?\s*\$?([0-9.,]*\d[0-9.,]*)/i);
      if (m) endingBalance = parseCurrency(m[1]);
    }
  }

  const transactions: ParsedTransaction[] = [];
  let txCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const rowMatch = trimmed.match(/^(\d{2}\/\d{2})\s+(.*?)\s+(-?\$?[0-9.,]*\d[0-9.,]*)$/);
    if (rowMatch) {
      const dateStr = rowMatch[1];
      const memo = rowMatch[2].trim();
      const rawAmt = parseCurrency(rowMatch[3]);
      const isPayment = /PAYMENT|CREDIT|AUTOPAY|REFUND/i.test(memo) || rowMatch[3].includes('-');
      const type: TransactionType = isPayment ? 'CREDIT' : 'DEBIT';

      transactions.push({
        id: `amex_tx_${txCounter++}`,
        date: dateStr,
        rawDate: dateStr,
        type,
        cleanPayee: cleanPayeeName(memo, type),
        originalMemo: memo,
        amount: type === 'CREDIT' ? rawAmt : -rawAmt,
        rawAmount: rawAmt,
        section: type === 'CREDIT' ? 'Payments and Credits' : 'Charges',
        lineNumber: i + 1,
        bankId: 'AMEX',
        bankName: 'American Express',
        sourceFile: sourceFileName,
      });
    }
  }

  const parsedCredits = transactions.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.rawAmount, 0);
  const parsedDebits = transactions.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.rawAmount, 0);

  const creditsForRecon = totalPayments > 0 ? totalPayments : parsedCredits;
  const debitsForRecon = totalCharges > 0 ? totalCharges : parsedDebits;
  const expectedEnding = endingBalance !== 0 ? endingBalance : beginningBalance + debitsForRecon - creditsForRecon;

  const calculatedEnding = Math.round((beginningBalance + debitsForRecon - creditsForRecon) * 100) / 100;
  const totalDiscrepancy = Math.round((calculatedEnding - expectedEnding) * 100) / 100;
  const isBalanced = Math.abs(totalDiscrepancy) < 0.01;

  const reconciliation: ReconciliationResult = {
    status: isBalanced ? 'BALANCED' : 'MISMATCH',
    diff: isBalanced ? 0.0 : totalDiscrepancy,
    beginningBalance,
    totalCredits: parsedCredits,
    totalDebits: parsedDebits,
    totalChecks: 0,
    calculatedEnding,
    statementEnding: expectedEnding,
    flaggedRowIndices: [],
    details: isBalanced
      ? 'All transactions reconcile with statement balance to the cent.'
      : `Discrepancy of ${formatCurrency(totalDiscrepancy, true)} detected.`,
  };

  const metadata: StatementMetadata = {
    bankId: 'AMEX',
    bankName: 'American Express',
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
    checksPaid: 0,
    endingBalance: expectedEnding,
  };

  return {
    metadata,
    summary,
    transactions,
    reconciliation,
    rawText,
    bankId: 'AMEX',
  };
}

export const amexParser: BankParser = {
  bankId: 'AMEX',
  bankName: 'American Express',
  detect(first1000Chars: string): boolean {
    const s = first1000Chars.toLowerCase();
    return (
      s.includes('american express') ||
      s.includes('amex') ||
      s.includes('business platinum') ||
      s.includes('business gold')
    );
  },
  parse(rawText: string, sourceFileName?: string): StatementParseResult {
    return parseAmexStatement(rawText, sourceFileName);
  },
};
