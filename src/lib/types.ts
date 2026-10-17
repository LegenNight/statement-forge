'use strict';

export type TransactionType = 'CREDIT' | 'DEBIT' | 'CHECK';

export type SupportedBankId = 'CHASE' | 'AMEX' | 'BOFA' | 'WELLS_FARGO' | 'UNKNOWN';

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
  bankId?: SupportedBankId;
  bankName?: string;
  sourceFile?: string;
}

export interface StatementSummary {
  beginningBalance: number;
  totalDeposits: number; // Credits
  totalElectronicWithdrawals: number; // Debits
  checksPaid: number; // Checks
  endingBalance: number;
}

export interface StatementMetadata {
  bankId: SupportedBankId;
  bankName: string;
  accountNumber: string;
  statementPeriod: string;
  startDate: string;
  endDate: string;
  statementType: string;
  fileCount: number;
  sourceFiles: string[];
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

export interface StatementParseResult {
  metadata: StatementMetadata;
  summary: StatementSummary;
  transactions: ParsedTransaction[];
  reconciliation: ReconciliationResult;
  rawText: string;
  bankId: SupportedBankId;
}

// Backward-compatible alias
export type ChaseParseResult = StatementParseResult;

export interface BankParser {
  bankId: SupportedBankId;
  bankName: string;
  detect(first1000Chars: string): boolean;
  parse(rawText: string, sourceFileName?: string): StatementParseResult;
}

export interface ExtractedDocument {
  text: string;
  fileName: string;
}
