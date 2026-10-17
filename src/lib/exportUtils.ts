import { ParsedTransaction } from './types';
import { redactText } from './vendorRules';

/**
 * Escapes CSV field value according to RFC 4180
 */
function escapeCSV(val: string | number | undefined): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * QuickBooks Online Format:
 * Headers: Date,Description,Amount
 * Prioritizes mappedVendor and mappedCategory, with optional privacy redaction.
 */
export function generateQuickBooksCSV(
  transactions: ParsedTransaction[],
  useCleanPayee: boolean = true,
  isRedacted: boolean = false
): string {
  const headers = ['Date', 'Description', 'Amount'];
  const rows = transactions.map((tx) => {
    let desc = tx.mappedVendor || (useCleanPayee ? tx.cleanPayee : tx.originalMemo);
    if (isRedacted) {
      desc = redactText(desc);
    }
    const formattedAmount = tx.amount.toFixed(2);
    return [escapeCSV(tx.date), escapeCSV(desc), formattedAmount].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Xero CSV Format:
 * Headers: Date,Amount,Payee,Description,Reference
 * Prioritizes mappedVendor and mappedCategory, with optional privacy redaction.
 */
export function generateXeroCSV(
  transactions: ParsedTransaction[],
  isRedacted: boolean = false
): string {
  const headers = ['Date', 'Amount', 'Payee', 'Description', 'Reference'];
  const rows = transactions.map((tx) => {
    let payee = tx.mappedVendor || tx.cleanPayee;
    let desc = tx.mappedCategory ? `${tx.originalMemo} [${tx.mappedCategory}]` : tx.originalMemo;
    let ref = tx.checkNumber ? (isRedacted ? 'CHK#••••' : `CHK#${tx.checkNumber}`) : tx.section;

    if (isRedacted) {
      payee = redactText(payee);
      desc = redactText(desc);
    }

    return [
      escapeCSV(tx.date),
      tx.amount.toFixed(2),
      escapeCSV(payee),
      escapeCSV(desc),
      escapeCSV(ref),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Standard 4-Column CSV Format:
 * Headers: Date,Description,Debit,Credit
 * Prioritizes mappedVendor and mappedCategory, with optional privacy redaction.
 */
export function generateStandard4ColumnCSV(
  transactions: ParsedTransaction[],
  useCleanPayee: boolean = false,
  isRedacted: boolean = false
): string {
  const headers = ['Date', 'Description', 'Debit', 'Credit'];
  const rows = transactions.map((tx) => {
    const baseVendor = tx.mappedVendor || (useCleanPayee ? tx.cleanPayee : tx.originalMemo);
    let desc = tx.mappedCategory ? `${baseVendor} (${tx.mappedCategory})` : baseVendor;

    if (isRedacted) {
      desc = redactText(desc);
    }

    const isOutflow = tx.type === 'DEBIT' || tx.type === 'CHECK';
    const debit = isOutflow ? tx.rawAmount.toFixed(2) : '';
    const credit = !isOutflow ? tx.rawAmount.toFixed(2) : '';

    return [escapeCSV(tx.date), escapeCSV(desc), debit, credit].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Tab-Separated Values (TSV) for direct paste into Excel or Google Sheets
 * Includes mapped vendor and category with optional privacy redaction.
 */
export function generateTSV(
  transactions: ParsedTransaction[],
  useCleanPayee: boolean = true,
  isRedacted: boolean = false
): string {
  const headers = ['Date', 'Type', 'Vendor / Payee', 'Category', 'Original Memo', 'Debit', 'Credit', 'Amount'];
  const rows = transactions.map((tx) => {
    const isOutflow = tx.type === 'DEBIT' || tx.type === 'CHECK';
    const debit = isOutflow ? tx.rawAmount.toFixed(2) : '';
    const credit = !isOutflow ? tx.rawAmount.toFixed(2) : '';

    let payee = tx.mappedVendor || (useCleanPayee ? tx.cleanPayee : tx.originalMemo);
    let category = tx.mappedCategory || '';
    let memo = tx.originalMemo;

    if (isRedacted) {
      payee = redactText(payee);
      memo = redactText(memo);
    }

    return [
      tx.date,
      tx.type,
      payee,
      category,
      memo,
      debit,
      credit,
      tx.amount.toFixed(2),
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}

/**
 * Triggers a browser file download without touching any server
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
