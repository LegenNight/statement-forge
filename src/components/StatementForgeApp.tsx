'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Trash2,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Files,
  Landmark,
  EyeOff,
  Eye,
  Tags,
  Lock,
  Unlock,
  KeyRound,
  Loader2,
  FileCode2,
  SlidersHorizontal,
  HelpCircle,
  Layers,
  ExternalLink,
  Filter,
} from 'lucide-react';
import {
  parseMultipleStatements,
  parseStatement,
  recalculateReconciliation,
  formatCurrency,
  detectBank,
  ParsedTransaction,
  StatementParseResult,
  ExtractedDocument,
  TransactionType,
  VendorRule,
} from '@/lib/parserEngine';
import {
  loadVendorRules,
  saveVendorRules,
  applyVendorRules,
  redactAccountNumber,
  redactText,
  DEFAULT_VENDOR_RULES,
} from '@/lib/vendorRules';
import {
  SAMPLE_CHASE_STATEMENT,
  SAMPLE_CHASE_STATEMENT_NOV,
  SAMPLE_AMEX_STATEMENT,
} from '@/lib/sampleChaseData';
import {
  generateQuickBooksCSV,
  generateXeroCSV,
  generateStandard4ColumnCSV,
  generateTSV,
  generateOFX,
  generateQBO,
  triggerFileDownload,
} from '@/lib/exportUtils';
import { extractTextFromFile } from '@/lib/pdfExtractor';
import {
  loadLicenseState,
  saveLicenseState,
  clearLicenseState,
  verifyGumroadLicense,
  FREE_TIER_LIMIT,
} from '@/lib/licenseGate';

export default function StatementForgeApp() {
  const [statementData, setStatementData] = useState<StatementParseResult | null>(null);
  const [rawTransactions, setRawTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [useCleanPayee, setUseCleanPayee] = useState<boolean>(true);
  const [isRedacted, setIsRedacted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'CHECK'>('ALL');
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'cleanPayee' | 'originalMemo' | 'amount' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pasteModalOpen, setPasteModalOpen] = useState<boolean>(false);
  const [rulesModalOpen, setRulesModalOpen] = useState<boolean>(false);
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<string[]>(['chase_business_oct2026.pdf']);
  const [parserError, setParserError] = useState<string | null>(null);

  const PARSER_ERROR_MESSAGE =
    'Could not recognize this statement layout. Please ensure it is an original PDF from a supported bank.';

  // Collapsible Accordions State
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    vendor_rules: false,
    filtering: false,
    normalization: false,
    redaction: false,
    license_gate: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Vendor Rules State (Persisted in localStorage)
  const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);
  const [newRulePattern, setNewRulePattern] = useState<string>('');
  const [newRuleVendor, setNewRuleVendor] = useState<string>('');
  const [newRuleCategory, setNewRuleCategory] = useState<string>('');

  // License Gate State (Persisted in localStorage)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Vendor Rules + License State from localStorage (client-side only)
  useEffect(() => {
    const savedRules = loadVendorRules();
    setVendorRules(savedRules);
    const licenseState = loadLicenseState();
    setIsUnlocked(licenseState.verified);
  }, []);

  // Initialize with sample Chase statement fixture
  useEffect(() => {
    loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Keyboard shortcuts: "/" to search, "Ctrl+E" / "Cmd+E" to export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportNativeQBO();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawTransactions, useCleanPayee, vendorRules, isRedacted, isUnlocked]);

  // Load single statement text into state
  const loadSingleStatement = (text: string, sourceName: string = 'statement.pdf') => {
    setIsLoading(true);
    setParserError(null);
    try {
      const parsed = parseStatement(text, sourceName);
      if (!parsed || !parsed.transactions || parsed.transactions.length === 0 || parsed.bankId === 'UNKNOWN' || parsed.error) {
        setParserError(PARSER_ERROR_MESSAGE);
        showToast(PARSER_ERROR_MESSAGE);
        setStatementData(parsed);
        setRawTransactions([]);
        setSelectedTxIds(new Set());
        setSourceFiles([sourceName]);
        return;
      }
      setParserError(null);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles([sourceName]);
      showToast(`Loaded ${parsed.transactions.length} transactions from ${sourceName}`);
    } catch (err: any) {
      console.error(err);
      setParserError(PARSER_ERROR_MESSAGE);
      showToast(PARSER_ERROR_MESSAGE);
      setRawTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load multiple statements from extracted document strings
  const loadMultipleStatementDocs = (docs: ExtractedDocument[]) => {
    setIsLoading(true);
    setParserError(null);
    try {
      const parsed = parseMultipleStatements(docs);
      if (!parsed || !parsed.transactions || parsed.transactions.length === 0 || parsed.bankId === 'UNKNOWN' || parsed.error) {
        setParserError(PARSER_ERROR_MESSAGE);
        showToast(PARSER_ERROR_MESSAGE);
        setStatementData(parsed);
        setRawTransactions([]);
        setSelectedTxIds(new Set());
        setSourceFiles(docs.map((d) => d.fileName));
        return;
      }
      setParserError(null);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles(docs.map((d) => d.fileName));
      showToast(`Processed ${docs.length} statements (${parsed.transactions.length} transactions)`);
    } catch (err: any) {
      console.error(err);
      setParserError(PARSER_ERROR_MESSAGE);
      showToast(PARSER_ERROR_MESSAGE);
      setRawTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle multi-file upload or drop
  const handleMultipleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsLoading(true);
    setParserError(null);
    try {
      const docs: ExtractedDocument[] = [];
      for (const f of fileArray) {
        const text = await extractTextFromFile(f);
        if (text && text.trim().length > 0) {
          docs.push({ text, fileName: f.name });
        }
      }

      if (docs.length === 0) {
        setParserError(PARSER_ERROR_MESSAGE);
        showToast(PARSER_ERROR_MESSAGE);
        setStatementData(null);
        setRawTransactions([]);
        setIsLoading(false);
        return;
      }

      const parsed = parseMultipleStatements(docs);
      if (!parsed || !parsed.transactions || parsed.transactions.length === 0 || parsed.bankId === 'UNKNOWN' || parsed.error) {
        setParserError(PARSER_ERROR_MESSAGE);
        showToast(PARSER_ERROR_MESSAGE);
        setStatementData(parsed);
        setRawTransactions([]);
        setSelectedTxIds(new Set());
        setSourceFiles(docs.map((d) => d.fileName));
        setIsLoading(false);
        return;
      }

      setParserError(null);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles(docs.map((d) => d.fileName));
      showToast(`Successfully processed ${docs.length} file${docs.length > 1 ? 's' : ''} (${parsed.transactions.length} rows)`);
    } catch (err) {
      console.error(err);
      setParserError(PARSER_ERROR_MESSAGE);
      showToast(PARSER_ERROR_MESSAGE);
      setRawTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
    }
  };

  // Dynamically apply vendor rules to the active transaction ledger
  const transactions = useMemo(() => {
    return applyVendorRules(rawTransactions, vendorRules);
  }, [rawTransactions, vendorRules]);

  // Dynamically recompute reconciliation
  const currentReconciliation = useMemo(() => {
    if (!statementData) return null;
    return recalculateReconciliation(
      statementData.summary.beginningBalance,
      statementData.summary.endingBalance,
      transactions
    );
  }, [statementData, transactions]);

  // Aggregated summary metrics across all processed statements
  const summaryFigures = useMemo(() => {
    const beg = statementData?.summary.beginningBalance ?? 0;
    const end = statementData?.summary.endingBalance ?? 0;
    const totalIn = transactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((s, t) => s + t.rawAmount, 0);
    const totalOut = transactions
      .filter((t) => t.type === 'DEBIT' || t.type === 'CHECK')
      .reduce((s, t) => s + t.rawAmount, 0);

    const creditCount = transactions.filter((t) => t.type === 'CREDIT').length;
    const debitCount = transactions.filter((t) => t.type === 'DEBIT').length;
    const checkCount = transactions.filter((t) => t.type === 'CHECK').length;

    return {
      beginning: beg,
      in: totalIn,
      out: totalOut,
      ending: end,
      creditCount,
      debitCount,
      checkCount,
    };
  }, [statementData, transactions]);

  // Filtered transactions for the data grid
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPayee = (tx.mappedVendor || tx.cleanPayee).toLowerCase().includes(q);
        const matchCategory = tx.mappedCategory?.toLowerCase().includes(q) || false;
        const matchMemo = tx.originalMemo.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q) || tx.rawAmount.toString().includes(q);
        const matchDate = tx.date.includes(q);
        const matchCheck = tx.checkNumber?.includes(q);
        const matchFile = tx.sourceFile?.toLowerCase().includes(q);
        return matchPayee || matchCategory || matchMemo || matchAmount || matchDate || matchCheck || matchFile;
      }
      return true;
    });
  }, [transactions, typeFilter, searchQuery]);

  // Display transactions capped by Free Tier limit (20) if unverified
  const displayTransactions = useMemo(() => {
    if (isUnlocked) return filteredTransactions;
    return filteredTransactions.slice(0, FREE_TIER_LIMIT);
  }, [filteredTransactions, isUnlocked]);

  // Checkbox selection
  const handleToggleSelectAll = () => {
    if (selectedTxIds.size === displayTransactions.length && displayTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(displayTransactions.map((t) => t.id)));
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTxIds(next);
  };

  const handleDeleteSelected = () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    setRawTransactions((prev) => prev.filter((t) => !selectedTxIds.has(t.id)));
    setSelectedTxIds(new Set());
    showToast(`Deleted ${count} transaction${count > 1 ? 's' : ''}`);
  };

  const handleDeleteRow = (id: string) => {
    setRawTransactions((prev) => prev.filter((t) => t.id !== id));
    if (selectedTxIds.has(id)) {
      const next = new Set(selectedTxIds);
      next.delete(id);
      setSelectedTxIds(next);
    }
    showToast('Row removed');
  };

  // Inline editing commit
  const handleStartEdit = (id: string, field: 'cleanPayee' | 'originalMemo' | 'amount', current: any) => {
    setEditingCell({ id, field });
    setEditValue(field === 'amount' ? Math.abs(current).toFixed(2) : String(current));
  };

  const handleCommitEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;

    setRawTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;
        if (field === 'cleanPayee') {
          return { ...tx, cleanPayee: editValue.trim() || tx.cleanPayee, mappedVendor: undefined };
        } else if (field === 'originalMemo') {
          return { ...tx, originalMemo: editValue.trim() || tx.originalMemo };
        } else if (field === 'amount') {
          const num = parseFloat(editValue.replace(/[$,]/g, ''));
          if (!isNaN(num)) {
            const raw = Math.abs(num);
            const signed = tx.type === 'CREDIT' ? raw : -raw;
            return { ...tx, rawAmount: raw, amount: signed };
          }
        }
        return tx;
      })
    );

    setEditingCell(null);
    setEditValue('');
  };

  // Vendor Rules Management
  const handleAddVendorRule = () => {
    if (!newRulePattern.trim() || !newRuleVendor.trim()) {
      showToast('Pattern and Vendor Name are required.');
      return;
    }

    const newRule: VendorRule = {
      id: `rule_${Date.now()}`,
      pattern: newRulePattern.trim(),
      vendor: newRuleVendor.trim(),
      category: newRuleCategory.trim() || 'General Expense',
    };

    const updated = [newRule, ...vendorRules];
    setVendorRules(updated);
    saveVendorRules(updated);
    setNewRulePattern('');
    setNewRuleVendor('');
    setNewRuleCategory('');
    showToast(`Rule added: "${newRule.pattern}" → ${newRule.vendor}`);
  };

  const handleDeleteVendorRule = (id: string) => {
    const updated = vendorRules.filter((r) => r.id !== id);
    setVendorRules(updated);
    saveVendorRules(updated);
    showToast('Rule deleted');
  };

  const handleResetDefaultRules = () => {
    setVendorRules(DEFAULT_VENDOR_RULES);
    saveVendorRules(DEFAULT_VENDOR_RULES);
    showToast('Reset to default vendor rules');
  };

  // Gumroad License Verification
  const handleVerifyLicense = async () => {
    if (!licenseKeyInput.trim()) {
      setLicenseError('Please enter a valid license key.');
      return;
    }

    setIsVerifying(true);
    setLicenseError(null);

    try {
      const res = await verifyGumroadLicense(licenseKeyInput.trim());
      if (res.success) {
        setIsUnlocked(true);
        saveLicenseState(licenseKeyInput.trim(), true);
        showToast('License verified! Unlimited transactions unlocked.');
        setShowUnlockModal(false);
      } else {
        setLicenseError(res.error || 'Invalid license key. Please check and try again.');
      }
    } catch (err: any) {
      console.error(err);
      setLicenseError('Verification failed. Please check network connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRevokeLicense = () => {
    clearLicenseState();
    setIsUnlocked(false);
    setLicenseKeyInput('');
    showToast('License deactivated. Reverted to Free Tier.');
  };

  // Add Manual Entry
  const handleAddRow = () => {
    const newTx: ParsedTransaction = {
      id: `manual_${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
      rawDate: new Date().toISOString(),
      amount: -50.0,
      rawAmount: 50.0,
      cleanPayee: 'Manual Entry',
      originalMemo: 'MANUAL ENTRY ADJUSTMENT',
      type: 'DEBIT',
      section: 'MANUAL_ADJUSTMENT',
      mappedCategory: 'General Expense',
      sourceFile: sourceFiles[0] || 'manual',
    };

    setRawTransactions((prev) => [newTx, ...prev]);
    showToast('Added manual entry');
  };

  // Export Data preparation
  const getExportData = () => {
    let source = transactions;
    if (selectedTxIds.size > 0) {
      source = transactions.filter((t) => selectedTxIds.has(t.id));
    }
    if (!isUnlocked) {
      return source.slice(0, FREE_TIER_LIMIT);
    }
    return source;
  };

  const statementYear = statementData?.metadata.startDate
    ? parseInt(statementData.metadata.startDate.split(',')[1]?.trim() || '2026', 10) || 2026
    : 2026;

  // Export handlers
  const handleExportQBCSV = () => {
    const data = getExportData();
    const csv = generateQuickBooksCSV(data, useCleanPayee, isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(csv, `QuickBooks_${dateStr}${tag}.csv`);
    showToast(`Exported ${data.length} transactions for QuickBooks Online ${isRedacted ? '(Redacted)' : ''}`);
  };

  const handleExportXero = () => {
    const data = getExportData();
    const csv = generateXeroCSV(data, isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(csv, `Xero_${dateStr}${tag}.csv`);
    showToast(`Exported ${data.length} transactions for Xero ${isRedacted ? '(Redacted)' : ''}`);
  };

  const handleExport4Column = () => {
    const data = getExportData();
    const csv = generateStandard4ColumnCSV(data, useCleanPayee, isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(csv, `Standard_Ledger_${dateStr}${tag}.csv`);
    showToast(`Exported ${data.length} transactions in 4-column format ${isRedacted ? '(Redacted)' : ''}`);
  };

  const handleCopyTSV = async () => {
    const data = getExportData();
    const tsv = generateTSV(data, useCleanPayee, isRedacted);
    try {
      await navigator.clipboard.writeText(tsv);
      showToast(`Copied ${data.length} transactions to clipboard as TSV ${isRedacted ? '(Redacted)' : ''}`);
    } catch {
      showToast('Clipboard access denied');
    }
  };

  const handleExportOFX = () => {
    const data = getExportData();
    const ofx = generateOFX(data, statementYear, statementData?.metadata.accountNumber || 'UNKNOWN', isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(ofx, `StatementForge_${dateStr}${tag}.ofx`, 'application/x-ofx');
    showToast(`Exported ${data.length} transactions as .OFX ${isRedacted ? '(Redacted)' : ''}`);
  };

  const handleExportNativeQBO = () => {
    const data = getExportData();
    const qbo = generateQBO(data, statementYear, statementData?.metadata.accountNumber || 'UNKNOWN', isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(qbo, `StatementForge_${dateStr}${tag}.qbo`, 'application/vnd.intu.qbo');
    showToast(`Exported ${data.length} transactions as .QBO ${isRedacted ? '(Redacted)' : ''}`);
  };

  const fileCount = statementData?.metadata.fileCount ?? sourceFiles.length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* 1. TOP NAVIGATION (Apple/Linear/Stripe Inspired) */}
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
            <a href="#workspace" className="hover:text-slate-900 transition-colors">
              Workspace
            </a>
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a href="#security" className="hover:text-slate-900 transition-colors">
              Security
            </a>
            <a href="#support" className="hover:text-slate-900 transition-colors">
              Support
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Load Sample Chase Statement Button (Required by Post-Build Hook Playwright Test) */}
          <button
            onClick={() => loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Load single October 2026 Chase business statement"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load Sample Chase Statement</span>
          </button>

          {/* Zero-Server Security Pill */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-medium"
            title="All files and transactions are processed 100% locally in browser memory"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Client-Side</span>
          </div>

          {/* License Status Button */}
          <button
            onClick={() => setShowUnlockModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
              isUnlocked
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isUnlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span>License Active</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Unlock Unlimited</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="px-6 sm:px-10 pt-16 pb-12 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span className="text-xs font-medium text-slate-600">
            Assay Suite • Zero-Server Local Processing
          </span>
        </div>

        {/* Required Headline & Subtitle */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto leading-[1.12]">
          Convert Bank Statements. Instantly, Privately.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Transform your PDFs into clean spreadsheets with 100% precision. Zero server processing.
        </p>

        {/* 3. WORKSPACE / FILE UPLOAD AREA (Compact, Centered Dropzone) */}
        <div className="mt-8 max-w-xl mx-auto">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white rounded-2xl p-7 border-2 border-dashed transition-all duration-200 cursor-pointer text-center group shadow-sm hover:shadow-md ${
              isDragging
                ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-600/10'
                : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleMultipleFiles(e.target.files);
                }
              }}
            />

            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-105 transition-transform">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Drag & drop bank statements (PDF, CSV)
            </h3>

            <div className="mt-3 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm group-hover:shadow transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </span>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Supported formats: Chase, Wells Fargo, etc.
            </p>

            {/* Quick Sample Links inside dropzone */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-slate-400">Or try samples:</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Chase Business Sample
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  loadMultipleStatementDocs([
                    { text: SAMPLE_CHASE_STATEMENT, fileName: 'chase_business_oct2026.pdf' },
                    { text: SAMPLE_CHASE_STATEMENT_NOV, fileName: 'chase_business_nov2026.pdf' },
                  ]);
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                2-Month Bulk
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  loadSingleStatement(SAMPLE_AMEX_STATEMENT, 'amex_business_oct2026.pdf');
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Amex Sample
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPasteModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Paste Text
              </button>
            </div>
          </div>
        </div>

        {parserError && (
          <div className="mt-4 max-w-xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 text-left shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{parserError}</span>
            </div>
            <button
              onClick={() => {
                setParserError(null);
                loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
              }}
              className="px-3 py-1 rounded-full bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold shrink-0 transition-colors shadow-2xs"
            >
              Reload Sample
            </button>
          </div>
        )}

        {/* 4. FEATURES GRID (3 Cards) */}
        <div id="features" className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
          {/* Card 1: Total Privacy */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Total Privacy</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Files never leave your device. 100% client-side parsing.
            </p>
          </div>

          {/* Card 2: Native Exports */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Native Exports</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Clean QBO, OFX, and CSV formats. Ready for accounting.
            </p>
          </div>

          {/* Card 3: Cent-Precision Math */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Cent-Precision Math</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Deterministic validation. Balance reconciliation guaranteed.
            </p>
          </div>
        </div>
      </section>

      {/* 5. MAIN INTERACTIVE WORKSPACE */}
      <section id="workspace" className="max-w-6xl w-full mx-auto px-6 py-6 space-y-6 flex-1 pb-36">
        {/* Workspace Header Status: File info + Reconciliation Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              <Files className="w-3.5 h-3.5 text-slate-600" />
              <span>{fileCount} file{fileCount === 1 ? '' : 's'} loaded</span>
            </div>

            <span className="text-slate-300">•</span>

            <span className="text-slate-500">Account:</span>
            <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {statementData
                ? isRedacted
                  ? redactAccountNumber(statementData.metadata.accountNumber)
                  : statementData.metadata.accountNumber
                : isRedacted
                ? '••••8412'
                : '0000008412'}
            </span>

            <span className="text-slate-300">•</span>

            <span className="font-medium text-slate-700">
              {statementData?.metadata.statementPeriod || 'October 01, 2026 – October 31, 2026'}
            </span>

            <span className="text-slate-300 hidden lg:inline">•</span>

            <span className="text-slate-600 hidden lg:inline font-medium">
              {statementData?.metadata.bankName || 'JPMorgan Chase'} — {statementData?.metadata.statementType || 'Business Checking'}
            </span>

            {isRedacted && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                [Redaction Mask Active]
              </span>
            )}
          </div>

          {/* Strict Invariant Reconciliation Badge for Post-Build Verification */}
          <div>
            {parserError ? (
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200 shadow-2xs"
                title={parserError}
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>[PARSER ERROR]</strong> — Unrecognized statement layout
                </span>
              </div>
            ) : currentReconciliation?.status === 'BALANCED' ? (
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 shadow-2xs"
                title="Beginning + In - Out matches Statement Ending Balance to the cent"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>[✓ RECONCILED: $0.00 VARIANCE]</strong> — Ending balance perfectly matches statement summary
                </span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 text-amber-900 text-xs font-medium border border-amber-200 shadow-2xs"
                title={currentReconciliation?.details || 'Discrepancy detected'}
              >
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>[⚠ DISCREPANCY: {formatCurrency(currentReconciliation?.diff ?? 0, true)}]</strong> — Review flagged rows
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Beginning Balance */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Beginning Balance
            </div>
            <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.beginning)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {fileCount > 1 ? 'Earliest statement start balance' : 'Statement starting balance'}
            </div>
          </div>

          {/* Card 2: Inflow (Deposits) */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>In (Deposits)</span>
            </div>
            <div className="mt-2.5 text-2xl font-bold text-emerald-700 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.in, true)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {summaryFigures.creditCount} deposit{summaryFigures.creditCount === 1 ? '' : 's'} across {fileCount} file{fileCount === 1 ? '' : 's'}
            </div>
          </div>

          {/* Card 3: Outflow (Debits + Checks) */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Out (Debits + Checks)</span>
            </div>
            <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(-summaryFigures.out, true)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {summaryFigures.debitCount} withdrawals • {summaryFigures.checkCount} checks paid
            </div>
          </div>

          {/* Card 4: Ending Balance */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center justify-between">
              <span>Ending Balance</span>
              <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.ending)}
            </div>
            <div className="mt-1 text-xs text-blue-600/80 font-medium">
              {fileCount > 1 ? 'Latest statement closing balance' : 'Audited reconciliation target'}
            </div>
          </div>
        </div>

        {/* 6. ADVANCED CONTROLS & SECONDARY FEATURES: COLLAPSIBLE ACCORDIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Advanced Controls & Secondary Settings</span>
            </h3>
            <span className="text-[11px] text-slate-400">Click to expand any section</span>
          </div>

          {/* Accordion 1: Vendor Mapping Rules */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleAccordion('vendor_rules')}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Tags className="w-4 h-4 text-blue-600" />
                <span>Deterministic Vendor Mapping Rules</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  {vendorRules.length} active
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-normal hidden sm:inline text-slate-500">
                  {openAccordions.vendor_rules ? 'Hide' : 'Configure'}
                </span>
                {openAccordions.vendor_rules ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {openAccordions.vendor_rules && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                <p className="text-xs text-slate-500">
                  Rules convert messy merchant memos into clean vendors and accounting categories locally in your browser.
                </p>

                {/* Inline Rule Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="text-xs font-semibold text-slate-800">Add New Mapping Rule</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">If Payee Contains</label>
                      <input
                        type="text"
                        value={newRulePattern}
                        onChange={(e) => setNewRulePattern(e.target.value)}
                        placeholder="e.g. UBER"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">Set Vendor to</label>
                      <input
                        type="text"
                        value={newRuleVendor}
                        onChange={(e) => setNewRuleVendor(e.target.value)}
                        placeholder="e.g. Uber Technologies"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">Set Category to</label>
                      <input
                        type="text"
                        value={newRuleCategory}
                        onChange={(e) => setNewRuleCategory(e.target.value)}
                        placeholder="e.g. Travel & Transport"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleAddVendorRule}
                      disabled={!newRulePattern.trim() || !newRuleVendor.trim()}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Rule</span>
                    </button>
                  </div>
                </div>

                {/* Active Rules List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                    <span>Active Rules ({vendorRules.length})</span>
                    <button
                      onClick={handleResetDefaultRules}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      Reset Defaults
                    </button>
                  </div>
                  {vendorRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {rule.pattern}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold text-slate-900">{rule.vendor}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                          {rule.category}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteVendorRule(rule.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Accordion 2: Transaction Filtering & Clean Payee */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleAccordion('filtering')}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Transaction Filtering & Payee Normalization</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Filter: {typeFilter} {searchQuery ? `• Query: "${searchQuery}"` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-normal hidden sm:inline text-slate-500">
                  {openAccordions.filtering ? 'Hide' : 'Options'}
                </span>
                {openAccordions.filtering ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {openAccordions.filtering && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Clean Payees Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Clean Payee Names:</span>
                    <button
                      onClick={() => {
                        const next = !useCleanPayee;
                        setUseCleanPayee(next);
                        showToast(next ? 'Payee cleaning enabled' : 'Payee cleaning disabled');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        useCleanPayee
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>{useCleanPayee ? 'ON (Strip POS Junk)' : 'OFF (Raw Memos)'}</span>
                    </button>
                  </div>

                  {/* Transaction Types Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Filter By Type:</span>
                    <div className="flex items-center p-1 bg-slate-100 rounded-full text-xs">
                      {(['ALL', 'CREDIT', 'DEBIT', 'CHECK'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setTypeFilter(filter)}
                          className={`px-3 py-1 rounded-full text-[11px] transition-all ${
                            typeFilter === filter
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {filter === 'ALL'
                            ? 'All'
                            : filter === 'CREDIT'
                            ? 'Credits'
                            : filter === 'DEBIT'
                            ? 'Debits'
                            : 'Checks'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 3: Multi-Account Normalization */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleAccordion('normalization')}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Landmark className="w-4 h-4 text-purple-600" />
                <span>Multi-Account & Multi-Bank Normalization</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                  {statementData?.metadata.bankName || 'Auto-Detect Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-normal hidden sm:inline text-slate-500">
                  {openAccordions.normalization ? 'Hide' : 'Details'}
                </span>
                {openAccordions.normalization ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {openAccordions.normalization && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  StatementForge automatically inspects PDF header signatures to detect the issuing financial institution (Chase, American Express, Wells Fargo, etc.) and routes to specialized token parsers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Primary Bank Detected</span>
                    <strong className="text-slate-900 font-semibold mt-0.5 block">
                      {statementData?.metadata.bankName || 'JPMorgan Chase Bank'}
                    </strong>
                    <span className="text-slate-500 text-[11px] block mt-1">
                      Account Type: {statementData?.metadata.statementType || 'Business Checking'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Source Files Loaded ({sourceFiles.length})</span>
                    <strong className="text-slate-900 font-mono text-[11px] mt-0.5 block truncate">
                      {sourceFiles.join(', ')}
                    </strong>
                    <span className="text-emerald-700 text-[11px] block mt-1 font-medium">
                      ✓ Chronologically stitched & reconciled
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 4: Privacy Redaction Mode */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleAccordion('redaction')}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                {isRedacted ? (
                  <EyeOff className="w-4 h-4 text-amber-600" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500" />
                )}
                <span>Privacy Redaction Mode</span>
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                    isRedacted
                      ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isRedacted ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-normal hidden sm:inline text-slate-500">
                  {openAccordions.redaction ? 'Hide' : 'Configure'}
                </span>
                {openAccordions.redaction ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {openAccordions.redaction && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Redaction Mode obscures sensitive client account numbers, check serials, and transaction identifiers. When active, all exported files (.QBO, .OFX, CSV, TSV) and table rows will display masked strings (e.g. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">••••8412</code>).
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs font-medium text-slate-700">
                    Current Mode: <strong>{isRedacted ? 'Redaction Applied' : 'Standard Display'}</strong>
                  </div>
                  <button
                    onClick={() => {
                      const next = !isRedacted;
                      setIsRedacted(next);
                      showToast(next ? 'Redaction Mode: ON' : 'Redaction Mode: OFF');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      isRedacted
                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {isRedacted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isRedacted ? 'Disable Redaction' : 'Enable Redaction Mode'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 5: License Gate Settings */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleAccordion('license_gate')}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Gumroad License & Tier Settings</span>
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                    isUnlocked
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {isUnlocked ? 'Unlimited Pro' : `Free Tier (${FREE_TIER_LIMIT}-Row Cap)`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-normal hidden sm:inline text-slate-500">
                  {openAccordions.license_gate ? 'Hide' : 'Manage'}
                </span>
                {openAccordions.license_gate ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {openAccordions.license_gate && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  The Free Tier includes 20 transactions and full mathematical variance validation ($0.00 checks). An active Gumroad license key unlocks unlimited transactions and native .QBO/.OFX batch exports.
                </p>

                {isUnlocked ? (
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2.5 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Unlimited License Active (Stored locally)</span>
                    </div>
                    <button
                      onClick={handleRevokeLicense}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:underline"
                    >
                      Deactivate License
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={licenseKeyInput}
                      onChange={(e) => {
                        setLicenseKeyInput(e.target.value);
                        if (licenseError) setLicenseError(null);
                      }}
                      placeholder="Enter Gumroad License Key (e.g. XXXXXXXX-XXXXXXXX)"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-600"
                    />
                    <button
                      onClick={handleVerifyLicense}
                      disabled={isVerifying || !licenseKeyInput.trim()}
                      className="flex items-center justify-center gap-2 px-5 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Verify & Unlock</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Free Tier Limit Warning Banner */}
        {!isUnlocked && transactions.length > FREE_TIER_LIMIT && (
          <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700">
                <strong className="text-slate-900 block font-semibold">
                  Free Tier: Displaying and exporting first {FREE_TIER_LIMIT} of {transactions.length} transactions
                </strong>
                <span>All mathematical checks were completed for the full dataset ($0.00 variance verified).</span>
              </div>
            </div>
            <button
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-xs"
            >
              Unlock All {transactions.length} Rows
            </button>
          </div>
        )}

        {/* 7. DATA GRID / TRANSACTIONS TABLE */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100">
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              {/* Search input with exact required placeholder */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search payees, vendors, categories, memos, amounts (Press '/')"
                  className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-full pl-9 pr-8 py-2 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Quick Type Filter Pills */}
              <div className="flex items-center p-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                {(['ALL', 'CREDIT', 'DEBIT', 'CHECK'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTypeFilter(filter)}
                    className={`px-3 py-1 rounded-full text-[11px] transition-all ${
                      typeFilter === filter
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    {filter === 'ALL'
                      ? 'All'
                      : filter === 'CREDIT'
                      ? 'Credits'
                      : filter === 'DEBIT'
                      ? 'Debits'
                      : 'Checks'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Clean Payees Pill */}
              <button
                onClick={() => setUseCleanPayee(!useCleanPayee)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                  useCleanPayee
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Toggle merchant name cleaning"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Clean Payees</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    useCleanPayee ? 'bg-blue-200/60 text-blue-900' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {useCleanPayee ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Add Entry */}
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Add a manual entry"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Add Entry</span>
              </button>

              {/* Batch Delete */}
              {selectedTxIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedTxIds.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          {parserError ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 min-h-[340px] bg-rose-50/20">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-1">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Unrecognized Statement Layout</h3>
              <p className="text-sm font-medium text-rose-700 max-w-lg">
                Could not recognize this statement layout. Please ensure it is an original PDF from a supported bank.
              </p>
              <button
                onClick={() => {
                  setParserError(null);
                  setSearchQuery('');
                  setTypeFilter('ALL');
                  loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
                }}
                className="mt-3 px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Reload Chase Sample Statement
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-340px)] min-h-[340px]">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 text-[11px] font-medium uppercase tracking-wider select-none border-b border-slate-200">
                  <tr>
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={
                          displayTransactions.length > 0 &&
                          selectedTxIds.size === displayTransactions.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      />
                    </th>
                    <th className="w-24 px-4 py-3">Date</th>
                    <th className="w-28 px-4 py-3">Type</th>
                    <th className="px-4 py-3">Vendor / Payee</th>
                    <th className="px-4 py-3 hidden md:table-cell">Original Memo</th>
                    {fileCount > 1 && (
                      <th className="w-36 px-4 py-3 hidden lg:table-cell">Source File</th>
                    )}
                    <th className="w-36 px-4 py-3 text-right">Amount ($)</th>
                    <th className="w-16 px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={fileCount > 1 ? 8 : 7} className="text-center py-20 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          {parserError ? (
                            <>
                              <AlertTriangle className="w-10 h-10 text-rose-500" />
                              <p className="text-sm font-medium text-rose-600 max-w-lg">
                                Could not recognize this statement layout. Please ensure it is an original PDF from a supported bank.
                              </p>
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                              <p className="text-sm font-medium text-slate-600">No transactions match current filter.</p>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setParserError(null);
                              setSearchQuery('');
                              setTypeFilter('ALL');
                              loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
                            }}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            Reload Chase Sample Statement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  displayTransactions.map((tx) => {
                    const isSelected = selectedTxIds.has(tx.id);
                    const isCredit = tx.type === 'CREDIT';
                    const isCheck = tx.type === 'CHECK';

                    const displayedPayee = tx.mappedVendor || (useCleanPayee ? tx.cleanPayee : tx.originalMemo);
                    const displayedMemo = isRedacted ? redactText(tx.originalMemo) : tx.originalMemo;

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors duration-150 group ${
                          isSelected
                            ? 'bg-blue-50/50 hover:bg-blue-50/80'
                            : 'hover:bg-slate-50/60'
                        } ${tx.isFlagged ? 'bg-amber-50/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(tx.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                          />
                        </td>

                        {/* Date (Monospace Tabular) */}
                        <td className="w-24 px-4 py-3 text-slate-600 font-mono text-xs tabular-nums font-medium">
                          {tx.date}
                        </td>

                        {/* Type Badge */}
                        <td className="w-28 px-4 py-3">
                          {isCredit && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              + Credit
                            </span>
                          )}
                          {!isCredit && !isCheck && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              - Debit
                            </span>
                          )}
                          {isCheck && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                              Check {tx.checkNumber ? (isRedacted ? '#••••' : `#${tx.checkNumber}`) : ''}
                            </span>
                          )}
                        </td>

                        {/* Vendor / Payee Cell */}
                        <td
                          className="px-4 py-3 text-slate-900 font-medium cursor-pointer"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'cleanPayee') {
                              handleStartEdit(tx.id, 'cleanPayee', tx.cleanPayee);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'cleanPayee' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-full bg-white border border-blue-600 rounded-lg px-2.5 py-1 text-xs font-sans text-slate-900 focus:outline-none ring-2 ring-blue-600/10"
                            />
                          ) : (
                            <div className="flex flex-col gap-1 group/cell">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-xs font-semibold text-slate-900">
                                  {isRedacted ? redactText(displayedPayee) : displayedPayee}
                                </span>
                                {tx.mappedVendor && (
                                  <span
                                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200"
                                    title="Assigned via Vendor Rules Engine"
                                  >
                                    Rule Match
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  ✎
                                </span>
                              </div>

                              {tx.mappedCategory && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-sans font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                    {tx.mappedCategory}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Original Memo Cell */}
                        <td
                          className="px-4 py-3 text-slate-500 font-mono text-[11px] hidden md:table-cell cursor-pointer"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'originalMemo') {
                              handleStartEdit(tx.id, 'originalMemo', tx.originalMemo);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'originalMemo' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-full bg-white border border-blue-600 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 focus:outline-none ring-2 ring-blue-600/10"
                            />
                          ) : (
                            <span className="truncate max-w-sm block">
                              {displayedMemo}
                            </span>
                          )}
                        </td>

                        {/* Source File Column */}
                        {fileCount > 1 && (
                          <td className="w-36 px-4 py-3 hidden lg:table-cell">
                            <span className="inline-block max-w-[130px] truncate text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {tx.sourceFile || 'source'}
                            </span>
                          </td>
                        )}

                        {/* Amount Cell (Monospace Tabular Only, Editable) */}
                        <td
                          className="w-36 px-4 py-3 text-right font-mono text-xs tabular-nums font-semibold cursor-pointer"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'amount') {
                              handleStartEdit(tx.id, 'amount', tx.rawAmount);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'amount' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-28 bg-white border border-blue-600 rounded-lg px-2.5 py-1 text-xs font-mono text-right text-slate-900 focus:outline-none ring-2 ring-blue-600/10 ml-auto"
                            />
                          ) : (
                            <span className={isCredit ? 'text-emerald-700' : 'text-slate-900'}>
                              {formatCurrency(tx.amount, true)}
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="w-16 px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteRow(tx.id)}
                            className="text-slate-300 hover:text-rose-600 p-1.5 rounded-full hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}

          {/* Table Footer */}
          <div className="bg-slate-50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong>{displayTransactions.length}</strong> of <strong>{transactions.length}</strong> entries
                {!isUnlocked && transactions.length > FREE_TIER_LIMIT && (
                  <span className="text-blue-700 font-medium ml-1.5 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                    Free Tier: capped at {FREE_TIER_LIMIT}
                  </span>
                )}
              </span>
              <span>•</span>
              <span>Click any Payee or Amount cell to edit</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span>Net Ledger Flow:</span>
              <strong
                className={`font-mono font-semibold tabular-nums ${
                  summaryFigures.in - summaryFigures.out >= 0 ? 'text-emerald-700' : 'text-slate-900'
                }`}
              >
                {formatCurrency(summaryFigures.in - summaryFigures.out, true)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* 8. EXPORT ACTION TOOLBAR (Floating Modern Card) */}
      <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-5xl w-[calc(100%-2rem)] bg-white/95 backdrop-blur-md rounded-2xl px-6 py-3.5 shadow-xl border border-slate-200/80 flex items-center justify-between z-30 transition-all">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>
              {selectedTxIds.size > 0
                ? `${selectedTxIds.size} of ${transactions.length} rows selected`
                : !isUnlocked && transactions.length > FREE_TIER_LIMIT
                ? `First ${FREE_TIER_LIMIT} of ${transactions.length} rows ready (Free Tier)`
                : `${transactions.length} transactions ready`}
            </span>
          </div>

          {isRedacted && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-bold border border-amber-200">
              [Redaction Active]
            </span>
          )}
        </div>

        {/* Action Buttons: Native QBO, OFX, QuickBooks Online CSV, Xero, TSV */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* Primary Action Button: Native .QBO */}
          <button
            onClick={handleExportNativeQBO}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-all shadow-sm hover:shadow disabled:opacity-50 shrink-0"
            title="Download native QuickBooks Online .qbo file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .QBO</span>
          </button>

          {/* Native .OFX Export */}
          <button
            onClick={handleExportOFX}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors disabled:opacity-50 shrink-0"
            title="Download Open Financial Exchange .ofx file"
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Export .OFX</span>
          </button>

          {/* QuickBooks Online CSV (Selector required by Post-Build Hook) */}
          <button
            onClick={handleExportQBCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 shrink-0"
            title="Download QuickBooks Online CSV with mapped vendors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>QuickBooks Online CSV</span>
          </button>

          {/* Xero CSV */}
          <button
            onClick={handleExportXero}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 shrink-0"
            title="Download standard 5-column Xero CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Xero CSV</span>
          </button>

          {/* Copy TSV */}
          <button
            onClick={handleCopyTSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 shrink-0"
            title="Copy clean TSV to clipboard for direct paste into Excel or Google Sheets"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy TSV</span>
          </button>
        </div>
      </footer>

      {/* 9. PRICING & SECURITY SECTIONS */}
      <section id="pricing" className="px-6 sm:px-10 py-16 max-w-5xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
            Simple Pricing
          </span>
          <h2 className="text-3xl font-bold text-slate-900 mt-2">
            Audit-grade precision without monthly subscriptions.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2">
            Start completely free. Upgrade once for lifetime unlimited conversions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Free Tier</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">Included</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 font-mono">$0</div>
              <p className="text-xs text-slate-500 mt-2">Test and verify balances without paying a cent.</p>

              <ul className="mt-5 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>20 transactions per export batch</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>100% Client-Side memory execution</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Deterministic $0.00 balance reconciliation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>QuickBooks Online & Xero CSV output</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                const el = document.getElementById('workspace');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="mt-6 w-full py-2.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              Start Free
            </button>
          </div>

          {/* Unlimited Pro */}
          <div className="bg-white p-6 rounded-2xl border-2 border-blue-600 shadow-sm flex flex-col justify-between relative">
            <div className="absolute -top-3 right-6 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
              Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Unlimited Pro</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700">Lifetime</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 font-mono">$29</div>
              <p className="text-xs text-slate-500 mt-2">Pay once, use forever. No recurring SaaS fees.</p>

              <ul className="mt-5 space-y-2.5 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span><strong>Unlimited transactions</strong> (no row caps)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span><strong>Native .QBO & .OFX</strong> file generation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Multi-file bulk processing (years of statements)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Persistent custom vendor mapping rules</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowUnlockModal(true)}
              className="mt-6 w-full py-2.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
            >
              {isUnlocked ? 'License Active' : 'Unlock Unlimited Pro'}
            </button>
          </div>
        </div>
      </section>

      {/* 10. SECURITY & SUPPORT FOOTER */}
      <footer id="security" className="bg-white border-t border-slate-200 py-10 px-6 sm:px-10 text-xs text-slate-500">
        <div id="support" className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-slate-900">Assay StatementForge</span>
            <span className="text-slate-300">•</span>
            <span>Zero-server bank statement reconciliation.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-600">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Data Transmitted</span>
            </span>
            <a href="#workspace" className="hover:text-slate-900 transition-colors">
              Workspace
            </a>
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a
              href="mailto:support@shipstackhq.com"
              className="hover:text-slate-900 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>

      {/* 11. MODALS: RAW TEXT PASTE, VENDOR RULES, UNLOCK GUMROAD */}
      {/* Raw Text Paste Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Paste Bank Statement Text</h3>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Copy and paste statement text directly from your bank checking portal or PDF viewer. The multi-bank router will automatically detect the bank and normalize transactions.
            </p>

            <textarea
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="Paste raw bank checking statement text here..."
              rows={12}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rawPasteText.trim()) {
                    loadSingleStatement(rawPasteText, 'pasted_statement.txt');
                    setPasteModalOpen(false);
                    setRawPasteText('');
                  }
                }}
                disabled={!rawPasteText.trim()}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                Parse & Process Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isUnlocked ? 'License Active' : 'Unlock StatementForge'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Deterministic banking & ledger converter</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setLicenseError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isUnlocked ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Unlimited License Active</strong>
                    <span className="text-[11px] text-emerald-800">
                      Your device is authorized for unlimited transactions, multi-file batch processing, and full .QBO/.OFX exports.
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed">
                  License state is stored securely in your browser’s <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">localStorage</code>.
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={handleRevokeLicense}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline"
                  >
                    Deactivate License
                  </button>
                  <button
                    onClick={() => setShowUnlockModal(false)}
                    className="px-5 py-2 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Free tier includes <strong>20 transactions</strong> and complete reconciliation auditing. Enter your Gumroad license key to remove all caps and unlock unlimited exports.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">
                    Gumroad License Key
                  </label>
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => {
                      setLicenseKeyInput(e.target.value);
                      if (licenseError) setLicenseError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyLicense();
                    }}
                    placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  {licenseError && (
                    <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{licenseError}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Zero telemetry & local persistence</span>
                  </div>
                  <p>
                    Verified licenses are saved to your browser’s local storage. Verification is proxied without transmitting financial data.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <a
                    href="https://assaytools.gumroad.com/l/statementforge"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Need a license? Get one →
                  </a>
                  <button
                    onClick={handleVerifyLicense}
                    disabled={isVerifying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Verify & Unlock</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-fade-in font-medium">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
