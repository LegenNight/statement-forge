import { ParsedTransaction } from './chaseParser';

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
 * Debits negative, Credits positive
 */
export function generateQuickBooksCSV(transactions: ParsedTransaction[], useCleanPayee: boolean = true): string {
  const headers = ['Date', 'Description', 'Amount'];
  const rows = transactions.map((tx) => {
    const desc = useCleanPayee ? tx.cleanPayee : tx.originalMemo;
    const formattedAmount = tx.amount.toFixed(2);
    return [escapeCSV(tx.date), escapeCSV(desc), formattedAmount].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Xero CSV Format:
 * Headers: Date,Amount,Payee,Description,Reference
 */
export function generateXeroCSV(transactions: ParsedTransaction[]): string {
  const headers = ['Date', 'Amount', 'Payee', 'Description', 'Reference'];
  const rows = transactions.map((tx) => {
    const ref = tx.checkNumber ? `CHK#${tx.checkNumber}` : tx.section;
    return [
      escapeCSV(tx.date),
      tx.amount.toFixed(2),
      escapeCSV(tx.cleanPayee),
      escapeCSV(tx.originalMemo),
      escapeCSV(ref),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Standard 4-Column CSV Format:
 * Headers: Date,Description,Debit,Credit
 */
export function generateStandard4ColumnCSV(transactions: ParsedTransaction[], useCleanPayee: boolean = false): string {
  const headers = ['Date', 'Description', 'Debit', 'Credit'];
  const rows = transactions.map((tx) => {
    const desc = useCleanPayee ? tx.cleanPayee : tx.originalMemo;
    const isOutflow = tx.type === 'DEBIT' || tx.type === 'CHECK';
    const debit = isOutflow ? tx.rawAmount.toFixed(2) : '';
    const credit = !isOutflow ? tx.rawAmount.toFixed(2) : '';

    return [escapeCSV(tx.date), escapeCSV(desc), debit, credit].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Tab-Separated Values (TSV) for direct paste into Excel or Google Sheets
 */
export function generateTSV(transactions: ParsedTransaction[], useCleanPayee: boolean = true): string {
  const headers = ['Date', 'Type', 'Payee', 'Original Memo', 'Debit', 'Credit', 'Amount'];
  const rows = transactions.map((tx) => {
    const isOutflow = tx.type === 'DEBIT' || tx.type === 'CHECK';
    const debit = isOutflow ? tx.rawAmount.toFixed(2) : '';
    const credit = !isOutflow ? tx.rawAmount.toFixed(2) : '';
    const payee = useCleanPayee ? tx.cleanPayee : tx.originalMemo;

    return [
      tx.date,
      tx.type,
      payee,
      tx.originalMemo,
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
