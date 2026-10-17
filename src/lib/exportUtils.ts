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

// ---------------------------------------------------------------------------
// OFX / QBO EXPORT ENGINE
// ---------------------------------------------------------------------------

/**
 * Parses an MM/DD date string into YYYYMMDD120000[-5:EST] OFX format.
 * Uses the provided statement year; defaults to current year if not supplied.
 */
function formatOFXDate(dateStr: string, year?: number): string {
  const resolvedYear = year ?? new Date().getFullYear();
  // dateStr may be "MM/DD" or "MM/DD/YYYY"
  const parts = dateStr.split('/');
  const mm = (parts[0] ?? '01').padStart(2, '0');
  const dd = (parts[1] ?? '01').padStart(2, '0');
  const yy = parts[2] ? parseInt(parts[2], 10) : resolvedYear;
  return `${yy}${mm}${dd}120000[-5:EST]`;
}

/**
 * Derives OFX TRNTYPE from transaction type.
 * Returns CREDIT (or DEBIT) strictly adhering to spec.
 */
function toOFXType(type: string): 'CREDIT' | 'DEBIT' {
  if (type === 'CREDIT') return 'CREDIT';
  return 'DEBIT';
}

/**
 * Generates a compliant OFX 1.x / QBO file string.
 *
 * Spec: OFX 1.02 SGML (plaintext header block + <OFX> body).
 * - mappedVendor  -> <NAME>
 * - mappedCategory or originalMemo -> <MEMO>
 * - Redaction mode applies to NAME and MEMO fields.
 *
 * @param transactions  Ledger rows to export (already sliced for tier gate if needed)
 * @param statementYear  Year extracted from statement metadata (for correct DTPOSTED)
 * @param accountNumber  Account number for the BANKACCTFROM block
 * @param isRedacted  Whether privacy redaction mode is active
 */
export function generateOFX(
  transactions: ParsedTransaction[],
  statementYear: number = new Date().getFullYear(),
  accountNumber: string = 'UNKNOWN',
  isRedacted: boolean = false
): string {
  // SGML plaintext header — must end with exactly one blank line before <OFX>
  const header = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'SECURITY:NONE',
    'ENCODING:USASCII',
    'CHARSET:1252',
    'COMPRESSION:NONE',
    'OLDFILEUID:NONE',
    'NEWFILEUID:NONE',
    '',
  ].join('\r\n');

  const now = formatOFXDate(
    `${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`,
    new Date().getFullYear()
  );

  const safeAcct = isRedacted ? 'REDACTED' : accountNumber.replace(/\D/g, '') || 'UNKNOWN';

  const stmtTrns = transactions
    .map((tx, idx) => {
      const trnType = toOFXType(tx.type);
      const dtPosted = formatOFXDate(tx.date, statementYear);
      const amount = tx.amount.toFixed(2);

      // Unique FITID: date + index + raw amount to avoid collisions
      const fitid = `${dtPosted.slice(0, 8)}${String(idx + 1).padStart(4, '0')}`;

      let name = tx.mappedVendor || tx.cleanPayee;
      let memo = tx.mappedCategory || tx.originalMemo;

      if (isRedacted) {
        name = redactText(name);
        memo = redactText(memo);
      }

      // OFX NAME max 32 chars per spec; MEMO max 255
      name = name.slice(0, 32).replace(/[<>&"']/g, ' ');
      memo = memo.slice(0, 255).replace(/[<>&"']/g, ' ');

      return [
        '<STMTTRN>',
        `<TRNTYPE>${trnType}`,
        `<DTPOSTED>${dtPosted}`,
        `<TRNAMT>${amount}`,
        `<FITID>${fitid}`,
        `<NAME>${name}`,
        `<MEMO>${memo}`,
        '</STMTTRN>',
      ].join('\r\n');
    })
    .join('\r\n');

  const body = [
    '<OFX>',
    '<SIGNONMSGSRSV1>',
    '<SONRS>',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    `<DTSERVER>${now}`,
    '<LANGUAGE>ENG',
    '</SONRS>',
    '</SIGNONMSGSRSV1>',
    '<BANKMSGSRSV1>',
    '<STMTTRNRS>',
    '<TRNUID>1001',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    '<STMTRS>',
    '<CURDEF>USD',
    '<BANKACCTFROM>',
    `<ACCTID>${safeAcct}`,
    '<ACCTTYPE>CHECKING',
    '</BANKACCTFROM>',
    '<BANKTRANLIST>',
    stmtTrns,
    '</BANKTRANLIST>',
    '</STMTRS>',
    '</STMTTRNRS>',
    '</BANKMSGSRSV1>',
    '</OFX>',
  ].join('\r\n');

  return header + body;
}

/**
 * Alias for generateOFX — produces identical content with .qbo extension
 * (QuickBooks reads OFX 1.x with either extension).
 */
export function generateQBO(
  transactions: ParsedTransaction[],
  statementYear: number = new Date().getFullYear(),
  accountNumber: string = 'UNKNOWN',
  isRedacted: boolean = false
): string {
  return generateOFX(transactions, statementYear, accountNumber, isRedacted);
}

