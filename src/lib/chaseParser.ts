'use strict';

/**
 * Re-exports from modular parserEngine and parsers/chase
 * for full backward compatibility.
 */
export * from './types';
export * from './parsers/chase';
export {
  detectBank,
  parseStatement,
  parseMultipleStatements,
  sortTransactionsChronologically,
  recalculateReconciliation,
  BANK_REGISTRY,
} from './parserEngine';
