'use strict';

export const SAMPLE_CHASE_STATEMENT = `JPMorgan Chase Bank, N.A.
P O Box 182051
Columbus OH 43218-2051

CHASE BUSINESS COMPLETE CHECKING
October 01, 2026 through October 31, 2026
Account Number: 0000008412
Page 1 of 2

CHECKING SUMMARY
Beginning Balance: $14,850.20
Deposits and Additions: $11,420.50
Electronic Withdrawals: $6,145.90
Checks Paid: $1,850.00
Ending Balance: $18,274.80

DEPOSITS AND ADDITIONS
DATE    DESCRIPTION                                      AMOUNT
10/02   STRIPE PAYMENTS TRANSFER ST-992140A             $4,250.00
10/09   WIRE TRANSFER INCOMING ACME CORP INVOICE 104     $3,800.00
10/16   STRIPE PAYMENTS TRANSFER ST-994321B             $2,120.50
10/28   CLIENT RETAINER DIRECT DEPOSIT METRO DIGITAL    $1,250.00

CHECKS PAID
CHECK NO.  DATE PAID   DESCRIPTION                       AMOUNT
1042       10/05       CHECK #1042                      $1,200.00
1043       10/22       CHECK #1043                        $650.00

ELECTRONIC WITHDRAWALS
DATE    DESCRIPTION                                      AMOUNT
10/03   AWS CLOUD SERVICES BILLING WEB SERVICES           $420.30
10/06   GOOGLE WORKSPACE SUITE MONTHLY CHARGE              $72.00
10/10   GUSTO PAYROLL PE-101026 TAXES & SALARY          $4,150.00
Page 1 of 2

---PAGE_BREAK---

JPMorgan Chase Bank, N.A.
P O Box 182051
Columbus OH 43218-2051

CHASE BUSINESS COMPLETE CHECKING
October 01, 2026 through October 31, 2026
Account Number: 0000008412
Page 2 of 2

ELECTRONIC WITHDRAWALS (continued)
DATE    DESCRIPTION                                      AMOUNT
10/14   AMZN MKTPLACE PMTS *3F2A1C SEATTLE WA             $184.20
10/19   GITHUB INC DEVELOPER ENTERPRISE SEATS              $42.00
10/25   VERCEL PLATFORM HOSTING TEAMS INVOICE              $60.00
10/29   OFFICE DEPOT STORE #412 SUPPLY ORDER            $1,217.40`;

export const SAMPLE_CHASE_STATEMENT_NOV = `JPMorgan Chase Bank, N.A.
P O Box 182051
Columbus OH 43218-2051

CHASE BUSINESS COMPLETE CHECKING
November 01, 2026 through November 30, 2026
Account Number: 0000008412
Page 1 of 1

CHECKING SUMMARY
Beginning Balance: $18,274.80
Deposits and Additions: $5,500.00
Electronic Withdrawals: $4,694.50
Checks Paid: $650.00
Ending Balance: $18,430.30

DEPOSITS AND ADDITIONS
DATE    DESCRIPTION                                      AMOUNT
11/02   STRIPE PAYMENTS TRANSFER ST-995400A             $3,100.00
11/16   CLIENT RETAINER DIRECT DEPOSIT APEX DESIGN      $2,400.00

CHECKS PAID
CHECK NO.  DATE PAID   DESCRIPTION                       AMOUNT
1044       11/08       CHECK #1044                        $650.00

ELECTRONIC WITHDRAWALS
DATE    DESCRIPTION                                      AMOUNT
11/04   AWS CLOUD SERVICES BILLING CLOUD RUN              $430.50
11/07   GOOGLE WORKSPACE SUITE MONTHLY CHARGE              $72.00
11/12   GUSTO PAYROLL PE-111226 TAXES & SALARY          $4,150.00
11/20   GITHUB INC DEVELOPER ENTERPRISE SEATS              $42.00`;

export const SAMPLE_AMEX_STATEMENT = `American Express National Bank
PO Box 981535
El Paso, TX 79998-1535

American Express Business Platinum Card
October 01, 2026 through October 31, 2026
Account Ending in: 81004

Summary of Account
Previous Balance: $3,200.00
Payments and Credits: $3,200.00
New Charges: $1,450.00
Total Balance Due: $1,450.00

Payments and Other Credits
10/04   AUTOPAY PAYMENT RECEIVED - THANK YOU   -$3,200.00

New Charges
10/08   DELTA AIRLINES ATLANTA GA                 $620.00
10/15   HILTON HOTELS AUSTIN TX                   $480.00
10/22   FEDEX FREIGHT MEMPHIS TN                  $350.00`;
