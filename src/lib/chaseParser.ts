'use strict';

/**
 * Re-exports from modular parserEngine, parsers/chase, and vendorRules
 * for full backward compatibility.
 */
export * from './types';
export * from './parsers/chase';
export * from './vendorRules';
export {
  detectBank,
  parseStatement,
  parseMultipleStatements,
  sortTransactionsChronologically,
  recalculateReconciliation,
  BANK_REGISTRY,
} from './parserEngine';
