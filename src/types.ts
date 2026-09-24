/** Configuration for the CMS */
export interface EditInPlaceConfig {
  /** Our EditInPlace server URL — login, license, save, publish (required) */
  apiBase?: string;
  /** Client's API server URL — GET pages, image upload (falls back to apiBase if not set) */
  clientApi?: string;
  /** Headers to send with client API GET requests (e.g. {"x-data-source": "dev"}) */
  clientHeaders?: Record<string, string>;
  /** Base URL prepended to uploaded image paths (defaults to clientApi or apiBase origin) */
  imageBaseUrl?: string;
  /** CSS selector for the content container to scan (default: 'body') */
  containerSelector?: string;
  /** HTML tags to make editable (default: h1-h6, p, span, b, strong, i, em, a, button, li, label, small, blockquote, td, th) */
  editableTags?: string[];
  /** Supported content languages (default: ['en']) */
  languages?: string[];
  /** Default language (default: 'en') */
  defaultLanguage?: string;
  /** Path to i18n JSON files for pre-populating translations (optional) */
  i18nBasePath?: string;
  /** Days to keep edit history in IndexedDB (default: 7) */
  historyRetentionDays?: number;
  /** Highlight color for editable elements and the panel accent (default: '#00C853') */
  highlightColor?: string;
  /** Login API URL — if builder_token not found in localStorage, show login modal (default: apiBase + '/auth/login') */
  loginUrl?: string;
  /** License key for subscription validation */
  licenseKey?: string;
  /** License validation API URL (default: apiBase + '/license/validate') */
  licenseValidateUrl?: string;
  /** Enable rich text toolbar for inline editing (default: true) */
  richText?: boolean;

  // Callbacks
  onSaved?: () => void;
  onPublished?: () => void;
  onError?: (action: string, error: any) => void;
  onEditModeChanged?: (editMode: boolean) => void;
  onLangChanged?: (lang: string) => void;
}

/** Text entry for a single element across languages */
export interface PageTextEntry {
  [lang: string]: string;
}

/** Page content structure from API */
export interface WebPageContent {
  slug: string;
  title: string;
  content: {
    texts: { [key: string]: PageTextEntry };
    images?: { [key: string]: string };
  };
  published_content?: {
    texts: { [key: string]: PageTextEntry };
    images?: { [key: string]: string };
  };
}

/** Edit history entry stored in IndexedDB */
export interface EditHistoryEntry {
  id?: number;
  slug: string;
  timestamp: number;
  label: string;
  lang: string;
  snapshot: string;
}

/** Internal element tracking info */
export interface ManagedElementInfo {
  key: string;
  sectionSlug: string; // '/header', '/footer', or current page slug
  blurHandler: (e: Event) => void;
  keydownHandler: (e: KeyboardEvent) => void;
  inputHandler: (e: Event) => void;
  clickHandler: (e: Event) => void;
}

/** Internal image tracking info */
export interface ManagedImageInfo {
  key: string;
  ctxHandler: (e: MouseEvent) => void;
}

/** Capabilities the current plan unlocks. */
export interface PlanFeatures {
  /** Replacing images from the inline editor. Paid plans only. */
  images: boolean;
}

/** License validation response */
export interface LicenseStatus {
  valid: boolean;
  plan: 'free' | 'trial' | 'paid' | 'expired' | 'invalid';
  /** Omitted by older backends — callers must fall back, see DEFAULT_FEATURES. */
  features?: PlanFeatures;
  daysLeft?: number;
  message?: string;
}
