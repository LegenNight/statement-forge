import { parseStatement, detectBank } from './src/lib/parserEngine';
import { SAMPLE_CHASE_STATEMENT, SAMPLE_CHASE_STATEMENT_NOV } from './src/lib/sampleChaseData';
import * as fs from 'fs';
import * as path from 'path';

console.log('=== STATEMENTFORGE PARSER DEBUG HARNESS ===\n');

// Allow passing custom text file path as an argument if needed
let rawText = SAMPLE_CHASE_STATEMENT;
let fileName = 'chase_business_oct2026.pdf';

if (process.argv[2]) {
  const customPath = path.resolve(process.argv[2]);
  if (fs.existsSync(customPath)) {
    console.log(`Loading custom input from: ${customPath}`);
    rawText = fs.readFileSync(customPath, 'utf8');
    fileName = path.basename(customPath);
  } else {
    console.warn(`File not found at ${customPath}, falling back to demo statement.`);
  }
} else {
  console.log(`Using default demo statement: ${fileName}`);
}

console.log(`\n--- [1] Raw Text Preview (first 300 chars) ---`);
console.log(rawText.slice(0, 300));
console.log('...\n');

console.log(`--- [2] detectBank() Execution ---`);
const detected = detectBank(rawText);
console.log(`Direct detectBank result: "${detected}"\n`);

console.log(`--- [3] parseStatement() Execution ---`);
const result = parseStatement(rawText, fileName);

console.log('\n--- [4] Parse Summary & Results ---');
console.log('Bank ID:', result.metadata.bankId);
console.log('Bank Name:', result.metadata.bankName);
console.log('Statement Period:', result.metadata.statementPeriod);
console.log('Account Number:', result.metadata.accountNumber);
console.log('\nStatement Balances:');
console.log('  Beginning Balance:', result.summary.beginningBalance);
console.log('  Total Deposits:', result.summary.totalDeposits);
console.log('  Electronic Withdrawals:', result.summary.totalElectronicWithdrawals);
console.log('  Checks Paid:', result.summary.checksPaid);
console.log('  Ending Balance:', result.summary.endingBalance);

console.log('\nExtracted Transactions Count:', result.transactions.length);
if (result.transactions.length > 0) {
  result.transactions.forEach((tx, idx) => {
    console.log(
      `  [${idx + 1}] ${tx.date} | ${tx.type.padEnd(6)} | $${tx.rawAmount.toFixed(2).padStart(8)} | Clean: "${tx.cleanPayee}" | Memo: "${tx.originalMemo}"`
    );
  });
} else {
  console.log('  ⚠️ NO TRANSACTIONS EXTRACTED!');
}

console.log('\nReconciliation Result:');
console.log('  Status:', result.reconciliation.status);
console.log('  Calculated Ending:', result.reconciliation.calculatedEnding);
console.log('  Statement Ending:', result.reconciliation.statementEnding);
console.log('  Difference:', result.reconciliation.diff);
console.log('  Details:', result.reconciliation.details);
console.log('  Flagged Rows:', result.reconciliation.flaggedRowIndices);

console.log('\n=== END PARSER DEBUG HARNESS ===');
