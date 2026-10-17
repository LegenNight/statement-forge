'use strict';

import { ParsedTransaction, VendorRule } from './types';

export const VENDOR_RULES_STORAGE_KEY = 'statementforge_vendor_rules';

export const DEFAULT_VENDOR_RULES: VendorRule[] = [
  {
    id: 'rule_stripe',
    pattern: 'STRIPE',
    vendor: 'Stripe Payments',
    category: 'Merchant Processing Fees',
  },
  {
    id: 'rule_aws',
    pattern: 'AWS',
    vendor: 'Amazon Web Services',
    category: 'Cloud Infrastructure & Hosting',
  },
  {
    id: 'rule_google',
    pattern: 'GOOGLE',
    vendor: 'Google Workspace',
    category: 'Software Subscriptions',
  },
  {
    id: 'rule_gusto',
    pattern: 'GUSTO',
    vendor: 'Gusto Payroll',
    category: 'Payroll & Employee Compensation',
  },
  {
    id: 'rule_office_depot',
    pattern: 'OFFICE DEPOT',
    vendor: 'Office Depot',
    category: 'Office Supplies & Materials',
  },
];

/**
 * Loads rules from browser localStorage with safe fallback for SSR
 */
export function loadVendorRules(): VendorRule[] {
  if (typeof window === 'undefined') {
    return DEFAULT_VENDOR_RULES;
  }
  try {
    const raw = localStorage.getItem(VENDOR_RULES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(VENDOR_RULES_STORAGE_KEY, JSON.stringify(DEFAULT_VENDOR_RULES));
      return DEFAULT_VENDOR_RULES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VENDOR_RULES;
  } catch (err) {
    console.warn('Failed to read vendor rules from localStorage:', err);
    return DEFAULT_VENDOR_RULES;
  }
}

/**
 * Persists rules to browser localStorage
 */
export function saveVendorRules(rules: VendorRule[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VENDOR_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error('Failed to save vendor rules to localStorage:', err);
  }
}

/**
 * Runs transactions through the deterministic rules engine.
 * Matches payee and original memo against rule patterns (case-insensitive).
 * Dynamically appends mappedVendor and mappedCategory if a match is found.
 */
export function applyVendorRules(transactions: ParsedTransaction[], rules: VendorRule[]): ParsedTransaction[] {
  if (!rules || rules.length === 0) return transactions;

  return transactions.map((tx) => {
    const targetText = `${tx.cleanPayee} ${tx.originalMemo}`.toLowerCase();

    for (const rule of rules) {
      const pat = rule.pattern.trim().toLowerCase();
      if (pat && targetText.includes(pat)) {
        return {
          ...tx,
          mappedVendor: rule.vendor.trim(),
          mappedCategory: rule.category.trim(),
        };
      }
    }

    return tx;
  });
}

/**
 * Redacts account numbers, routing strings, and sensitive digits.
 * Replaces full account numbers with masked ••••last4.
 */
export function redactText(text: string): string {
  if (!text) return '';
  // Redact 7-16 digit numbers down to ••••last4
  let res = text.replace(/\b(?:\d{3,12})(\d{4})\b/g, '••••$1');
  // Redact Account Number: 0000008412 patterns
  res = res.replace(/(Account\s+(?:Number|#|Ending\s+in)[:\s]+)(?:[\d\.\*]+)/gi, '$1••••');
  return res;
}

/**
 * Redacts a clean account number down to ••••last4
 * e.g. "0000008412" -> "••••8412"
 */
export function redactAccountNumber(accountNum: string): string {
  if (!accountNum) return '••••';
  const digits = accountNum.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `••••${digits.slice(-4)}`;
  }
  return '••••' + accountNum.slice(-4);
}
