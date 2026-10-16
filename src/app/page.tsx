'use strict';
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Landmark,
  FileCheck2,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  parseChaseStatement,
  recalculateReconciliation,
  formatCurrency,
  ParsedTransaction,
  ChaseParseResult,
  TransactionType,
} from '@/lib/chaseParser';
import { SAMPLE_CHASE_STATEMENT } from '@/lib/sampleChaseData';
import {
  generateQuickBooksCSV,
  generateXeroCSV,
  generateStandard4ColumnCSV,
  generateTSV,
  triggerFileDownload,
} from '@/lib/exportUtils';
import { extractTextFromFile } from '@/lib/pdfExtractor';

export default function StatementForgePage() {
  const [statementData, setStatementData] = useState<ChaseParseResult | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [useCleanPayee, setUseCleanPayee] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'CHECK'>('ALL');
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'cleanPayee' | 'originalMemo' | 'amount' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pasteModalOpen, setPasteModalOpen] = useState<boolean>(false);
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('chase_business_oct2026.pdf');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with sample fixture
  useEffect(() => {
    loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
  }, []);

  // Show toast notification
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
  }, [transactions, useCleanPayee]);

  // Load statement text into state
  const loadStatementText = (text: string, sourceName: string = 'statement.pdf') => {
    setIsLoading(true);
    try {
      const parsed = parseChaseStatement(text);
      setStatementData(parsed);
      setTransactions(parsed.transactions);
      setSelectedTxIds(new Set());
      setFileName(sourceName);
      showToast(`Loaded ${parsed.transactions.length} transactions from ${sourceName}`);
    } catch (err: any) {
      console.error(err);
      showToast('Error parsing statement text. Please check format.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file drop or selection
  const handleFile = async (file: File) => {
    setIsLoading(true);
    try {
      const text = await extractTextFromFile(file);
      if (!text || text.trim().length === 0) {
        showToast('No readable text found in document');
        setIsLoading(false);
        return;
      }
      loadStatementText(text, file.name);
    } catch (err) {
      console.error(err);
      showToast('Failed to read file client-side.');
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Dynamically recompute reconciliation
  const currentReconciliation = useMemo(() => {
    if (!statementData) return null;
    return recalculateReconciliation(
      statementData.summary.beginningBalance,
      statementData.summary.endingBalance,
      transactions
    );
  }, [statementData, transactions]);

  // Summary figures
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
        const matchPayee = tx.cleanPayee.toLowerCase().includes(q);
        const matchMemo = tx.originalMemo.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q) || tx.rawAmount.toString().includes(q);
        const matchDate = tx.date.includes(q);
        const matchCheck = tx.checkNumber?.includes(q);
        return matchPayee || matchMemo || matchAmount || matchDate || matchCheck;
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
    setTransactions((prev) => prev.filter((t) => !selectedTxIds.has(t.id)));
    setSelectedTxIds(new Set());
    showToast(`Deleted ${count} transaction${count > 1 ? 's' : ''}`);
  };

  const handleDeleteRow = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
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

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== id) return tx;

        if (field === 'amount') {
          const rawVal = parseFloat(editValue.replace(/[$,]/g, '')) || 0;
          const signedVal = tx.type === 'CREDIT' ? rawVal : -rawVal;
          return {
            ...tx,
            amount: signedVal,
            rawAmount: rawVal,
          };
        } else if (field === 'cleanPayee') {
          return {
            ...tx,
            cleanPayee: editValue.trim() || tx.cleanPayee,
          };
        } else if (field === 'originalMemo') {
          return {
            ...tx,
            originalMemo: editValue.trim() || tx.originalMemo,
          };
        }
        return tx;
      })
    );

    setEditingCell(null);
    setEditValue('');
  };

  // Add a manual adjustment row
  const handleAddRow = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const newTx: ParsedTransaction = {
      id: `tx-manual-${Date.now()}`,
      date: `${mm}/${dd}`,
      rawDate: `${mm}/${dd}`,
      type: 'DEBIT',
      cleanPayee: 'Manual Entry',
      originalMemo: 'MANUAL ENTRY ADJUSTMENT',
      amount: -100.0,
      rawAmount: 100.0,
      section: 'MANUAL ADJUSTMENTS',
    };
    setTransactions((prev) => [newTx, ...prev]);
    showToast('New ledger row added');
  };

  // Export handlers
  const getExportData = () => {
    if (selectedTxIds.size > 0) {
      return transactions.filter((t) => selectedTxIds.has(t.id));
    }
    return transactions;
  };

  const handleExportQBO = () => {
    const data = getExportData();
    const csv = generateQuickBooksCSV(data, useCleanPayee);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'statement';
    triggerFileDownload(csv, `Chase_QBO_${dateStr}.csv`);
    showToast(`Exported ${data.length} transactions for QuickBooks Online`);
  };

  const handleExportXero = () => {
    const data = getExportData();
    const csv = generateXeroCSV(data);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'statement';
    triggerFileDownload(csv, `Chase_Xero_${dateStr}.csv`);
    showToast(`Exported ${data.length} transactions for Xero`);
  };

  const handleExport4Column = () => {
    const data = getExportData();
    const csv = generateStandard4ColumnCSV(data, useCleanPayee);
    const dateStr = statementData?.metadata.startDate.replace(/[\s,]+/g, '_') || 'statement';
    triggerFileDownload(csv, `Chase_Standard_Ledger_${dateStr}.csv`);
    showToast(`Exported ${data.length} transactions in 4-column format`);
  };

  const handleCopyTSV = async () => {
    const data = getExportData();
    const tsv = generateTSV(data, useCleanPayee);
    try {
      await navigator.clipboard.writeText(tsv);
      showToast(`Copied ${data.length} transactions to clipboard as TSV`);
    } catch {
      showToast('Clipboard access denied');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* 1. TOP HEADER (Stripe / Brex FinTech Style) */}
      <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-5">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
              <Landmark className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 tracking-tight text-base font-sans">
                StatementForge
              </span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                Chase Edition
              </span>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="hidden sm:flex items-center gap-2 border-l border-gray-200 pl-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-medium text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>100% Client-Side Processing</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-600">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              <span>Zero Server Uploads</span>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs transition-all active:scale-[0.98]"
            title="Load sample Chase business checking statement"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load Sample Chase Statement</span>
          </button>

          <button
            onClick={() => setPasteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border border-gray-300 shadow-xs transition-all"
            title="Paste raw text directly from PDF or checking portal"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Paste Text</span>
          </button>

          <button
            onClick={() => {
              setTransactions([]);
              setSelectedTxIds(new Set());
              setStatementData(null);
              showToast('Workspace cleared');
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Reset workspace"
          >
            Clear
          </button>
        </div>
      </header>

      {/* 2. RECONCILIATION SUMMARY & METRICS SECTION */}
      <section className="bg-white border-b border-gray-200 px-6 py-6 shadow-xs">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header Metadata & Status Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 font-sans">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Account:</span>
                <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  {statementData ? statementData.metadata.accountNumber : '••••8412'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Statement Period:</span>
                <span className="font-medium text-gray-800">
                  {statementData?.metadata.statementPeriod || 'October 01, 2026 – October 31, 2026'}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Type:</span>
                <span className="font-medium text-gray-600">
                  {statementData?.metadata.statementType || 'Chase Business Complete Checking'}
                </span>
              </div>
            </div>

            {/* Reconciliation Status Alert Pill */}
            <div>
              {currentReconciliation?.status === 'BALANCED' ? (
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium shadow-xs"
                  title="Beginning + In - Out matches Statement Ending Balance to the cent"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>[✓ RECONCILED: $0.00 VARIANCE]</strong> — Ending balance perfectly matches statement summary
                  </span>
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium shadow-xs"
                  title={currentReconciliation?.details || 'Discrepancy detected'}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>[⚠ DISCREPANCY: {formatCurrency(currentReconciliation?.diff ?? 0, true)} - REVIEW FLAGGED ROWS]</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4 SIDE-BY-SIDE SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Beginning Balance */}
            <div className="bg-white border border-gray-200 rounded-xl p-4.5 shadow-xs hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider font-sans">
                  Beginning Balance
                </span>
                <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center text-xs">
                  $
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900 font-mono tracking-tight tabular-nums">
                {formatCurrency(summaryFigures.beginning)}
              </div>
              <div className="mt-1 text-xs text-gray-400 font-sans flex items-center gap-1">
                <span>Statement opening balance</span>
              </div>
            </div>

            {/* Card 2: Deposits (Inflow) */}
            <div className="bg-white border border-gray-200 rounded-xl p-4.5 shadow-xs hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider font-sans flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>In (Deposits)</span>
                </span>
                <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                  +
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono tracking-tight tabular-nums">
                {formatCurrency(summaryFigures.in, true)}
              </div>
              <div className="mt-1 text-xs text-gray-500 font-sans">
                {summaryFigures.creditCount} incoming deposit{summaryFigures.creditCount === 1 ? '' : 's'}
              </div>
            </div>

            {/* Card 3: Outflow (Debits + Checks) */}
            <div className="bg-white border border-gray-200 rounded-xl p-4.5 shadow-xs hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider font-sans flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-500" />
                  <span>Out (Debits + Checks)</span>
                </span>
                <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                  -
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900 font-mono tracking-tight tabular-nums">
                {formatCurrency(-summaryFigures.out, true)}
              </div>
              <div className="mt-1 text-xs text-gray-500 font-sans">
                {summaryFigures.debitCount} withdrawals • {summaryFigures.checkCount} checks paid
              </div>
            </div>

            {/* Card 4: Ending Balance */}
            <div className="bg-white border border-blue-200 rounded-xl p-4.5 shadow-xs hover:border-blue-300 transition-all ring-1 ring-blue-500/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider font-sans">
                  Ending Balance
                </span>
                <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                  <FileCheck2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-900 font-mono tracking-tight tabular-nums">
                {formatCurrency(summaryFigures.ending)}
              </div>
              <div className="mt-1 text-xs text-blue-600/80 font-sans font-medium">
                Closing reconciliation target
              </div>
            </div>
          </div>

          {/* Drag & Drop Zone Strip */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl px-4 py-3 transition-all cursor-pointer flex items-center justify-between group ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-gray-300 bg-gray-50/60 hover:bg-white hover:border-blue-400 hover:shadow-xs'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-blue-600 group-hover:border-blue-300 transition-colors shadow-2xs">
                <Upload className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <span>Drop Chase Business Checking PDF or TXT</span>
                  <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded">
                    Client-side extraction
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 truncate max-w-md">
                  Active file: <strong className="font-mono text-gray-700">{fileName}</strong>
                </div>
              </div>
            </div>
            <div className="text-xs font-medium text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
              <span>Browse files</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN SPREADSHEET DATA GRID (Airtable / Modern QuickBooks Style) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 pb-28 flex flex-col">
        {/* Table Controls & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payees, memos, amounts (Press '/')"
                className="w-full bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg pl-9 pr-8 py-1.5 text-xs font-sans text-gray-800 placeholder-gray-400 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Buttons */}
            <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg text-xs font-medium">
              {(['ALL', 'CREDIT', 'DEBIT', 'CHECK'] as const).map((tab) => {
                const count = tab === 'ALL'
                  ? transactions.length
                  : transactions.filter((t) => t.type === tab).length;
                const label = tab === 'ALL' ? 'All' : tab === 'CREDIT' ? 'In' : tab === 'DEBIT' ? 'Out' : 'Checks';
                return (
                  <button
                    key={tab}
                    onClick={() => setTypeFilter(tab)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      typeFilter === tab
                        ? 'bg-white text-gray-900 font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label} <span className="text-[10px] text-gray-400 font-normal">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Clean Payee Names Toggle */}
            <button
              onClick={() => setUseCleanPayee(!useCleanPayee)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-xs ${
                useCleanPayee
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title="Clean merchant names removes noisy banking prefixes"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Clean Payees</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  useCleanPayee ? 'bg-blue-200/80 text-blue-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {useCleanPayee ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Add Row Button */}
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs transition-all"
              title="Add manual transaction entry"
            >
              <Plus className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Add Entry</span>
            </button>

            {/* Batch Delete */}
            {selectedTxIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-xs transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedTxIds.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* Modern Data Grid Table Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[340px]">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTxIds.size === filteredTransactions.length
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="w-24 px-4 py-3">Date</th>
                  <th className="w-28 px-4 py-3">Type</th>
                  <th className="px-4 py-3">
                    {useCleanPayee ? 'Clean Payee (Editable)' : 'Merchant Payee'}
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">Original Memo</th>
                  <th className="w-36 px-4 py-3 text-right">Amount ($)</th>
                  <th className="w-16 px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="w-10 h-10 text-gray-300" />
                        <p className="text-sm font-medium text-gray-700">No transactions match your search query.</p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setTypeFilter('ALL');
                            loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
                          }}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
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

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-blue-50/60 hover:bg-blue-50/90'
                            : 'hover:bg-blue-50/30'
                        } ${tx.isFlagged ? 'bg-amber-50/60' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(tx.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Date (Monospace Tabular) */}
                        <td className="w-24 px-4 py-2.5 text-gray-600 font-mono text-xs tabular-nums font-medium">
                          {tx.date}
                        </td>

                        {/* Type Badge */}
                        <td className="w-28 px-4 py-2.5">
                          {isCredit && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              + Credit
                            </span>
                          )}
                          {!isCredit && !isCheck && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                              - Debit
                            </span>
                          )}
                          {isCheck && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Check {tx.checkNumber ? `#${tx.checkNumber}` : ''}
                            </span>
                          )}
                        </td>

                        {/* Clean Payee Cell (Editable) */}
                        <td
                          className="px-4 py-2.5 text-gray-900 font-medium cursor-pointer"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'cleanPayee') {
                              handleStartEdit(tx.id, 'cleanPayee', tx.cleanPayee);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'cleanPayee' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-full bg-white border border-blue-500 ring-2 ring-blue-100 rounded px-2 py-1 text-xs font-sans text-gray-900 focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell">
                              <span className="truncate max-w-[260px] lg:max-w-xs">{tx.cleanPayee}</span>
                              <span className="text-[10px] text-gray-400 font-normal opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                edit
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Original Memo Cell */}
                        <td
                          className="px-4 py-2.5 text-gray-500 truncate max-w-[220px] lg:max-w-md hidden md:table-cell cursor-pointer text-xs"
                          title={tx.originalMemo}
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'originalMemo') {
                              handleStartEdit(tx.id, 'originalMemo', tx.originalMemo);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'originalMemo' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-full bg-white border border-blue-500 ring-2 ring-blue-100 rounded px-2 py-1 text-xs font-sans text-gray-900 focus:outline-none"
                            />
                          ) : (
                            <span>{tx.originalMemo}</span>
                          )}
                        </td>

                        {/* Amount Cell (Monospace Tabular Figures) */}
                        <td
                          className="w-36 px-4 py-2.5 text-right font-mono text-xs tabular-nums font-semibold cursor-pointer"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'amount') {
                              handleStartEdit(tx.id, 'amount', tx.rawAmount);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'amount' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={handleCommitEdit}
                              className="w-28 bg-white border border-blue-500 ring-2 ring-blue-100 rounded px-2 py-1 text-xs font-mono text-right text-gray-900 focus:outline-none ml-auto"
                            />
                          ) : (
                            <span className={isCredit ? 'text-emerald-600' : 'text-gray-900'}>
                              {formatCurrency(tx.amount, true)}
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="w-16 px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteRow(tx.id)}
                            className="text-gray-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
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

          {/* Table Footer Bar */}
          <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 font-sans">
            <div className="flex items-center gap-3">
              <span>Showing <strong>{filteredTransactions.length}</strong> of <strong>{transactions.length}</strong> entries</span>
              <span>•</span>
              <span>Click any Payee or Amount cell to edit inline</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <span>Net Ledger Flow:</span>
              <strong
                className={`font-mono font-semibold tabular-nums ${
                  summaryFigures.in - summaryFigures.out >= 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {formatCurrency(summaryFigures.in - summaryFigures.out, true)}
              </strong>
            </div>
          </div>
        </div>
      </main>

      {/* 4. EXPORT ACTION TOOLBAR (Docked at Bottom) */}
      <footer className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200 px-6 flex items-center justify-between z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedTxIds.size > 0
                ? `${selectedTxIds.size} of ${transactions.length} rows selected`
                : `${transactions.length} transactions ready for export`}
            </span>
          </div>
          <span className="hidden xl:inline text-gray-300">|</span>
          <span className="hidden xl:inline text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 font-mono text-[11px]">Ctrl+E</kbd> for instant QBO export
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-1">
          {/* Download QuickBooks Online CSV (Primary Button: Trustworthy Financial Blue) */}
          <button
            onClick={handleExportQBO}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Download QuickBooks Online CSV (Date, Description, Amount)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>QuickBooks Online CSV</span>
          </button>

          {/* Download Xero CSV */}
          <button
            onClick={handleExportXero}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Download Xero CSV (Date, Amount, Payee, Description, Reference)"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Xero CSV</span>
          </button>

          {/* Download Standard 4-Column CSV */}
          <button
            onClick={handleExport4Column}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 hidden sm:flex"
            title="Download Standard 4-Column CSV (Date, Description, Debit, Credit)"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Standard 4-Column</span>
          </button>

          {/* Copy to Clipboard as TSV */}
          <button
            onClick={handleCopyTSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Direct copy for Excel or Google Sheets"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copy TSV</span>
          </button>
        </div>
      </footer>

      {/* PASTE TEXT MODAL (Clean Light Dialog) */}
      {pasteModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">
                    Paste Chase Statement Text
                  </h3>
                  <p className="text-xs text-gray-500">
                    Extracts deposits, withdrawals, and checks directly in browser memory.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={12}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="Paste raw Chase statement text here..."
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 font-mono text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setRawPasteText(SAMPLE_CHASE_STATEMENT)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
              >
                Insert sample fixture text
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setPasteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (rawPasteText.trim()) {
                      loadStatementText(rawPasteText, 'pasted_chase_statement.txt');
                      setPasteModalOpen(false);
                      setRawPasteText('');
                    }
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                >
                  Parse & Convert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION TOAST */}
      {toastMessage && (
        <div className="fixed bottom-20 right-6 z-40 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2.5 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
