import { parseStatement, detectBank } from './src/lib/parserEngine';
import { extractTextFromFile } from './src/lib/pdfExtractor';
import { SAMPLE_CHASE_STATEMENT } from './src/lib/sampleChaseData';
import * as fs from 'fs';
import * as path from 'path';

async function runParserOnTarget(filePathOrText: string, isRawText: boolean = false) {
  let rawText = '';
  let fileName = 'statement.pdf';

  if (isRawText) {
    rawText = filePathOrText;
    fileName = 'sample_chase.txt';
    console.log(`\n======================================================================`);
    console.log(`[TESTING INLINE RAW TEXT]: ${fileName}`);
    console.log(`======================================================================`);
  } else {
    fileName = path.basename(filePathOrText);
    console.log(`\n======================================================================`);
    console.log(`[TESTING ACTUAL FILE]: ${filePathOrText}`);
    console.log(`======================================================================`);

    if (!fs.existsSync(filePathOrText)) {
      console.error(`[ERROR] File does not exist: ${filePathOrText}`);
      return;
    }

    if (fileName.toLowerCase().endsWith('.pdf')) {
      const buffer = fs.readFileSync(filePathOrText);
      console.log(`[PDF Extraction] Read ${buffer.length} bytes from ${fileName}. Passing through extractTextFromFile()...`);
      const file = new File([buffer], fileName, { type: 'application/pdf' });
      rawText = await extractTextFromFile(file);
      console.log(`[PDF Extraction] Extracted ${rawText.length} characters of reconstructed text.`);
    } else {
      rawText = fs.readFileSync(filePathOrText, 'utf8');
    }
  }

  console.log(`\n--- [1] Raw Text Preview (first 250 chars) ---`);
  console.log(rawText.slice(0, 250));
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
        `  [${(idx + 1).toString().padStart(2)}] ${tx.date} | ${tx.type.padEnd(6)} | $${tx.rawAmount.toFixed(2).padStart(8)} | Clean: "${tx.cleanPayee}" | Memo: "${tx.originalMemo}"`
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

  return result;
}

async function main() {
  console.log('=== STATEMENTFORGE END-TO-END PDF PARSER TEST HARNESS ===');

  if (process.argv[2]) {
    await runParserOnTarget(path.resolve(process.argv[2]));
  } else {
    // Test both downloaded test PDFs
    const nocommaPdf = 'C:/Users/risha/Downloads/chase_business_statement_sep2026_nocomma_test.pdf';
    const demoPdf = 'C:/Users/risha/Downloads/chase_business_statement_sep2026_demo.pdf';

    if (fs.existsSync(nocommaPdf)) {
      await runParserOnTarget(nocommaPdf);
    }

    if (fs.existsSync(demoPdf)) {
      await runParserOnTarget(demoPdf);
    }
  }

  console.log('\n=== END-TO-END VERIFICATION COMPLETE ===');
}

main().catch((err) => {
  console.error('Test harness execution failure:', err);
  process.exit(1);
});
