'use strict';

/**
 * StatementForge — Client-Side License Gate
 *
 * Manages Gumroad license verification state entirely in the browser.
 * - Free tier: first FREE_TIER_LIMIT transactions displayed and exported
 * - Verified: unlimited display and export
 * - License state is persisted in localStorage between sessions
 */

export const GUMROAD_PERMALINK = 'statementforge';
export const FREE_TIER_LIMIT = 20;
export const LICENSE_STORAGE_KEY = 'statementforge_license';

export interface LicenseState {
  verified: boolean;
  key: string | null;
  verifiedAt: number | null; // Unix timestamp ms
}

const DEFAULT_LICENSE_STATE: LicenseState = {
  verified: false,
  key: null,
  verifiedAt: null,
};

/**
 * Load persisted license state from localStorage.
 * Returns default (unverified) state if not available.
 */
export function loadLicenseState(): LicenseState {
  if (typeof window === 'undefined') return DEFAULT_LICENSE_STATE;
  try {
    const raw = window.localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) return DEFAULT_LICENSE_STATE;
    const parsed = JSON.parse(raw) as LicenseState;
    if (typeof parsed.verified !== 'boolean') return DEFAULT_LICENSE_STATE;
    return parsed;
  } catch {
    return DEFAULT_LICENSE_STATE;
  }
}

/**
 * Persist license state to localStorage.
 */
export function saveLicenseState(key: string, verified: boolean): void {
  if (typeof window === 'undefined') return;
  const state: LicenseState = {
    verified,
    key,
    verifiedAt: verified ? Date.now() : null,
  };
  try {
    window.localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in private mode
  }
}

/**
 * Clear license state from localStorage.
 */
export function clearLicenseState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * Verify a Gumroad license key via the Next.js proxy route.
 * Returns { success: true } on valid key, { success: false, error: string } otherwise.
 */
export async function verifyGumroadLicense(
  key: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return { success: false, error: 'Please enter a license key.' };
  }

  try {
    const res = await fetch('/api/verify-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: trimmedKey,
        productPermalink: GUMROAD_PERMALINK,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Server error (${res.status}). Please try again.` };
    }

    const data = await res.json();

    if (data.success === true) {
      saveLicenseState(trimmedKey, true);
      return { success: true };
    }

    // Gumroad returns { success: false, message: "..." } on invalid keys
    const errorMsg = data.message || 'Invalid license key. Please check and try again.';
    return { success: false, error: errorMsg };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: `Could not connect to verification server: ${message}` };
  }
}
