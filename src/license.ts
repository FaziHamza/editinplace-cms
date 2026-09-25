import type { EditInPlaceConfig, LicenseStatus, PlanFeatures } from './types';
import { secureGet, secureSet, secureRemove } from './storage';

const CACHE_KEY = 'editinplace_license_cache';

/**
 * Short on purpose: when an account is upgraded, the new plan has to reach the
 * editor quickly. A day-long cache meant a paying customer could wait until
 * tomorrow for image editing to appear. Network failures still fall back to the
 * stale entry, so offline editing is unaffected.
 */
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/** The key the current session is licensed under, config first, session second. */
export function currentLicenseKey(config: EditInPlaceConfig): string {
  return config.licenseKey || secureGet('builder_token') || '';
}

export function readLicenseCache(
  config: EditInPlaceConfig,
  ignoreTTL = false
): LicenseStatus | null {
  try {
    const raw = secureGet(CACHE_KEY);
    if (!raw) return null;

    const { status, timestamp, key } = JSON.parse(raw);

    // A different licence key means a different account — never serve its plan
    if (key !== currentLicenseKey(config)) return null;
    if (!ignoreTTL && Date.now() - timestamp > CACHE_TTL) return null;

    return status as LicenseStatus;
  } catch {
    return null;
  }
}

/** Drops the cached plan so the next check goes to the server. */
export function clearLicenseCache(): void {
  secureRemove(CACHE_KEY);
}

export function writeLicenseCache(config: EditInPlaceConfig, status: LicenseStatus): void {
  try {
    secureSet(
      CACHE_KEY,
      JSON.stringify({ status, timestamp: Date.now(), key: currentLicenseKey(config) })
    );
  } catch {
    /* localStorage full or blocked — the next load just revalidates */
  }
}

/**
 * What the current plan unlocks.
 *
 * Backends older than the free tier don't send `features`; assume allowed there
 * and let the server stay the authority — every gated endpoint re-checks anyway.
 */
export function planFeatures(status: LicenseStatus | null): PlanFeatures {
  return status?.features ?? { images: true };
}

/** Message shown when someone tries to edit on an expired or invalid licence. */
export function licenseBlockedMessage(status: LicenseStatus | null): string {
  if (status?.plan === 'expired') {
    return 'Your free trial has expired. Subscribe to enable editing.';
  }
  return status?.message || 'License validation failed. Editing is disabled.';
}

/**
 * Banner shown at the top of the panel, or an empty string when the plan has
 * nothing worth saying.
 */
export function trialBannerHTML(
  status: LicenseStatus | null,
  valid: boolean,
  dismissed: boolean
): string {
  if (dismissed || !status) return '';

  const banner = (icon: string, text: string, danger = false) => `
        <div class="lcms-trial-banner" id="lcms-trial-banner"${
          danger
            ? ' style="background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#f87171;"'
            : ''
        }>
          <span class="lcms-trial-banner-icon">${icon}</span>
          <span class="lcms-trial-banner-text">${text}</span>
          <button class="lcms-trial-banner-dismiss" id="lcms-trial-dismiss" title="Dismiss"${
            danger ? ' style="color:rgba(239,68,68,0.5);"' : ''
          }>✕</button>
        </div>
      `;

  if (!valid) {
    const msg =
      status.plan === 'expired'
        ? 'Trial expired — editing disabled. Subscribe to continue.'
        : 'License invalid — editing disabled.';
    return banner('🔒', msg, true);
  }

  if (status.plan === 'trial') {
    const days = status.daysLeft ?? 0;
    return banner('⏳', `Free Trial: ${days} day${days !== 1 ? 's' : ''} remaining`);
  }

  // Free plan — editing works, images don't. Say so up front rather than
  // letting the user hunt for a missing control.
  if (status.plan === 'free') {
    return banner('✨', 'Free plan — upgrade to edit images');
  }

  return '';
}

/**
 * Asks the licence API what this key is allowed to do.
 *
 * Returns the status rather than mutating anything, so the caller decides what
 * to do with a refusal. Falls back to a stale cache entry when the network is
 * down, which is what keeps editing working on a flaky connection.
 */
export async function fetchLicenseStatus(config: EditInPlaceConfig): Promise<LicenseStatus> {
  const licenseKey = currentLicenseKey(config);

  if (!licenseKey) {
    return { valid: false, plan: 'invalid', message: 'No license key provided.' };
  }

  const cached = readLicenseCache(config);
  if (cached) return cached;

  const validateUrl =
    config.licenseValidateUrl || (config.apiBase ? `${config.apiBase}/license/validate` : '');

  // No validation URL configured — allow, rather than blocking a site whose
  // owner has not set up licensing at all
  if (!validateUrl) {
    return { valid: true, plan: 'trial', message: 'No license API configured.' };
  }

  try {
    const builderToken = secureGet('builder_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (builderToken) headers['Authorization'] = `Bearer ${builderToken}`;

    const res = await fetch(validateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ licenseKey, domain: window.location.hostname }),
    });

    let data: LicenseStatus;
    try {
      data = await res.json();
    } catch {
      throw new Error('Invalid response from license server');
    }

    writeLicenseCache(config, data);
    return data;
  } catch {
    // Network error — a previously valid cache beats locking the user out
    const fallback = readLicenseCache(config, true);
    if (fallback?.valid) return fallback;

    return {
      valid: false,
      plan: 'invalid',
      message: 'Unable to verify license. Please check your internet connection.',
    };
  }
}
