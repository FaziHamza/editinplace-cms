export { EditInPlace } from './editinplace';

/**
 * Session storage helpers.
 *
 * Exported so a host page can seed or clear the editor's session itself —
 * the demo page uses this to open in edit mode without a backend to sign
 * in against.
 */
export { secureGet, secureSet, secureRemove, secureClear } from './storage';
export type {
  EditInPlaceConfig,
  PlanFeatures,
  PageTextEntry,
  WebPageContent,
  EditHistoryEntry,
  LicenseStatus,
} from './types';

import { EditInPlace } from './editinplace';
import type { EditInPlaceConfig } from './types';

/**
 * Names this package used before it was renamed to EditInPlace.
 *
 * Kept so existing imports keep compiling. They will be removed in a future
 * major version — move to `EditInPlace` and `EditInPlaceConfig`.
 *
 * @deprecated Use `EditInPlace` instead.
 */
export const XtroedgeCMS = EditInPlace;

/** @deprecated Use `EditInPlaceConfig` instead. */
export type XtroedgeCmsConfig = EditInPlaceConfig;

// ===== AUTO-INIT =====
// Automatically initializes the editor when the script loads.
// No manual code needed - just install the package.
// To pass config, set window.__EDITINPLACE_CONFIG__ before loading.

async function boot() {
  await EditInPlace.autoInit();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // DOM already ready (script loaded async/defer or after DOMContentLoaded)
    boot();
  }
}
