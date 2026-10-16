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
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  CornerDownRight,
  Filter,
  Eye,
  SlidersHorizontal,
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
  const [fileName, setFileName] = useState<string>('sample_chase_oct2026.txt');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with the sample statement on first load
  useEffect(() => {
    loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf');
  }, []);

  // Show transient toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Keyboard shortcuts: "/" to search, "Ctrl+E" / "Cmd+E" to export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on "/" if not currently in an input
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Quick export on Cmd/Ctrl + E
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

  // Dynamically recompute reconciliation based on current transactions
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

    return {
      beginning: beg,
      in: totalIn,
      out: totalOut,
      ending: end,
    };
  }, [statementData, transactions]);

  // Filtered transactions for the data grid
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      // Search query
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

  // Export actions
  const getExportData = () => {
    // If some rows are selected, export only selected rows; otherwise export all current transactions
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
    <div className="flex flex-col min-h-screen bg-canvas text-foregroundBright select-text">
      {/* 1. HEADER BAR (Height 48px / h-12) */}
      <header className="h-12 border-b border-borderDark bg-[#121214] px-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-mono text-xs font-bold shadow-inner">
              ⚡
            </div>
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-200 uppercase">
              StatementForge <span className="text-zinc-500">//</span> Chase Engine
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-4">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>100% Client-Side Processing</span>
            </div>
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <ShieldCheck className="w-3 h-3 text-zinc-400" />
              <span>Zero Server Uploads</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shadow-sm"
            title="Load sample fixture data"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Load Sample Chase Statement</span>
          </button>

          <button
            onClick={() => setPasteModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            title="Paste raw Chase statement text"
          >
            <FileText className="w-3 h-3" />
            <span className="hidden md:inline">Paste Text</span>
          </button>

          <button
            onClick={() => {
              setTransactions([]);
              setSelectedTxIds(new Set());
              setStatementData(null);
              showToast('Workspace cleared');
            }}
            className="px-2 py-1 text-xs font-mono rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
            title="Clear current transactions"
          >
            Clear
          </button>
        </div>
      </header>

      {/* 2. SPLIT WORKSPACE: TOP TELEMETRY & CONTROLS */}
      <section className="border-b border-borderDark bg-[#0e0e11] px-4 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Upload Dropzone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-4 rounded border border-dashed transition-all cursor-pointer p-3 flex items-center justify-between group ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20'
                : 'border-zinc-700/80 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-600'
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
              <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/50 transition-colors">
                <Upload className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                  <span>Drop Chase PDF / TXT</span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1 py-0.2 rounded">Client Only</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 truncate max-w-[190px]">
                  {fileName || 'Drop statement file here'}
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300">
              Browse
            </div>
          </div>

          {/* Balance Reconciliation Card (Compact monospace table) */}
          <div className="lg:col-span-8 bg-zinc-900/70 border border-zinc-800 rounded p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 font-mono text-xs">
              <div className="flex flex-col border-r border-zinc-800/80 pr-2">
                <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Beginning</span>
                <span className="text-zinc-200 tabular-nums font-medium text-xs">
                  {formatCurrency(summaryFigures.beginning)}
                </span>
              </div>
              <div className="flex flex-col border-r border-zinc-800/80 pr-2">
                <span className="text-[10px] uppercase text-emerald-500 font-semibold tracking-wider">In (Deposits)</span>
                <span className="text-emerald-400 tabular-nums font-medium text-xs">
                  {formatCurrency(summaryFigures.in, true)}
                </span>
              </div>
              <div className="flex flex-col border-r border-zinc-800/80 pr-2">
                <span className="text-[10px] uppercase text-zinc-400 font-semibold tracking-wider">Out (Debits+Checks)</span>
                <span className="text-zinc-300 tabular-nums font-medium text-xs">
                  {formatCurrency(-summaryFigures.out, true)}
                </span>
              </div>
              <div className="flex flex-col pr-1">
                <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Ending Balance</span>
                <span className="text-zinc-100 tabular-nums font-semibold text-xs">
                  {formatCurrency(summaryFigures.ending)}
                </span>
              </div>
            </div>

            {/* Status Pill */}
            <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-zinc-800 pt-2 md:pt-0 md:pl-3">
              {currentReconciliation?.status === 'BALANCED' ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-medium tracking-tight shadow-sm"
                  title="Mathematical reconciliation difference is $0.00"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[✓ RECONCILED: $0.00 VARIANCE]</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/50 text-amber-300 font-mono text-xs font-medium tracking-tight animate-pulse"
                  title={currentReconciliation?.details || 'Discrepancy detected'}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    [⚠ DISCREPANCY: {formatCurrency(currentReconciliation?.diff ?? 0, true)} - REVIEW FLAGGED ROWS]
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata sub-strip */}
        {statementData && (
          <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-4">
              <span>
                Account: <strong className="text-zinc-300 font-mono">{statementData.metadata.accountNumber}</strong>
              </span>
              <span>
                Period: <strong className="text-zinc-300 font-mono">{statementData.metadata.statementPeriod || 'October 2026'}</strong>
              </span>
              <span className="hidden sm:inline">
                Type: <strong className="text-zinc-400 font-mono">{statementData.metadata.statementType}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>{transactions.length} total entries</span>
              <span>•</span>
              <span>{selectedTxIds.size} selected</span>
            </div>
          </div>
        )}
      </section>

      {/* 3. MAIN PANEL: EDITABLE SPREADSHEET DATA GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col pb-24">
        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter transactions by payee, memo, date... (Press '/')"
                className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-7 py-1 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[11px] font-mono">
              {(['ALL', 'CREDIT', 'DEBIT', 'CHECK'] as const).map((tab) => {
                const count = tab === 'ALL'
                  ? transactions.length
                  : transactions.filter((t) => t.type === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setTypeFilter(tab)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      typeFilter === tab
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle: "Clean Payee Names" */}
            <button
              onClick={() => setUseCleanPayee(!useCleanPayee)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                useCleanPayee
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle cleaned merchant names vs raw bank memo"
            >
              <Sparkles className="w-3 h-3" />
              <span>Clean Payees</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${useCleanPayee ? 'bg-emerald-800/50 text-emerald-200' : 'bg-zinc-800 text-zinc-500'}`}>
                {useCleanPayee ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Add Row Button */}
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
              title="Add a manual entry row"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline">Add Row</span>
            </button>

            {/* Batch Delete */}
            {selectedTxIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Selected ({selectedTxIds.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="border border-borderDark rounded bg-[#101013] overflow-hidden flex-1 shadow-sm">
          <div className="overflow-x-auto max-h-[calc(100vh-270px)] min-h-[300px]">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-[#18181b] text-zinc-400 sticky top-0 z-10 border-b border-borderDark text-[11px] uppercase tracking-wider select-none">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTxIds.size === filteredTransactions.length
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="w-20 px-3 py-2 font-semibold">Date</th>
                  <th className="w-28 px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">
                    {useCleanPayee ? 'Clean Payee (Editable)' : 'Merchant Payee'}
                  </th>
                  <th className="px-3 py-2 font-semibold hidden md:table-cell">Original Memo</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">Amount ($)</th>
                  <th className="w-16 px-3 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-zinc-500 font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-zinc-600" />
                        <p className="text-sm">No transactions match the current filter or statement is empty.</p>
                        <button
                          onClick={() => loadStatementText(SAMPLE_CHASE_STATEMENT, 'chase_business_oct2026.pdf')}
                          className="mt-2 text-xs text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Reload Chase Sample Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => {
                    const isSelected = selectedTxIds.has(tx.id);
                    const isCredit = tx.type === 'CREDIT';
                    const isCheck = tx.type === 'CHECK';

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-zinc-800/40 hover:bg-zinc-800/60'
                            : idx % 2 === 0
                            ? 'bg-transparent hover:bg-zinc-900/60'
                            : 'bg-zinc-950/30 hover:bg-zinc-900/60'
                        } ${tx.isFlagged ? 'bg-amber-950/20' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(tx.id)}
                            className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Date */}
                        <td className="w-20 px-3 py-2 text-zinc-300 tabular-nums">
                          {tx.date}
                        </td>

                        {/* Type Badge */}
                        <td className="w-28 px-3 py-2">
                          {isCredit && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                              + CREDIT
                            </span>
                          )}
                          {!isCredit && !isCheck && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                              - DEBIT
                            </span>
                          )}
                          {isCheck && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-950/50 text-sky-400 border border-sky-800/40">
                              CHK {tx.checkNumber ? `#${tx.checkNumber}` : 'PAID'}
                            </span>
                          )}
                        </td>

                        {/* Clean Payee Cell (Editable) */}
                        <td
                          className="px-3 py-2 text-zinc-100 font-medium cursor-pointer relative"
                          onClick={() => {
                            if (editingCell?.id !== tx.id || editingCell.field !== 'cleanPayee') {
                              handleStartEdit(tx.id, 'cleanPayee', tx.cleanPayee);
                            }
                          }}
                        >
                          {editingCell?.id === tx.id && editingCell.field === 'cleanPayee' ? (
                            <div className="flex items-center gap-1">
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
                                className="w-full bg-zinc-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-100 focus:outline-none"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group/cell">
                              <span className="truncate max-w-[240px] lg:max-w-xs">{tx.cleanPayee}</span>
                              <span className="text-[10px] text-zinc-600 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                edit
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Original Memo Cell */}
                        <td
                          className="px-3 py-2 text-zinc-400 truncate max-w-[200px] lg:max-w-md hidden md:table-cell cursor-pointer"
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
                              className="w-full bg-zinc-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-100 focus:outline-none"
                            />
                          ) : (
                            <span>{tx.originalMemo}</span>
                          )}
                        </td>

                        {/* Amount Cell (Editable) */}
                        <td
                          className="w-32 px-3 py-2 text-right tabular-nums font-medium cursor-pointer"
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
                              className="w-24 bg-zinc-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono text-right text-zinc-100 focus:outline-none ml-auto"
                            />
                          ) : (
                            <span
                              className={
                                isCredit
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-zinc-300'
                              }
                            >
                              {formatCurrency(tx.amount, true)}
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="w-16 px-3 py-2 text-center">
                          <button
                            onClick={() => handleDeleteRow(tx.id)}
                            className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete this transaction row"
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

          {/* Table Footer Telemetry */}
          <div className="bg-[#121215] border-t border-borderDark px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-3">
              <span>Showing {filteredTransactions.length} of {transactions.length} entries</span>
              <span>•</span>
              <span>Double-click or click any Payee/Amount to edit inline</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <span>
                Net Ledger Flow:{' '}
                <strong
                  className={
                    summaryFigures.in - summaryFigures.out >= 0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  {formatCurrency(summaryFigures.in - summaryFigures.out, true)}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 4. EXPORT ACTION BAR (Bottom Toolbar) */}
      <footer className="fixed bottom-0 left-0 right-0 h-14 bg-[#121215]/95 backdrop-blur-md border-t border-borderDark px-4 flex items-center justify-between z-20 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedTxIds.size > 0
                ? `${selectedTxIds.size} of ${transactions.length} selected for export`
                : `${transactions.length} transactions ready`}
            </span>
          </div>
          <span className="hidden xl:inline text-zinc-600 text-xs">|</span>
          <span className="hidden xl:inline text-[11px] font-mono text-zinc-500">
            Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Ctrl+E</kbd> for instant QBO export
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* Download QuickBooks Online CSV */}
          <button
            onClick={handleExportQBO}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Date, Description, Amount (Debits negative, Credits positive)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>QuickBooks Online CSV</span>
          </button>

          {/* Download Xero CSV */}
          <button
            onClick={handleExportXero}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 border border-zinc-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Date, Amount, Payee, Description, Reference"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Xero CSV</span>
          </button>

          {/* Download Standard 4-Column CSV */}
          <button
            onClick={handleExport4Column}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 hidden sm:flex"
            title="Date, Description, Debit, Credit"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Standard 4-Column CSV</span>
          </button>

          {/* Copy to Clipboard as TSV */}
          <button
            onClick={handleCopyTSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Direct paste into Excel or Google Sheets"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Copy as TSV</span>
          </button>
        </div>
      </footer>

      {/* PASTE TEXT MODAL */}
      {pasteModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-borderDark rounded-lg max-w-2xl w-full p-4 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-borderDark pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="font-mono text-sm font-semibold text-zinc-100">
                  Paste Chase Statement Raw Text
                </h3>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Paste statement text directly from Chase PDF or online checking summary.
              StatementForge will deterministically extract deposits, withdrawals, and checks.
            </p>

            <textarea
              rows={12}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="Paste raw Chase statement text here..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 font-mono text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setRawPasteText(SAMPLE_CHASE_STATEMENT)}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-200 underline"
              >
                Insert sample fixture text
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPasteModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
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
                  className="px-3 py-1.5 text-xs font-mono rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
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
        <div className="fixed bottom-16 right-4 z-40 bg-zinc-900 border border-zinc-700 text-zinc-100 px-3 py-2 rounded shadow-2xl font-mono text-xs flex items-center gap-2 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
