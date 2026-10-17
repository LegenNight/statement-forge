'use strict';
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
  ArrowLeft,
  Files,
  Landmark,
  EyeOff,
  Eye,
  SlidersHorizontal,
  Tags,
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
  triggerFileDownload,
} from '@/lib/exportUtils';
import { extractTextFromFile } from '@/lib/pdfExtractor';

export default function StatementForgeAppPage() {
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

  // Vendor Rules State (Persisted in localStorage)
  const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);
  const [newRulePattern, setNewRulePattern] = useState<string>('');
  const [newRuleVendor, setNewRuleVendor] = useState<string>('');
  const [newRuleCategory, setNewRuleCategory] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Vendor Rules from localStorage
  useEffect(() => {
    const savedRules = loadVendorRules();
    setVendorRules(savedRules);
  }, []);

  // Initialize with multi-page fixture
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
        handleExportQBO();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawTransactions, useCleanPayee, vendorRules, isRedacted]);

  // Load single statement text into state
  const loadSingleStatement = (text: string, sourceName: string = 'statement.pdf') => {
    setIsLoading(true);
    try {
      const parsed = parseStatement(text, sourceName);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles([sourceName]);
      showToast(`Loaded ${parsed.transactions.length} transactions from ${sourceName}`);
    } catch (err: any) {
      console.error(err);
      showToast('Error parsing statement text. Please check format.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load multiple statements from extracted document strings
  const loadMultipleStatementDocs = (docs: ExtractedDocument[]) => {
    setIsLoading(true);
    try {
      const parsed = parseMultipleStatements(docs);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles(docs.map((d) => d.fileName));
      showToast(`Processed ${docs.length} statements (${parsed.transactions.length} transactions)`);
    } catch (err: any) {
      console.error(err);
      showToast('Error parsing statements.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle multi-file upload or drop
  const handleMultipleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsLoading(true);
    try {
      const docs: ExtractedDocument[] = [];
      for (const f of fileArray) {
        const text = await extractTextFromFile(f);
        if (text && text.trim().length > 0) {
          docs.push({ text, fileName: f.name });
        }
      }

      if (docs.length === 0) {
        showToast('No readable text found in document(s)');
        setIsLoading(false);
        return;
      }

      const parsed = parseMultipleStatements(docs);
      setStatementData(parsed);
      setRawTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setSourceFiles(docs.map((d) => d.fileName));
      showToast(`Successfully processed ${docs.length} file${docs.length > 1 ? 's' : ''} (${parsed.transactions.length} rows)`);
    } catch (err) {
      console.error(err);
      showToast('Failed to process statements client-side.');
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

  // Checkbox selection
  const handleToggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
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

  // Add Manual Entry
  const handleAddRow = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${mm}/${dd}`;

    const newTx: ParsedTransaction = {
      id: `manual_${Date.now()}`,
      date: dateStr,
      rawDate: dateStr,
      type: 'DEBIT',
      cleanPayee: 'Manual Entry',
      originalMemo: 'Manual Adjustment',
      amount: -0.01,
      rawAmount: 0.01,
      section: 'Manual Adjustments',
      sourceFile: 'manual',
    };

    setRawTransactions([newTx, ...rawTransactions]);
    handleStartEdit(newTx.id, 'cleanPayee', 'Manual Entry');
    showToast('Added manual ledger row');
  };

  // Export handlers (Respecting Redaction Mode and Vendor Mapping)
  const getExportData = (): ParsedTransaction[] => {
    if (selectedTxIds.size > 0) {
      return transactions.filter((t) => selectedTxIds.has(t.id));
    }
    return transactions;
  };

  const handleExportQBO = () => {
    const data = getExportData();
    const csv = generateQuickBooksCSV(data, useCleanPayee, isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(csv, `QuickBooks_Ledger_${dateStr}${tag}.csv`);
    showToast(`Exported ${data.length} transactions for QuickBooks ${isRedacted ? '(Redacted)' : ''}`);
  };

  const handleExportXero = () => {
    const data = getExportData();
    const csv = generateXeroCSV(data, isRedacted);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'ledger';
    const tag = isRedacted ? '_redacted' : '';
    triggerFileDownload(csv, `Xero_Ledger_${dateStr}${tag}.csv`);
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

  const fileCount = statementData?.metadata.fileCount ?? sourceFiles.length;

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* 1. ASSAY HEADER & SPEC LOGO */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
        <div className="flex items-center gap-6">
          {/* Logo: assay / StatementForge */}
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-85">
            <span className="font-semibold text-slate-900 text-lg tracking-tight font-sans">
              assay
            </span>
            <span className="text-slate-400 font-normal text-base">/</span>
            <span className="font-normal text-slate-700 text-lg tracking-tight font-sans">
              StatementForge
            </span>
          </Link>

          {/* Quick Action Navigation */}
          <div className="hidden sm:flex items-center gap-2 border-l border-stone-200 pl-6">
            <button
              onClick={() => loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-stone-100 hover:bg-stone-200/70 text-slate-700 transition-colors duration-200"
              title="Load single October 2026 Chase business statement"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Load Sample Chase Statement</span>
            </button>

            <button
              onClick={() =>
                loadMultipleStatementDocs([
                  { text: SAMPLE_CHASE_STATEMENT, fileName: 'chase_business_oct2026.pdf' },
                  { text: SAMPLE_CHASE_STATEMENT_NOV, fileName: 'chase_business_nov2026.pdf' },
                ])
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/70 transition-colors duration-200"
              title="Demonstrate bulk 2-month processing & chronological sorting"
            >
              <Files className="w-3.5 h-3.5 text-amber-700" />
              <span>Load 2-Month Bulk Sample</span>
            </button>

            <button
              onClick={() => loadSingleStatement(SAMPLE_AMEX_STATEMENT, 'amex_business_oct2026.pdf')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors duration-200"
              title="Test multi-bank router with American Express"
            >
              <Landmark className="w-3.5 h-3.5 text-slate-500" />
              <span>Amex Sample</span>
            </button>

            <button
              onClick={() => setPasteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-transparent hover:bg-stone-100 text-slate-600 hover:text-slate-900 transition-colors duration-200"
              title="Paste raw text directly from PDF or checking portal"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Paste Statement</span>
            </button>

            <button
              onClick={() => {
                setRawTransactions([]);
                setSelectedTxIds(new Set());
                setStatementData(null);
                setSourceFiles([]);
                showToast('Workspace cleared');
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-full text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition-colors duration-200"
              title="Reset workspace"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Subtle Right-Aligned Controls: Vendor Rules + Redaction Mode + System Status */}
        <div className="flex items-center gap-3">
          {/* Vendor Rules Modal Trigger */}
          <button
            onClick={() => setRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200/80 text-slate-700 transition-colors"
            title="Configure deterministic payee-to-vendor mapping rules"
          >
            <Tags className="w-3.5 h-3.5 text-amber-800" />
            <span>Vendor Rules</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-stone-200 text-slate-600">
              {vendorRules.length}
            </span>
          </button>

          {/* Privacy Redaction Mode Toggle */}
          <button
            onClick={() => {
              const nextState = !isRedacted;
              setIsRedacted(nextState);
              showToast(nextState ? 'Privacy Redaction Mode: ACTIVE' : 'Privacy Redaction Mode: OFF');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              isRedacted
                ? 'bg-amber-100 text-amber-950 border border-amber-300 font-semibold shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-slate-700'
            }`}
            title="Dynamically mask account numbers and sensitive client identifiers from view and exports"
          >
            {isRedacted ? (
              <EyeOff className="w-3.5 h-3.5 text-amber-800" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Redact Sensitive Data</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                isRedacted ? 'bg-amber-200/90 text-amber-950 font-bold' : 'bg-stone-200 text-slate-500'
              }`}
            >
              {isRedacted ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Security Telemetry Pill */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-default text-xs text-slate-500 font-medium"
            title="Files and statements are parsed 100% in local memory. No server uploads."
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Local Processing Active</span>
          </div>

          <Link
            href="/"
            className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors pl-2 border-l border-stone-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Assay Storefront</span>
          </Link>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="max-w-7xl w-full mx-auto px-6 py-8 space-y-6 flex-1 pb-32">
        {/* Top Info Banner: Account info + Multi-file pill + Redacted Indicator + Reconciliation Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-sans">
            {/* Subtle File Count Status Indicator */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-slate-800 border border-stone-200 text-xs font-medium"
              title={`${fileCount} statement file${fileCount > 1 ? 's' : ''} currently loaded and parsed into memory`}
            >
              <Files className="w-3.5 h-3.5 text-slate-600" />
              <span>{fileCount} file{fileCount === 1 ? '' : 's'} processed</span>
            </div>

            <span className="text-stone-300">•</span>

            <span className="font-medium text-slate-400">Account:</span>
            <span className="font-mono font-medium text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
              {statementData
                ? isRedacted
                  ? redactAccountNumber(statementData.metadata.accountNumber)
                  : statementData.metadata.accountNumber
                : isRedacted
                ? '••••8412'
                : '0000008412'}
            </span>

            <span className="text-stone-300">•</span>

            <span className="font-medium text-slate-700">
              {statementData?.metadata.statementPeriod || 'October 01, 2026 – October 31, 2026'}
            </span>

            <span className="text-stone-300 hidden lg:inline">•</span>

            <span className="text-slate-600 hidden lg:inline font-medium">
              {statementData?.metadata.bankName || 'JPMorgan Chase'} — {statementData?.metadata.statementType || 'Business Checking'}
            </span>

            {isRedacted && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                [Redaction Mask Active]
              </span>
            )}
          </div>

          {/* Crisp, Borderless Reconciliation Alert Badge */}
          <div>
            {currentReconciliation?.status === 'BALANCED' ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium cursor-default border border-emerald-200/80 shadow-2xs"
                title="Beginning + In - Out matches Statement Ending Balance to the cent"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>[✓ RECONCILED: $0.00 VARIANCE]</strong> — Ending balance perfectly matches statement summary
                </span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-900 text-xs font-medium cursor-default border border-amber-200/80 shadow-2xs"
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

        {/* Summary Telemetry Metrics Row (Aggregates Across All Processed Statements) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Beginning Balance */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 hover:border-stone-200 transition-all duration-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider font-sans">
              Beginning Balance
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.beginning)}
            </div>
            <div className="mt-1.5 text-xs text-slate-400 font-sans">
              {fileCount > 1 ? `Earliest statement starting balance` : `Statement starting balance`}
            </div>
          </div>

          {/* Card 2: Inflow (Deposits) */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 hover:border-stone-200 transition-all duration-200">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider font-sans flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>In (Deposits)</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-emerald-700 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.in, true)}
            </div>
            <div className="mt-1.5 text-xs text-slate-400 font-sans">
              {summaryFigures.creditCount} incoming deposit{summaryFigures.creditCount === 1 ? '' : 's'} across {fileCount} file{fileCount === 1 ? '' : 's'}
            </div>
          </div>

          {/* Card 3: Outflow (Debits + Checks) */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 hover:border-stone-200 transition-all duration-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Out (Debits + Checks)</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(-summaryFigures.out, true)}
            </div>
            <div className="mt-1.5 text-xs text-slate-400 font-sans">
              {summaryFigures.debitCount} withdrawals • {summaryFigures.checkCount} checks paid
            </div>
          </div>

          {/* Card 4: Ending Balance (Assay Highlight: Amber-700 / Slate-900) */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-200 hover:border-amber-700/40 transition-all duration-200">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider font-sans flex items-center justify-between">
              <span>Ending Balance</span>
              <FileCheck2 className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatCurrency(summaryFigures.ending)}
            </div>
            <div className="mt-1.5 text-xs text-amber-700/80 font-sans font-medium">
              {fileCount > 1 ? `Latest closing statement balance` : `Audited reconciliation target`}
            </div>
          </div>
        </div>

        {/* Bulk Drag & Drop Card (Stone Palette with Multiple PDFs Support) */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white rounded-2xl p-4.5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-dashed transition-all duration-200 cursor-pointer flex items-center justify-between group ${
            isDragging
              ? 'border-slate-900 bg-stone-100/50 ring-2 ring-slate-900/10'
              : 'border-stone-300 hover:border-slate-400 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)]'
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
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-stone-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <span>Drop Bank Statements (Multiple PDFs or TXTs)</span>
                <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                  Bulk Processing & Multi-Bank Auto-Detect
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Active:</span>
                <span className="font-mono text-slate-700">
                  {sourceFiles.length === 1
                    ? sourceFiles[0]
                    : `${sourceFiles.length} files (${sourceFiles.join(', ')})`}
                </span>
                <span className="text-emerald-700 font-semibold">• {fileCount} file{fileCount === 1 ? '' : 's'} processed</span>
              </div>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-700 group-hover:text-slate-900 flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-stone-100 transition-colors duration-200">
            <span>Browse files</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 3. DATA GRID & CONTROLS CONTAINER */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-200/70 overflow-hidden transition-all">
          {/* Table Toolbar & Filters */}
          <div className="p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-stone-100">
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search payees, vendors, categories, memos, amounts (Press '/')"
                  className="w-full bg-stone-50 hover:bg-stone-100/70 focus:bg-white rounded-full pl-9 pr-8 py-2 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-slate-900/20 transition-all duration-200"
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

              {/* Type Filter Pills */}
              <div className="flex items-center p-1 bg-stone-100 rounded-full text-xs font-medium text-slate-600">
                {(['ALL', 'CREDIT', 'DEBIT', 'CHECK'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTypeFilter(filter)}
                    className={`px-3 py-1 rounded-full text-[11px] transition-all duration-200 ${
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
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  useCleanPayee
                    ? 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100/70'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
                title="Toggle merchant name cleaning"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Clean Payees</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    useCleanPayee ? 'bg-amber-200/70 text-amber-900' : 'bg-stone-200 text-slate-500'
                  }`}
                >
                  {useCleanPayee ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Add Entry */}
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors duration-200"
                title="Add a manual entry"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Add Entry</span>
              </button>

              {/* Batch Delete */}
              {selectedTxIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors duration-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedTxIds.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[calc(100vh-340px)] min-h-[340px]">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead className="bg-stone-50/80 text-slate-500 sticky top-0 z-10 text-[11px] font-medium uppercase tracking-wider select-none border-b border-stone-200/70">
                <tr>
                  <th className="w-10 px-5 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTxIds.size === filteredTransactions.length
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-stone-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="w-24 px-4 py-3.5">Date</th>
                  <th className="w-28 px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">
                    Vendor / Payee (Prioritizes Rules)
                  </th>
                  <th className="px-4 py-3.5 hidden md:table-cell">Original Memo</th>
                  {fileCount > 1 && (
                    <th className="w-36 px-4 py-3.5 hidden lg:table-cell">Source File</th>
                  )}
                  <th className="w-36 px-5 py-3.5 text-right">Amount ($)</th>
                  <th className="w-16 px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={fileCount > 1 ? 8 : 7} className="text-center py-20 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">No transactions match the current filter.</p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setTypeFilter('ALL');
                            loadSingleStatement(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
                          }}
                          className="mt-2 text-xs text-amber-800 hover:text-amber-900 font-medium flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                          Reload Chase Sample Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
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
                            ? 'bg-amber-50/50 hover:bg-amber-50/80'
                            : 'hover:bg-stone-50/70'
                        } ${tx.isFlagged ? 'bg-amber-50/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(tx.id)}
                            className="rounded border-stone-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                        </td>

                        {/* Date (Chronologically Sorted Monospace Tabular) */}
                        <td className="w-24 px-4 py-3 text-slate-600 font-mono text-xs tabular-nums font-medium">
                          {tx.date}
                        </td>

                        {/* Type Badge */}
                        <td className="w-28 px-4 py-3">
                          {isCredit && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              + Credit
                            </span>
                          )}
                          {!isCredit && !isCheck && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-slate-700 border border-stone-200/60">
                              - Debit
                            </span>
                          )}
                          {isCheck && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              Check {tx.checkNumber ? (isRedacted ? '#••••' : `#${tx.checkNumber}`) : ''}
                            </span>
                          )}
                        </td>

                        {/* Vendor / Payee Cell (Prioritizes Mapped Vendor & Shows Category) */}
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
                              className="w-full bg-white border border-slate-900 rounded-lg px-2.5 py-1 text-xs font-sans text-slate-900 focus:outline-none ring-2 ring-slate-900/10"
                            />
                          ) : (
                            <div className="flex flex-col gap-1 group/cell">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-xs font-semibold text-slate-900">
                                  {isRedacted ? redactText(displayedPayee) : displayedPayee}
                                </span>
                                {tx.mappedVendor && (
                                  <span
                                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-medium border border-amber-200"
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
                                  <span className="text-[10px] font-sans font-medium text-slate-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200/80">
                                    {tx.mappedCategory}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Original Memo Cell (Editable, Redacted if active) */}
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
                              className="w-full bg-white border border-slate-900 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 focus:outline-none ring-2 ring-slate-900/10"
                            />
                          ) : (
                            <span className="truncate max-w-sm block">
                              {displayedMemo}
                            </span>
                          )}
                        </td>

                        {/* Source File Column (Displayed when multiple files loaded) */}
                        {fileCount > 1 && (
                          <td className="w-36 px-4 py-3 hidden lg:table-cell">
                            <span className="inline-block max-w-[130px] truncate text-[10px] font-mono text-slate-500 bg-stone-100 px-2 py-0.5 rounded">
                              {tx.sourceFile || 'source'}
                            </span>
                          </td>
                        )}

                        {/* Amount Cell (Monospace Tabular Only, Editable) */}
                        <td
                          className="w-36 px-5 py-3 text-right font-mono text-xs tabular-nums font-semibold cursor-pointer"
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
                              className="w-28 bg-white border border-slate-900 rounded-lg px-2.5 py-1 text-xs font-mono text-right text-slate-900 focus:outline-none ring-2 ring-slate-900/10 ml-auto"
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
                            className="text-slate-300 hover:text-rose-600 p-1.5 rounded-full hover:bg-rose-50 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                            title="Delete this transaction"
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

          {/* Table Footer */}
          <div className="bg-stone-50 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 border-t border-stone-200/70">
            <div className="flex items-center gap-3">
              <span>Showing <strong>{filteredTransactions.length}</strong> of <strong>{transactions.length}</strong> entries</span>
              <span>•</span>
              <span>Chronologically sorted across {fileCount} statement{fileCount === 1 ? '' : 's'}</span>
              <span>•</span>
              <span>Click any Payee or Amount cell to edit</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span>Net Ledger Flow:</span>
              <strong
                className={`font-mono font-semibold tabular-nums ${
                  summaryFigures.in - summaryFigures.out >= 0 ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                {formatCurrency(summaryFigures.in - summaryFigures.out, true)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. EXPORT ACTION TOOLBAR (Assay Slate-900 Primary Accent) */}
      <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-5xl w-[calc(100%-2rem)] bg-white/95 backdrop-blur-md rounded-2xl px-6 py-3.5 shadow-[0_12px_40px_rgb(0,0,0,0.08)] border border-stone-200/80 flex items-center justify-between z-30 transition-all">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>
              {selectedTxIds.size > 0
                ? `${selectedTxIds.size} of ${transactions.length} rows selected`
                : `${transactions.length} transactions ready (${fileCount} file${fileCount === 1 ? '' : 's'})`}
            </span>
          </div>

          {isRedacted && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
              [Export Redaction Masked]
            </span>
          )}

          <span className="hidden xl:inline text-stone-300">|</span>
          <span className="hidden xl:inline text-xs text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-stone-100 text-slate-600 font-mono text-[11px]">Ctrl+E</kbd> for instant export
          </span>
        </div>

        {/* Action Buttons: Assay Slate-900 Primary */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-1">
          {/* Primary Action Button (Assay Slate-900) */}
          <button
            onClick={handleExportQBO}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 active:bg-black text-white transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Download QuickBooks Online CSV with mapped vendors and redaction"
          >
            <Download className="w-3.5 h-3.5 text-stone-300" />
            <span>QuickBooks Online CSV</span>
          </button>

          {/* Secondary Action 1: Xero CSV */}
          <button
            onClick={handleExportXero}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors duration-200 disabled:opacity-50 shrink-0"
            title="Download standard 5-column Xero CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Xero CSV</span>
          </button>

          {/* Secondary Action 2: 4-Column Ledger */}
          <button
            onClick={handleExport4Column}
            disabled={transactions.length === 0}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors duration-200 disabled:opacity-50 shrink-0"
            title="Standard 4-column: Date, Description, Debit, Credit"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Standard Ledger</span>
          </button>

          {/* Secondary Action 3: Copy TSV */}
          <button
            onClick={handleCopyTSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 text-slate-700 transition-colors duration-200 disabled:opacity-50 shrink-0"
            title="Copy clean TSV to clipboard for direct paste into Excel or Google Sheets"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy TSV</span>
          </button>
        </div>
      </footer>

      {/* 5. VENDOR MAPPING RULES MODAL (Persists via localStorage) */}
      {rulesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-stone-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4 text-amber-800" />
                <h3 className="text-sm font-bold text-slate-900">Deterministic Vendor Mapping Rules</h3>
              </div>
              <button
                onClick={() => setRulesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 shrink-0 leading-relaxed">
              Rules map dirty raw memos to clean vendor names and accounting categories. Rules execute strictly in your browser and are stored permanently in your device’s <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-slate-700">localStorage</code>.
            </p>

            {/* Create Rule Form */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 space-y-3 shrink-0">
              <div className="text-xs font-semibold text-slate-800">Add New Mapping Rule</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">If Payee Contains</label>
                  <input
                    type="text"
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    placeholder="e.g. UBER"
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Set Vendor to</label>
                  <input
                    type="text"
                    value={newRuleVendor}
                    onChange={(e) => setNewRuleVendor(e.target.value)}
                    placeholder="e.g. Uber Technologies"
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Set Category to</label>
                  <input
                    type="text"
                    value={newRuleCategory}
                    onChange={(e) => setNewRuleCategory(e.target.value)}
                    placeholder="e.g. Travel & Transport"
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-sans text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleAddVendorRule}
                  disabled={!newRulePattern.trim() || !newRuleVendor.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Mapping Rule</span>
                </button>
              </div>
            </div>

            {/* Existing Rules List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between pb-1">
                <span>Active Rules ({vendorRules.length})</span>
                <button
                  onClick={handleResetDefaultRules}
                  className="text-[10px] text-amber-800 hover:text-amber-900 font-medium normal-case"
                >
                  Reset Defaults
                </button>
              </div>

              {vendorRules.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No vendor rules configured. Add your first rule above.
                </div>
              ) : (
                vendorRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[11px] font-medium text-slate-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/80">
                        {rule.pattern}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold text-slate-900">{rule.vendor}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-amber-900 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                        {rule.category}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteVendorRule(rule.id)}
                      className="text-slate-300 hover:text-rose-600 p-1.5 rounded-full hover:bg-rose-50 transition-colors shrink-0"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Matches are automatically re-calculated across all active ledger rows.
              </span>
              <button
                onClick={() => setRulesModalOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Close & Save Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. RAW TEXT PASTE MODAL */}
      {pasteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Paste Bank Statement Text</h3>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-stone-100 transition-colors"
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
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-full text-slate-600 hover:bg-stone-100 transition-colors"
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
                className="px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50"
              >
                Parse & Process Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-fade-in font-medium">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
