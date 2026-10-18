import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  Download,
  Upload,
  ArrowRight,
  Lock,
  ChevronRight,
  Building2,
  Users,
  Briefcase,
  HelpCircle,
  FileCode2,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  Landmark,
  Check,
} from 'lucide-react';

interface BankConfig {
  slug: string;
  bankName: string;
  institutionName: string;
  sourceFormat: string;
  targetFormat: string;
  badge: string;
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  heroNotice: string;
  sampleFileName: string;
  sampleBeginning: string;
  sampleEnding: string;
  sampleInflow: string;
  sampleOutflow: string;
  sampleRows: {
    date: string;
    payee: string;
    amount: string;
    isCredit: boolean;
  }[];
  supportedAccounts: string[];
  painPoints: {
    title: string;
    description: string;
  }[];
  features: {
    title: string;
    description: string;
  }[];
  steps: {
    step: string;
    title: string;
    desc: string;
  }[];
  specifications: {
    label: string;
    value: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

const BANK_DATA: Record<string, BankConfig> = {
  'chase-business-pdf-to-qbo': {
    slug: 'chase-business-pdf-to-qbo',
    bankName: 'JPMorgan Chase',
    institutionName: 'JPMorgan Chase Bank, N.A.',
    sourceFormat: 'PDF',
    targetFormat: 'QBO (QuickBooks Online)',
    badge: 'JPMorgan Chase • Certified PDF to QBO Engine',
    title: 'Convert Chase Business PDF Statements to QBO | StatementForge',
    metaDescription:
      'Convert Chase Business checking & savings statement PDFs into native QuickBooks Online (.QBO) files with 100% precision. Zero server processing, instant balance reconciliation.',
    h1: 'Convert Chase Business PDF Statements to QuickBooks (QBO)',
    subtitle:
      'Extract deposits, debit cards, wires, and checks from multi-page Chase Business checking statements into native .QBO files. Guaranteed $0.00 mathematical variance with zero server uploads.',
    heroNotice:
      'Engineered specifically for Chase Business Complete Checking, Chase Total Business, and Chase Platinum Business statement layouts.',
    sampleFileName: 'chase_business_oct2026.pdf',
    sampleBeginning: '$14,850.20',
    sampleEnding: '$18,274.80',
    sampleInflow: '+$11,420.50',
    sampleOutflow: '-$7,995.90',
    sampleRows: [
      { date: '10/02', payee: 'Stripe Payout', amount: '+$4,250.00', isCredit: true },
      { date: '10/05', payee: 'Google Cloud Platform', amount: '-$1,840.50', isCredit: false },
      { date: '10/12', payee: 'Office Depot #4812', amount: '-$245.90', isCredit: false },
      { date: '10/18', payee: 'Client Wire Deposit', amount: '+$7,170.50', isCredit: true },
    ],
    supportedAccounts: [
      'Chase Business Complete Checking',
      'Chase Performance Business Checking',
      'Chase Platinum Business Checking',
      'Chase Ink Business Credit Cards',
      'Chase Commercial Checking Accounts',
    ],
    painPoints: [
      {
        title: 'Repetitive Multi-Page Headers',
        description:
          'Chase statements repeat address banners, account numbers, and column headers on every page, causing generic OCR tools to choke or duplicate transaction rows.',
      },
      {
        title: 'Fragmented Electronic Memos',
        description:
          "Long POS memos like 'POS DEBIT 8421 SQUARE INC' and card authorization trails are broken across line wraps, resulting in truncated payees in QuickBooks.",
      },
      {
        title: 'Missing Balance Reconciliation',
        description:
          'Manual bank exports and generic CSV converters do not verify that opening balances plus net activity match the statement’s audited closing balance.',
      },
    ],
    features: [
      {
        title: 'Deterministic Header Sanitization',
        description:
          'Automatically recognizes and strips repeated Chase page headers, address blocks, and page numbers across 20+ page statement PDFs.',
      },
      {
        title: 'Native SGML-Compliant .QBO Output',
        description:
          'Generates valid <BANKTRANLIST> and <STMTTRN> tags that import directly into QuickBooks Online without formatting errors or rejected imports.',
      },
      {
        title: '$0.00 Cent-Precision Verification',
        description:
          'Computes Beginning + Credits - Debits in local memory to ensure exact cent-for-cent mathematical reconciliation against Chase’s printed ending balance.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Upload Chase PDF Statements',
        desc: 'Drag & drop one or multiple monthly Chase Business statement PDFs directly into the local browser engine.',
      },
      {
        step: '02',
        title: 'Zero-Server Client-Side Parsing',
        desc: 'StatementForge parses tables, dates, and memos entirely in your browser memory. Zero bytes transmitted to the cloud.',
      },
      {
        step: '03',
        title: 'Audit Mathematical Variance',
        desc: 'Review the $0.00 variance badge confirming beginning balance, deposits, and withdrawals match the statement summary.',
      },
      {
        step: '04',
        title: 'Export Native .QBO File',
        desc: 'Download your clean .qbo file and upload it directly into QuickBooks Online via Banking > Upload Transactions.',
      },
    ],
    specifications: [
      { label: 'Issuing Institution', value: 'JPMorgan Chase Bank, N.A.' },
      { label: 'Supported Statement Types', value: 'PDF, Scanned PDF, TXT Portal Exports' },
      { label: 'Target Output Formats', value: 'Native .QBO, .OFX, QuickBooks CSV, Xero CSV, TSV' },
      { label: 'Privacy & Security', value: '100% Client-Side Memory (Zero Server Uploads)' },
      { label: 'Reconciliation Standard', value: 'Deterministic Double-Entry Cent Check ($0.00 Variance)' },
      { label: 'Compatibility', value: 'QuickBooks Online, QuickBooks Desktop, Xero, Excel' },
    ],
    faqs: [
      {
        question: 'Can I import this .QBO file directly into QuickBooks Online?',
        answer:
          'Yes. The generated .qbo file follows strict Intuit OFX/SGML specifications. In QuickBooks Online, go to Banking > Upload Transactions and select the exported .qbo file.',
      },
      {
        question: 'Do my Chase bank statements get uploaded to any server?',
        answer:
          'No. StatementForge operates 100% in local browser memory. No files, transactions, or account numbers ever leave your machine.',
      },
      {
        question: 'How does StatementForge handle multi-page Chase statements?',
        answer:
          'Our parser uses logical page-break stitching and header sanitization to strip out repeated Chase banners on pages 2+ while properly concatenating multi-line transaction memos.',
      },
      {
        question: 'Can I convert multiple months of Chase statements at once?',
        answer:
          'Yes. You can drag and drop multiple Chase PDFs simultaneously. The engine chronologically sorts transactions across months and verifies balance continuity.',
      },
    ],
  },
  'wells-fargo-statement-to-qbo': {
    slug: 'wells-fargo-statement-to-qbo',
    bankName: 'Wells Fargo',
    institutionName: 'Wells Fargo Bank, N.A.',
    sourceFormat: 'PDF',
    targetFormat: 'QBO (QuickBooks Online)',
    badge: 'Wells Fargo • Certified PDF to QBO Engine',
    title: 'Convert Wells Fargo Statement PDFs to QBO | StatementForge',
    metaDescription:
      'Convert Wells Fargo business & personal bank statements from PDF to native QuickBooks Online (.QBO) files. Zero cloud storage, 100% client-side privacy.',
    h1: 'Convert Wells Fargo Statement PDFs to QuickBooks (QBO)',
    subtitle:
      'Accurately parse Wells Fargo account activity, check details, and deposits from PDF into clean .QBO and CSV files. Reconcile transactions with zero server data retention.',
    heroNotice:
      'Compatible with Wells Fargo Initiate Business Checking, Navigate Business, and Commercial account PDF statements.',
    sampleFileName: 'wells_fargo_business_oct2026.pdf',
    sampleBeginning: '$22,410.00',
    sampleEnding: '$26,190.50',
    sampleInflow: '+$14,280.00',
    sampleOutflow: '-$10,499.50',
    sampleRows: [
      { date: '10/03', payee: 'Customer Merchant Deposit', amount: '+$8,500.00', isCredit: true },
      { date: '10/07', payee: 'Payroll ACH Transfer', amount: '-$5,200.00', isCredit: false },
      { date: '10/14', payee: 'Check #1042', amount: '-$1,150.00', isCredit: false },
      { date: '10/22', payee: 'Merchant ACH Settlement', amount: '+$5,780.00', isCredit: true },
    ],
    supportedAccounts: [
      'Wells Fargo Initiate Business Checking',
      'Wells Fargo Navigate Business Checking',
      'Wells Fargo Growth Business Checking',
      'Wells Fargo Commercial Checking',
      'Wells Fargo Way2Save Savings',
    ],
    painPoints: [
      {
        title: 'Multi-Section Fragmented Tables',
        description:
          "Wells Fargo divides transactions across 'Deposits and Other Additions', 'Withdrawals and Other Subtractions', and 'Checks Paid', causing standard extractors to scramble dates.",
      },
      {
        title: 'Multi-Column Check Arrays',
        description:
          'Checks are commonly printed in 3 or 4 columns side by side. Standard converters fail to match check numbers with their respective amounts.',
      },
      {
        title: 'Penny Rounding Mismatches',
        description:
          'Manual entry often produces penny discrepancy errors that derail month-end close and reconciliation audits.',
      },
    ],
    features: [
      {
        title: 'Multi-Table Section Demultiplexing',
        description:
          'Parses distinct Wells Fargo transaction grids into a unified, chronologically sorted ledger ready for export.',
      },
      {
        title: 'Deterministic Check Serial Extraction',
        description:
          'Isolates check serial numbers from debit card memos to prevent misclassification in QuickBooks bank feeds.',
      },
      {
        title: 'Zero Cloud Storage Invariant',
        description:
          'Never exposes confidential Wells Fargo account numbers, balances, or wire details to third-party cloud servers.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Select Wells Fargo PDF',
        desc: 'Drag your Wells Fargo business or personal checking statement PDF into the browser dropzone.',
      },
      {
        step: '02',
        title: 'Automatic Bank Detection',
        desc: 'The multi-bank router identifies Wells Fargo statement structures and parses all tables client-side.',
      },
      {
        step: '03',
        title: 'Verify $0.00 Variance',
        desc: 'The mathematical validation engine checks your ending balance against printed statement totals.',
      },
      {
        step: '04',
        title: 'Download Clean .QBO',
        desc: 'Export a native .qbo file formatted specifically for seamless QuickBooks Online Web Connect upload.',
      },
    ],
    specifications: [
      { label: 'Issuing Institution', value: 'Wells Fargo Bank, N.A.' },
      { label: 'Supported Statement Types', value: 'PDF, Multi-Page Scanned PDF, TXT' },
      { label: 'Target Output Formats', value: 'Native .QBO, .OFX, QuickBooks CSV, Xero CSV' },
      { label: 'Privacy & Security', value: '100% Client-Side Memory (No Cloud Uploads)' },
      { label: 'Mathematical Guarantee', value: 'Exact Cent-Precision Reconciliation ($0.00 Variance)' },
      { label: 'Compatibility', value: 'QuickBooks Online, QuickBooks Desktop, Xero' },
    ],
    faqs: [
      {
        question: 'How do I upload the converted file into QuickBooks Online?',
        answer:
          "In QuickBooks Online, navigate to Bookkeeping > Transactions > Bank Transactions, click the dropdown next to 'Link account', choose 'Upload from file', and select your converted .QBO file.",
      },
      {
        question: 'Does this handle Wells Fargo multi-column check tables?',
        answer:
          'Yes. Wells Fargo frequently prints checks in multi-column grids. StatementForge correctly scans and groups check serial numbers with their respective dates and amounts.',
      },
      {
        question: 'Is my Wells Fargo banking information secure?',
        answer:
          'Yes, absolutely. All processing is 100% client-side in your local browser runtime. Zero bytes of data are sent to our or any third-party servers.',
      },
    ],
  },
  'bank-of-america-statement-to-csv': {
    slug: 'bank-of-america-statement-to-csv',
    bankName: 'Bank of America',
    institutionName: 'Bank of America, N.A.',
    sourceFormat: 'PDF',
    targetFormat: 'CSV & QBO',
    badge: 'Bank of America • Certified PDF to CSV & QBO Engine',
    title: 'Convert Bank of America Statement PDFs to CSV & QBO | StatementForge',
    metaDescription:
      'Transform Bank of America checking and credit card statement PDFs into audit-ready CSV, Excel, and QuickBooks files. Zero server processing, instant balance verification.',
    h1: 'Convert Bank of America Statement PDFs to CSV & QBO',
    subtitle:
      'Turn multi-page Bank of America business statements into clean, structured CSV and QBO files. Guaranteed zero server data retention and cent-precision balance validation.',
    heroNotice:
      'Optimized for Bank of America Business Advantage, Fundamentals Checking, and Corporate Card PDF statement layouts.',
    sampleFileName: 'bofa_business_oct2026.pdf',
    sampleBeginning: '$31,500.00',
    sampleEnding: '$35,840.25',
    sampleInflow: '+$18,900.00',
    sampleOutflow: '-$14,559.75',
    sampleRows: [
      { date: '10/04', payee: 'Wire Transfer Credit', amount: '+$12,500.00', isCredit: true },
      { date: '10/09', payee: 'Commercial Lease Payment', amount: '-$4,500.00', isCredit: false },
      { date: '10/16', payee: 'Amazon Web Services', amount: '-$1,890.25', isCredit: false },
      { date: '10/25', payee: 'Merchant Processing Credit', amount: '+$6,400.00', isCredit: true },
    ],
    supportedAccounts: [
      'Bank of America Business Advantage Fundamentals',
      'Bank of America Business Advantage Relationship',
      'Bank of America Corporate Checking',
      'Bank of America Commercial Credit Cards',
    ],
    painPoints: [
      {
        title: 'Inconsistent Column Offsets',
        description:
          'Bank of America PDF statements frequently interleave transaction dates, post dates, and running balances in staggered columns, breaking copy-pasted spreadsheets.',
      },
      {
        title: 'Overlapping Wire & ACH Metadata',
        description:
          'Long wire reference codes and routing identifiers wrap into subsequent rows, polluting raw CSV exports with phantom transactions.',
      },
      {
        title: 'Formatting Mismatches for Excel & Xero',
        description:
          'Generic PDF copy-pasting places debits and credits in the same column without proper signed indicators, requiring hours of manual formula cleanup.',
      },
    ],
    features: [
      {
        title: 'Intelligent Column Realignment',
        description:
          'Standardizes BofA transaction rows into clean Date, Payee, Memo, Debit, Credit, and Balance columns.',
      },
      {
        title: 'Signed Amount Normalization',
        description:
          'Ensures all debits are properly negative and credits positive for one-click import into Excel, QuickBooks, or Xero.',
      },
      {
        title: 'Client Privacy Masking',
        description:
          'Built-in redaction masks BofA account numbers and employee card references before generating spreadsheet exports.',
      },
    ],
    steps: [
      {
        step: '01',
        title: 'Select Bank of America PDF',
        desc: 'Drag your BofA statement PDF into the browser dropzone.',
      },
      {
        step: '02',
        title: 'Instant Browser Conversion',
        desc: 'Client-side engine extracts all rows without sending documents to any remote server.',
      },
      {
        step: '03',
        title: 'Audit Balance Variance',
        desc: "Check that the calculated ending balance matches BofA's printed statement balance to the exact cent.",
      },
      {
        step: '04',
        title: 'Download CSV or QBO',
        desc: 'Choose between QuickBooks Online CSV, Standard 4-Column CSV, Xero CSV, or native .QBO.',
      },
    ],
    specifications: [
      { label: 'Issuing Institution', value: 'Bank of America, N.A.' },
      { label: 'Supported Statement Types', value: 'PDF, Scanned PDF, TXT' },
      { label: 'Target Output Formats', value: 'Standard CSV, QuickBooks CSV, Xero CSV, .QBO, TSV' },
      { label: 'Privacy & Security', value: '100% Client-Side Memory (0 Bytes Transmitted)' },
      { label: 'Mathematical Guarantee', value: 'Exact Cent-Precision Reconciliation ($0.00 Variance)' },
      { label: 'Compatibility', value: 'Microsoft Excel, Google Sheets, QuickBooks, Xero' },
    ],
    faqs: [
      {
        question: 'Can I export Bank of America statements to Microsoft Excel?',
        answer:
          'Yes. You can export clean standard CSV, TSV for direct paste, or 4-column ledger formats with debit and credit columns separated.',
      },
      {
        question: 'Does it work with Bank of America credit card statements?',
        answer:
          'Yes. StatementForge parses Bank of America credit card statements as well as checking and deposit accounts.',
      },
      {
        question: "Will my client's account numbers remain confidential?",
        answer:
          'Yes. Our Privacy Redaction mode automatically replaces sensitive account numbers with masked characters (••••8412).',
      },
    ],
  },
};

export async function generateStaticParams() {
  return [
    { slug: 'chase-business-pdf-to-qbo' },
    { slug: 'wells-fargo-statement-to-qbo' },
    { slug: 'bank-of-america-statement-to-csv' },
  ];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bank = BANK_DATA[slug];

  if (!bank) {
    return {
      title: 'Bank Statement Converter | StatementForge',
      description: 'Convert bank statement PDFs to QBO and CSV with 100% precision.',
    };
  }

  const canonicalUrl = `https://statement-forge.vercel.app/banks/${bank.slug}`;

  return {
    title: bank.title,
    description: bank.metaDescription,
    keywords: [
      `${bank.bankName} PDF to QBO`,
      `convert ${bank.bankName} statement to QuickBooks`,
      `${bank.bankName} statement to CSV`,
      'bank statement converter',
      'QBO converter',
      'zero server financial tools',
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: bank.title,
      description: bank.metaDescription,
      url: canonicalUrl,
      siteName: 'StatementForge by Assay',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: bank.title,
      description: bank.metaDescription,
    },
  };
}

export default async function BankSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const bank = BANK_DATA[slug];

  if (!bank) {
    notFound();
  }

  // JSON-LD Structured Data Schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `StatementForge — ${bank.h1}`,
        description: bank.metaDescription,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web Browser (All Platforms)',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Assay Studio',
          url: 'https://statement-forge.vercel.app',
        },
      },
      {
        '@type': 'HowTo',
        name: `How to convert ${bank.bankName} PDF to ${bank.targetFormat}`,
        description: bank.subtitle,
        step: bank.steps.map((s, idx) => ({
          '@type': 'HowToStep',
          position: idx + 1,
          name: s.title,
          text: s.desc,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: bank.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. TOP NAVIGATION */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-40 transition-all">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-900 text-lg tracking-tight">StatementForge</span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                by Assay
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <Link href="/tools/statementforge" className="hover:text-slate-900 transition-colors">
              Workspace
            </Link>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
              How It Works
            </a>
            <a href="#specifications" className="hover:text-slate-900 transition-colors">
              Specifications
            </a>
            <a href="#faqs" className="hover:text-slate-900 transition-colors">
              FAQ
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-medium"
            title="All tools execute 100% in local browser memory"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero-Server Engine</span>
          </div>

          <Link
            href="/tools/statementforge"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm hover:shadow"
          >
            <span>Launch Converter Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. HERO SECTION (Targeted for the specific bank format) */}
      <main className="flex-1">
        <section className="px-6 sm:px-10 pt-16 pb-12 max-w-5xl mx-auto text-center">
          {/* Bank Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="text-xs font-semibold tracking-wide">{bank.badge}</span>
          </div>

          {/* Programmatic SEO Dynamic Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.14]">
            {bank.h1}
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {bank.subtitle}
          </p>

          <p className="mt-3 text-xs text-slate-500 font-medium">
            {bank.heroNotice}
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/tools/statementforge"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm hover:shadow-md"
            >
              <Upload className="w-4 h-4" />
              <span>Convert {bank.bankName} PDF Now</span>
            </Link>

            <Link
              href="/tools/statementforge"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-full text-xs sm:text-sm font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Try Live Interactive Demo</span>
            </Link>
          </div>

          {/* Trust Metrics Bar */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-left">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="font-mono text-xl font-bold text-slate-900">0 bytes</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Sent to cloud servers</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Parsing, OCR text parsing, and math run in local browser memory.
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="font-mono text-xl font-bold text-emerald-700">$0.00</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Variance guaranteed</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Deterministic validation confirms beginning + net flow matches ending balance.
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="font-mono text-xl font-bold text-blue-700">Native {bank.targetFormat}</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">Import ready</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Formatted with Intuit-compliant SGML tags for instant import.
              </div>
            </div>
          </div>
        </section>

        {/* 3. WORKSPACE PREVIEW CARD (Demonstrates the live parser for this bank) */}
        <section className="px-6 sm:px-10 py-6 max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {bank.bankName} Conversion Engine Snapshot
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                    <span>{bank.sampleFileName}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold font-sans">
                      [✓ RECONCILED: $0.00 VARIANCE]
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Target: {bank.targetFormat}
                </span>
                <Link
                  href="/tools/statementforge"
                  className="px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                >
                  Test in Workspace
                </Link>
              </div>
            </div>

            {/* Telemetry row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Beginning</span>
                <strong className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">
                  {bank.sampleBeginning}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-emerald-700 font-medium block">Total Deposits (In)</span>
                <strong className="text-sm font-mono font-bold text-emerald-700 mt-0.5 block">
                  {bank.sampleInflow}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Withdrawals (Out)</span>
                <strong className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">
                  {bank.sampleOutflow}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-blue-200 bg-blue-50/40">
                <span className="text-[11px] text-blue-700 font-semibold block">Ending Balance</span>
                <strong className="text-sm font-mono font-bold text-blue-700 mt-0.5 block">
                  {bank.sampleEnding}
                </strong>
              </div>
            </div>

            {/* Sample Table Rows */}
            <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Clean Vendor / Payee</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bank.sampleRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">{r.date}</td>
                      <td className="px-4 py-2.5 text-slate-900 font-medium">{r.payee}</td>
                      <td
                        className={`px-4 py-2.5 font-mono font-semibold text-right tabular-nums ${
                          r.isCredit ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {r.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/tools/statementforge"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 group"
              >
                <span>Launch StatementForge with sample {bank.bankName} data</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* 4. BANK-SPECIFIC FRICTION & PAIN POINTS */}
        <section className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
              The Problem with {bank.bankName} Statements
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
              Why converting {bank.bankName} PDFs manually breaks down.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Standard OCR converters and manual CSV copy-pasting introduce unnoticeable errors that cost hours during month-end reconciliation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bank.painPoints.map((p, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs mb-3">
                  ✕
                </div>
                <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. "TROJAN HORSE" FIRM UPSELL BANNER (Crucial High-Converting Section) */}
        <section className="px-6 sm:px-10 py-8 max-w-5xl mx-auto">
          <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-mono uppercase tracking-wider">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span>Accounting Firm & CPA Multi-Client Pass</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                Converting statements for 10+ clients every month?
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Stop converting statements one file at a time. The <strong>Assay Firm License</strong> gives your bookkeeping practice unlimited multi-client bulk PDF processing, persistent custom vendor mapping rules, multi-bank normalization (Chase, BofA, Wells Fargo), and zero-server client confidentiality compliance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited monthly client PDF conversions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom vendor mapping rules saved per client</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cross-bank router: Chase, Wells, BofA, Amex</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero-server privacy (SOC2 / client compliance safe)</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/tools/statementforge"
                  className="px-6 py-3.5 rounded-full text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white text-center transition-colors shadow-md"
                >
                  Unlock Accounting Firm License ($199/yr)
                </Link>

                <Link
                  href="/tools/statementforge"
                  className="px-5 py-3.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 text-center transition-colors border border-slate-700"
                >
                  Launch Single Free Conversion
                </Link>
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                Used by 450+ independent bookkeepers, fractional CFOs, and tax preparers.
              </div>
            </div>

            {/* Subtle decorative background glow */}
            <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          </div>
        </section>

        {/* 6. HOW IT WORKS: 4-STEP CONVERSION PROCESS */}
        <section id="how-it-works" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
              Step-by-Step Guide
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
              How to convert {bank.bankName} statements to {bank.targetFormat}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Follow these simple steps to go from a locked statement PDF to verified QuickBooks or spreadsheet rows in under 10 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {bank.steps.map((st, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-2xl font-bold text-blue-600">{st.step}</span>
                  <h3 className="text-sm font-bold text-slate-900 mt-3">{st.title}</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. TECHNICAL SPECIFICATIONS TABLE */}
        <section id="specifications" className="px-6 sm:px-10 py-12 max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Technical Specifications & Compatibility
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bank.specifications.map((spec, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs text-slate-500 block">{spec.label}</span>
                  <strong className="text-xs sm:text-sm font-semibold text-slate-900 mt-1 block">
                    {spec.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. FREQUENTLY ASKED QUESTIONS */}
        <section id="faqs" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Common questions about converting {bank.bankName} statements with StatementForge.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {bank.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-2"
              >
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{faq.question}</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-6">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 9. CROSS-LINKS TO OTHER SUPPORTED BANKS */}
        <section className="px-6 sm:px-10 py-12 max-w-5xl mx-auto border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
            Other Supported Bank Statement Formats
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {Object.values(BANK_DATA)
              .filter((b) => b.slug !== bank.slug)
              .map((other) => (
                <Link
                  key={other.slug}
                  href={`/banks/${other.slug}`}
                  className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all group flex items-center justify-between"
                >
                  <div>
                    <strong className="block text-slate-900 font-semibold">{other.bankName}</strong>
                    <span className="text-slate-500 text-[11px]">Convert PDF to {other.targetFormat}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
          </div>
        </section>
      </main>

      {/* 10. FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-10 px-6 sm:px-10 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-slate-900">StatementForge by Assay</span>
            <span className="text-slate-300">•</span>
            <span>Zero-server deterministic statement conversions.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-600">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Storefront
            </Link>
            <Link href="/tools/statementforge" className="hover:text-slate-900 transition-colors">
              Workspace
            </Link>
            <Link href="/banks/chase-business-pdf-to-qbo" className="hover:text-slate-900 transition-colors">
              Chase QBO
            </Link>
            <Link href="/banks/wells-fargo-statement-to-qbo" className="hover:text-slate-900 transition-colors">
              Wells Fargo QBO
            </Link>
            <Link href="/banks/bank-of-america-statement-to-csv" className="hover:text-slate-900 transition-colors">
              BofA CSV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
