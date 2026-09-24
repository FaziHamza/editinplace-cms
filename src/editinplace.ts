import { CMS_STYLES } from './styles';
import type {
  EditInPlaceConfig, PageTextEntry, WebPageContent,
  EditHistoryEntry, ManagedElementInfo, ManagedImageInfo, LicenseStatus, PlanFeatures
} from './types';
import { ICON } from './icons';
import { DB_NAME, STORE_NAME, DEFAULT_EDITABLE_TAGS, DEFAULT_API_BASE } from './constants';
import { secureGet, secureSet, secureRemove, secureClear } from './storage';
import {
  createElement, hexToRgb, darkenHex, resolveClientUrl, detectLanguage,
  resolveSiteIdentifier,
} from './utils';
import {
  readHistory, writeHistoryEntry, pruneHistory, formatHistoryDate, closeHistoryDB,
} from './history';
import {
  fetchLicenseStatus, planFeatures, licenseBlockedMessage, trialBannerHTML,
  clearLicenseCache,
} from './license';




export class EditInPlace {
  /** Shared MutationObserver options — watch childList, attributes (class), and text changes */
  private static readonly OBS_INIT: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    characterData: true,
  };

  // ===== Config =====
  private config: EditInPlaceConfig;
  private containerSelector: string;
  private editableTags: string[];
  private languages: string[];
  private defaultLanguage: string;
  private highlightColor: string;
  private brandingEl: HTMLElement | null = null;
  private historyRetentionMs: number;
  private siteIdentifier = '';
  private siteIdEl: HTMLElement | null = null;
  private loginModalEl: HTMLElement | null = null;
  private pendingEditMode = false; // edit=true was requested but token missing

  // ===== State =====
  private editMode = false;
  private currentLang = 'en';
  private pageTexts: { [key: string]: PageTextEntry } = {};
  private pageImages: { [key: string]: string } = {};
  private originalTexts: { [key: string]: PageTextEntry } = {};
  private originalImages: { [key: string]: string } = {};
  private unsavedChanges = 0;
  private isSaving = false;
  private isPublishing = false;
  private loading = false;
  private canUndo = false;
  private canRedo = false;
  private showHistory = false;
  private historyList: EditHistoryEntry[] = [];
  private isOpen = false;
  private isEditAllowed = false;
  private imageUploading = false;
  private toastMessage = '';
  private toastType: 'success' | 'error' = 'success';

  // ===== Undo/Redo =====
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private dirtyKeys = new Set<string>();
  private dirtyImageKeys = new Set<string>();
  private registeredKeys = new Set<string>();

  // ===== DOM =====
  private domOriginals: { [key: string]: string } = {};
  private managedElements = new Map<HTMLElement, ManagedElementInfo>();
  private managedImages = new Map<HTMLImageElement, ManagedImageInfo>();
  private autoDetectedElements = new Set<HTMLElement>();
  private observer: MutationObserver | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeImageEl: HTMLImageElement | null = null;
  private imageCtxMenu: HTMLElement | null = null;
  private floatingEditDialog: HTMLElement | null = null;

  // ===== Rich Text Toolbar =====
  private richToolbarEl: HTMLElement | null = null;
  private activeEditableEl: HTMLElement | null = null;
  private toolbarHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private selectionChangeHandler: (() => void) | null = null;

  // ===== OTP =====
  private otpSessionId: string | null = null;
  private otpCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private otpExpiryTime: number = 0;
  private loginCooldownTimer: ReturnType<typeof setInterval> | null = null;
  private loginAvailableAt: number = 0;
  private resendCooldownTimer: ReturnType<typeof setInterval> | null = null;
  private resendAvailableAt: number = 0;
  private tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  // ===== Navigation =====
  private currentSlug = '';
  private currentTitle = '';
  private initialized = false;
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;

  // ===== UI Elements =====
  private styleEl: HTMLStyleElement | null = null;
  private rootEl: HTMLElement | null = null;
  private loaderEl: HTMLElement | null = null;
  private toastEl: HTMLElement | null = null;
  private fabEl: HTMLElement | null = null;
  private fabBtn: HTMLButtonElement | null = null;
  private badgeEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private editToggle: HTMLInputElement | null = null;
  private langSwitchEl: HTMLElement | null = null;
  private changesInfoEl: HTMLElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private historyBtnEl: HTMLButtonElement | null = null;
  private historyPanelEl: HTMLElement | null = null;
  private historyListEl: HTMLElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;
  private publishBtn: HTMLButtonElement | null = null;

  private actionsEl: HTMLElement | null = null;
  private editModeContent: HTMLElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private imgOverlay: HTMLElement | null = null;

  // ===== Edit-mode visibility tracking =====
  private editScrollHandler: (() => void) | null = null;
  private editScrollRAF: number | null = null;
  private editClickCaptureHandler: ((e: Event) => void) | null = null;

  // ===== FAB Drag =====
  private posX = 20;
  private posY = 20;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 0;
  private startPosY = 0;
  private hasMoved = false;

  // ===== Timers =====
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ===== License =====
  private licenseValid = false;
  private licenseStatus: LicenseStatus | null = null;
  private licenseOverlayEl: HTMLElement | null = null;
  private trialBannerDismissed = false;



  // ===== Bound handlers =====
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: () => void;
  private boundPopState: () => void;
  private boundHashChange: () => void;

  // ===== i18n cache =====
  private translationCache = new Map<string, string>();

  constructor(config?: EditInPlaceConfig) {
    this.config = config || {};
    // Only fill in the hosted API when the option was left out entirely. An
    // explicit empty string means "no backend": the editor then opens without
    // a licence check or a sign-in, and nothing can be saved. That is how the
    // demo page runs, and how anyone can work on the editor offline.
    if (this.config.apiBase === undefined) this.config.apiBase = DEFAULT_API_BASE;
    this.containerSelector = this.config.containerSelector || '';
    this.editableTags = (this.config.editableTags || DEFAULT_EDITABLE_TAGS).map(t => t.toLowerCase());
    this.languages = this.config.languages || ['en'];
    this.defaultLanguage = this.config.defaultLanguage || this.languages[0] || 'en';
    this.highlightColor = this.config.highlightColor || '#00C853';
    this.historyRetentionMs = (this.config.historyRetentionDays || 7) * 24 * 60 * 60 * 1000;
    this.currentLang = detectLanguage(this.languages, this.defaultLanguage);
    this.siteIdentifier = resolveSiteIdentifier();

    // Restore client API base from vault (saved during login)
    const savedClientApi = secureGet('editinplace_client_api');
    if (savedClientApi) this.config.clientApi = savedClientApi;

    // Load persisted theme color from localStorage
    // Falls back to the pre-rename key so a saved accent colour survives the upgrade
    const savedColor = localStorage.getItem('editinplace_theme_color')
      || localStorage.getItem('xtroedge_theme_color');
    if (savedColor) this.highlightColor = savedColor;

    // Bind handlers
    this.boundMouseMove = (e) => this.onDragMove(e);
    this.boundMouseUp = () => this.onDragEnd();
    this.boundTouchMove = (e) => this.onTouchMove(e);
    this.boundTouchEnd = () => this.onTouchEnd();
    this.boundPopState = () => this.handleNavigation();
    this.boundHashChange = () => this.handleNavigation();
  }

  // ===============================================
  // PUBLIC API
  // ===============================================

  async init(): Promise<void> {
    this.injectStyles();
    this.applyThemeColor(this.highlightColor);

    // Validate license (non-blocking — CMS always loads, only editing is gated)
    await this.validateLicense();

    this.posY = window.innerHeight - 72;
    this.buildUI();
    this.interceptNavigation();

    // MutationObserver for auto-scanning
    this.observer = new MutationObserver(() => {
      // Re-append CMS UI if removed by framework hydration (Next.js, React, etc.)
      if (this.rootEl && !document.contains(this.rootEl)) {
        document.body.appendChild(this.rootEl);
      }
      if (this.styleEl && !document.contains(this.styleEl)) {
        document.head.appendChild(this.styleEl);
      }
      if (this.scanTimeout) clearTimeout(this.scanTimeout);
      this.scanTimeout = setTimeout(() => {
        this.autoDetectAndScan();
        // Re-apply texts to any newly detected elements
        if (Object.keys(this.pageTexts).length > 0) {
          this.updateElementTexts();
        }
        // Re-evaluate pointer-events on positioned ancestors (e.g. dropdowns
        // that toggled from display:none → visible via class changes)
        if (this.editMode) {
          this.syncEditablePointerEvents();
        }
      }, 150);
    });
    this.observer.observe(document.body, EditInPlace.OBS_INIT);

    // Listen for navigation events
    window.addEventListener('popstate', this.boundPopState);
    window.addEventListener('hashchange', this.boundHashChange);

    // Initial navigation
    this.handleNavigation();
  }

  destroy(): void {
    this.cleanupManagedElements();

    // Remove UI
    this.styleEl?.remove();
    this.rootEl?.remove();
    this.licenseOverlayEl?.remove();

    // Remove listeners
    window.removeEventListener('popstate', this.boundPopState);
    window.removeEventListener('hashchange', this.boundHashChange);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);

    // Restore navigation
    if (this.origPushState) history.pushState = this.origPushState;
    if (this.origReplaceState) history.replaceState = this.origReplaceState;

    // Disconnect observer
    this.observer?.disconnect();
    if (this.scanTimeout) clearTimeout(this.scanTimeout);
    if (this.toastTimer) clearTimeout(this.toastTimer);

    closeHistoryDB();
  }

  // ===============================================
  // LICENSE VALIDATION
  // ===============================================

  /** Reads the licence, then mirrors it onto the instance for the UI to read. */
  private async validateLicense(): Promise<void> {
    this.licenseStatus = await fetchLicenseStatus(this.config);
    this.licenseValid = this.licenseStatus.valid;
  }

  /**
   * What the current plan unlocks. Server-side checks are the real gate; this
   * only decides which controls to render.
   */
  private get planFeatures(): PlanFeatures {
    return planFeatures(this.licenseStatus);
  }

  /** Shown when someone tries to edit with an expired or invalid licence. */
  private showLicenseExpiredToast(): void {
    this.showToast(licenseBlockedMessage(this.licenseStatus), 'error');
  }

  private getTrialBannerHTML(): string {
    return trialBannerHTML(this.licenseStatus, this.licenseValid, this.trialBannerDismissed);
  }

  // ===============================================
  // STYLES INJECTION
  // ===============================================

  private injectStyles(): void {
    if (document.getElementById('editinplace-styles')) return;
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'editinplace-styles';
    this.styleEl.textContent = CMS_STYLES;
    document.head.appendChild(this.styleEl);
  }

  // ===============================================
  // NAVIGATION INTERCEPTION
  // ===============================================

  /** If current URL has ?edit=true, carry it forward to the next navigation */
  private ensureEditParam(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    // Only carry forward if current page already has ?edit=true
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get('edit') !== 'true') return url;
    try {
      const u = new URL(url, window.location.origin);
      if (!u.searchParams.has('edit')) {
        u.searchParams.set('edit', 'true');
      }
      return u.pathname + u.search + u.hash;
    } catch { return url; }
  }

  private interceptNavigation(): void {
    this.origPushState = history.pushState.bind(history);
    this.origReplaceState = history.replaceState.bind(history);
    const self = this;
    history.pushState = function (...args) {
      if (typeof args[2] === 'string') {
        args[2] = self.ensureEditParam(args[2]) as string;
      }
      self.origPushState!(...args);
      setTimeout(() => self.handleNavigation(), 0);
    };
    history.replaceState = function (...args) {
      if (typeof args[2] === 'string') {
        args[2] = self.ensureEditParam(args[2]) as string;
      }
      self.origReplaceState!(...args);
      setTimeout(() => self.handleNavigation(), 0);
    };
  }

  private handleNavigation(): void {
    const url = window.location.href;
    const pathname = window.location.pathname || '/';
    const hash = window.location.hash || '';

    // Support hash routing: #/page?edit=true
    let path: string;
    let searchStr: string;
    if (hash.startsWith('#/') || hash.startsWith('#!')) {
      const hashPath = hash.replace(/^#[!/]*/, '');
      const qIdx = hashPath.indexOf('?');
      path = qIdx >= 0 ? hashPath.substring(0, qIdx) : hashPath;
      searchStr = qIdx >= 0 ? hashPath.substring(qIdx) : '';
    } else {
      path = pathname.replace(/^\//, '') || 'home';
      searchStr = window.location.search;
    }

    const slug = '/' + (path.replace(/^\//, '') || 'home');
    const params = new URLSearchParams(searchStr);
    const editViaParam = params.get('edit') === 'true';

    this.isEditAllowed = editViaParam || sessionStorage.getItem('builder_edit_mode') === 'true';

    const slugChanged = slug !== this.currentSlug;
    if (slugChanged) {
      this.cleanupManagedElements();
      this.currentSlug = slug;
      this.currentTitle = (path.replace(/^\//, '') || 'home').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Page';
      this.resetAll();
    }

    // Restore edit mode — check builder_token first
    const editFromSession = sessionStorage.getItem('builder_edit_mode') === 'true';
    const wantsEdit = editViaParam || editFromSession;

    if (wantsEdit) {
      const token = secureGet('builder_token');

      // With no apiBase there is no server to sign in against, so demanding a
      // sign-in would only produce a login box that can never succeed. This is
      // the local development case — the editor opens and nothing can be saved.
      // It cannot weaken a real install: every site that saves has an apiBase,
      // and the API re-checks the token on every request regardless.
      if (!token && !this.config.apiBase) {
        this.editMode = true;
        this.currentLang = detectLanguage(this.languages, this.defaultLanguage);
        this.loadTranslationsAndInit(false);
        return;
      }

      if (!token) {
        // No token → show login modal, do NOT enable edit mode yet
        if (!this.pendingEditMode) {
          this.pendingEditMode = true;
          this.currentLang = detectLanguage(this.languages, this.defaultLanguage);
          this.setLoading(true);
          setTimeout(() => {
            this.loadTranslationsAndInit(false);
            this.showLoginModal();
          }, 300);
        }
        return;
      }

      if (!this.startTokenExpiryWatcher(token)) {
        return;
      }

      // Block edit mode if license is not valid
      if (!this.licenseValid) {
        this.showLicenseExpiredToast();
        this.editMode = false;
      } else {
        this.editMode = true;
      }
    }

    // Skip reload if same slug and already initialized
    if (!slugChanged && this.initialized) {
      this.updateUI();
      return;
    }

    this.currentLang = detectLanguage(this.languages, this.defaultLanguage);

    // Show loader
    this.setLoading(true);

    // Auto-detect after DOM settles, then load content
    this.initialized = true;
    const loadDraft = wantsEdit;
    setTimeout(() => {
      this.loadTranslationsAndInit(loadDraft);
    }, 300);
  }

  // ===============================================
  // BUILD UI
  // ===============================================

  private buildUI(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'editinplace-root';

    // Loader
    this.loaderEl = createElement('div', 'lcms-loader-overlay lcms-hidden');
    this.loaderEl.innerHTML = `<div class="lcms-loader-content">
      <div class="lcms-orbit-loader">
        <div class="lcms-orbit lcms-orbit-1"><span class="lcms-particle"></span></div>
        <div class="lcms-orbit lcms-orbit-2"><span class="lcms-particle"></span></div>
        <div class="lcms-orbit lcms-orbit-3"><span class="lcms-particle"></span></div>
        <div class="lcms-core-glow"></div>
        <div class="lcms-core"></div>
      </div>
      <span class="lcms-loader-text">Loading</span>
    </div>`;
    this.rootEl.appendChild(this.loaderEl);

    // Toast
    this.toastEl = createElement('div', 'lcms-toast lcms-hidden');
    this.rootEl.appendChild(this.toastEl);

    // FAB
    this.fabEl = createElement('div', 'lcms-fab');
    this.fabEl.style.left = this.posX + 'px';
    this.fabEl.style.top = this.posY + 'px';
    this.fabEl.addEventListener('mousedown', (e) => this.onDragStart(e));
    this.fabEl.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });

    // FAB button
    this.fabBtn = document.createElement('button');
    this.fabBtn.className = 'lcms-fab-btn';
    this.fabBtn.innerHTML = ICON.edit;
    this.fabBtn.addEventListener('click', (e) => this.onFabClick(e));
    this.badgeEl = createElement('span', 'lcms-badge lcms-hidden');
    this.fabBtn.appendChild(this.badgeEl);
    this.fabEl.appendChild(this.fabBtn);

    // Panel
    this.panelEl = createElement('div', 'lcms-panel lcms-hidden');
    this.buildPanel();
    this.fabEl.appendChild(this.panelEl);

    this.rootEl.appendChild(this.fabEl);

    // Hidden file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => this.onImageFileSelected(e));
    this.rootEl.appendChild(this.fileInput);

    // Image upload overlay
    this.imgOverlay = createElement('div', 'lcms-img-upload-overlay lcms-hidden');
    this.imgOverlay.innerHTML = `<div class="lcms-img-upload-content"><div class="lcms-spinner-lg"></div><span>Uploading image...</span></div>`;
    this.rootEl.appendChild(this.imgOverlay);

    document.body.appendChild(this.rootEl);
  }

  private buildPanel(): void {
    if (!this.panelEl) return;

    // Header
    const header = createElement('div', 'lcms-panel-header');

    // Edit toggle
    const toggleLabel = createElement('label', 'lcms-toggle');
    toggleLabel.addEventListener('click', (e) => e.stopPropagation());
    this.editToggle = document.createElement('input');
    this.editToggle.type = 'checkbox';
    this.editToggle.checked = this.editMode;
    this.editToggle.addEventListener('change', (e) => this.toggleEditMode(e));
    const slider = createElement('span', 'lcms-toggle-slider');
    const labelText = createElement('span', 'lcms-toggle-label');
    labelText.textContent = 'Edit';
    toggleLabel.appendChild(this.editToggle);
    toggleLabel.appendChild(slider);
    toggleLabel.appendChild(labelText);
    header.appendChild(toggleLabel);

    // Language switch
    this.langSwitchEl = createElement('div', 'lcms-lang-switch lcms-hidden');
    this.buildLangButtons();
    header.appendChild(this.langSwitchEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'lcms-close-btn';
    closeBtn.innerHTML = ICON.close;
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.togglePanel(); });
    header.appendChild(closeBtn);

    this.panelEl.appendChild(header);

    // Site identifier
    this.siteIdEl = createElement('div', 'lcms-site-id');
    const isDomain = this.siteIdentifier.includes('.');
    this.siteIdEl.innerHTML = `<span class="lcms-site-id-icon">${isDomain ? '\u{1F310}' : '\u{1F511}'}</span><span class="lcms-site-id-text">${isDomain ? this.siteIdentifier : this.siteIdentifier.substring(0, 8)}</span>`;
    this.panelEl.appendChild(this.siteIdEl);

    // Trial banner (shown only during free trial)
    const trialHTML = this.getTrialBannerHTML();
    if (trialHTML) {
      const trialWrap = createElement('div', '');
      trialWrap.innerHTML = trialHTML;
      this.panelEl.appendChild(trialWrap);
      // Attach dismiss handler after DOM insertion
      setTimeout(() => {
        const dismissBtn = document.getElementById('lcms-trial-dismiss');
        dismissBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.trialBannerDismissed = true;
          const banner = document.getElementById('lcms-trial-banner');
          banner?.remove();
        });
      }, 0);
    }

    // Edit mode content (hidden when edit mode off)
    this.editModeContent = createElement('div', 'lcms-hidden');

    // Changes info
    this.changesInfoEl = createElement('div', 'lcms-changes-info lcms-hidden');
    this.editModeContent.appendChild(this.changesInfoEl);

    // Undo/Redo row
    const undoRow = createElement('div', 'lcms-undo-row');
    this.undoBtn = document.createElement('button');
    this.undoBtn.className = 'lcms-icon-btn';
    this.undoBtn.innerHTML = ICON.undo;
    this.undoBtn.disabled = true;
    this.undoBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onUndo(); });
    this.redoBtn = document.createElement('button');
    this.redoBtn.className = 'lcms-icon-btn';
    this.redoBtn.innerHTML = ICON.redo;
    this.redoBtn.disabled = true;
    this.redoBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onRedo(); });
    undoRow.appendChild(this.undoBtn);
    undoRow.appendChild(this.redoBtn);
    this.editModeContent.appendChild(undoRow);

    // Color theme picker
    const themeRow = createElement('div', 'lcms-theme-row');
    const themeLabel = createElement('span', 'lcms-theme-label');
    themeLabel.textContent = 'Theme';
    themeRow.appendChild(themeLabel);
    const themeColors = createElement('div', 'lcms-theme-colors');
    const presetColors = ['#00C853', '#6722FB', '#2196F3', '#FF5722', '#E91E63', '#FFD600'];
    for (const color of presetColors) {
      const swatch = createElement('div', 'lcms-theme-swatch');
      swatch.style.background = color;
      swatch.dataset.color = color;
      if (color === this.highlightColor) swatch.classList.add('active');
      swatch.addEventListener('click', (e) => { e.stopPropagation(); this.applyThemeColor(color); });
      themeColors.appendChild(swatch);
    }
    // Custom color input
    const customSwatch = createElement('div', 'lcms-theme-custom');
    const customPreview = createElement('div', 'lcms-theme-custom-preview');
    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.value = this.highlightColor;
    customInput.addEventListener('input', (e) => { e.stopPropagation(); this.applyThemeColor((e.target as HTMLInputElement).value); });
    customSwatch.appendChild(customPreview);
    customSwatch.appendChild(customInput);
    themeColors.appendChild(customSwatch);
    themeRow.appendChild(themeColors);
    this.editModeContent.appendChild(themeRow);

    // History button
    this.historyBtnEl = document.createElement('button');
    this.historyBtnEl.className = 'lcms-history-btn';
    this.historyBtnEl.innerHTML = `${ICON.history} History (7 days)`;
    this.historyBtnEl.addEventListener('click', (e) => { e.stopPropagation(); this.toggleHistory(); });
    this.editModeContent.appendChild(this.historyBtnEl);

    // History panel
    this.historyPanelEl = createElement('div', 'lcms-history-panel lcms-hidden');
    const historyTitle = createElement('div', 'lcms-history-title');
    historyTitle.textContent = 'Edit History';
    this.historyPanelEl.appendChild(historyTitle);
    this.historyListEl = createElement('div', 'lcms-history-list');
    this.historyPanelEl.appendChild(this.historyListEl);
    this.editModeContent.appendChild(this.historyPanelEl);

    // Actions
    this.actionsEl = createElement('div', 'lcms-actions');
    this.saveBtn = document.createElement('button');
    this.saveBtn.className = 'lcms-btn-save';
    this.saveBtn.innerHTML = `${ICON.save} Save Draft`;
    this.saveBtn.addEventListener('click', (e) => { e.stopPropagation(); this.saveChanges(); });
    this.publishBtn = document.createElement('button');
    this.publishBtn.className = 'lcms-btn-publish';
    this.publishBtn.innerHTML = `${ICON.publish} Publish`;
    this.publishBtn.addEventListener('click', (e) => { e.stopPropagation(); this.publishChanges(); });
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'lcms-btn-logout';
    logoutBtn.innerHTML = `${ICON.logout} Logout`;
    logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); this.logout(); });
    this.actionsEl.appendChild(this.saveBtn);
    this.actionsEl.appendChild(this.publishBtn);
    this.actionsEl.appendChild(logoutBtn);
    this.editModeContent.appendChild(this.actionsEl);

    this.panelEl.appendChild(this.editModeContent);

    // Branding
    this.brandingEl = createElement('div', 'lcms-branding');
    this.brandingEl.innerHTML = `<div class="lcms-branding-logo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><div class="lcms-branding-text">Powered by <span>EditInPlace</span></div>`;
    this.brandingEl.addEventListener('click', (e) => { e.stopPropagation(); window.open('https://xtroedge.com/', '_blank'); });
    this.panelEl.appendChild(this.brandingEl);
  }

  private buildLangButtons(): void {
    if (!this.langSwitchEl) return;
    this.langSwitchEl.innerHTML = '';
    const select = document.createElement('select');
    select.className = 'lcms-lang-select';
    for (const lang of this.languages) {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = lang.toUpperCase();
      if (lang === this.currentLang) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', (e) => { e.stopPropagation(); this.switchLang((e.target as HTMLSelectElement).value); });
    this.langSwitchEl.appendChild(select);
    const arrow = document.createElement('span');
    arrow.className = 'lcms-lang-arrow';
    arrow.textContent = '\u25BC';
    this.langSwitchEl.appendChild(arrow);
  }

  // ===============================================
  // UI UPDATE
  // ===============================================

  private updateUI(): void {
    // FAB visibility
    if (this.fabEl) {
      this.fabEl.style.display = this.isEditAllowed ? '' : 'none';
    }

    // FAB button vs panel
    if (this.fabBtn) {
      this.fabBtn.style.display = this.isOpen ? 'none' : '';
      this.fabBtn.classList.toggle('lcms-fab-active', this.editMode);
    }
    if (this.panelEl) {
      this.panelEl.classList.toggle('lcms-hidden', !this.isOpen);
      // Position panel
      if (this.isOpen) {
        const openUp = this.posY > window.innerHeight / 2;
        const openLeft = this.posX > window.innerWidth / 2;
        this.panelEl.style.bottom = openUp ? '0' : '';
        this.panelEl.style.top = openUp ? '' : '0';
        this.panelEl.style.right = openLeft ? '0' : '';
        this.panelEl.style.left = openLeft ? '' : '0';
      }
    }

    // Badge
    if (this.badgeEl) {
      this.badgeEl.classList.toggle('lcms-hidden', this.unsavedChanges === 0);
      this.badgeEl.textContent = String(this.unsavedChanges);
    }

    // Edit toggle
    if (this.editToggle) this.editToggle.checked = this.editMode;

    // Lang switch
    if (this.langSwitchEl) {
      this.langSwitchEl.classList.toggle('lcms-hidden', !this.editMode || this.languages.length <= 1);
      const sel = this.langSwitchEl.querySelector('.lcms-lang-select') as HTMLSelectElement | null;
      if (sel) sel.value = this.currentLang;
    }

    // Edit mode content
    if (this.editModeContent) {
      this.editModeContent.classList.toggle('lcms-hidden', !this.editMode);
    }

    // Changes info
    if (this.changesInfoEl) {
      this.changesInfoEl.classList.toggle('lcms-hidden', this.unsavedChanges === 0);
      this.changesInfoEl.textContent = `${this.unsavedChanges} unsaved change${this.unsavedChanges > 1 ? 's' : ''}`;
    }

    // Undo/Redo
    if (this.undoBtn) this.undoBtn.disabled = !this.canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !this.canRedo;

    // History button
    if (this.historyBtnEl) this.historyBtnEl.classList.toggle('active', this.showHistory);
    if (this.historyPanelEl) this.historyPanelEl.classList.toggle('lcms-hidden', !this.showHistory);

    // Save/Publish buttons
    if (this.saveBtn) {
      this.saveBtn.disabled = this.isSaving || this.isPublishing || this.unsavedChanges === 0;
      this.saveBtn.innerHTML = this.isSaving ? '<span class="lcms-spinner"></span> Saving...' : `${ICON.save} Save Draft`;
    }
    if (this.publishBtn) {
      this.publishBtn.disabled = this.isSaving || this.isPublishing;
      this.publishBtn.innerHTML = this.isPublishing ? '<span class="lcms-spinner"></span> Publishing...' : `${ICON.publish} Publish`;
    }

    // Loader
    if (this.loaderEl) this.loaderEl.classList.toggle('lcms-hidden', !this.loading);

    // Image overlay
    if (this.imgOverlay) this.imgOverlay.classList.toggle('lcms-hidden', !this.imageUploading);
  }

  // ===============================================
  // DOM SCANNING
  // ===============================================

  private autoDetectAndScan(): void {
    this.autoDetectElements();
    this.scanDOM();
    this.scanImages();
  }

  private resolveContainer(): Element {
    if (this.containerSelector) {
      return document.querySelector(this.containerSelector) || document.body;
    }
    return document.body;
  }

  private autoDetectElements(): void {
    const container = this.resolveContainer();
    if (!container) return;

    // Clean up stale auto-detected elements
    for (const el of this.autoDetectedElements) {
      if (!document.contains(el)) this.autoDetectedElements.delete(el);
    }

    // Detect section slug based on ancestor tag name
    // Only custom component tags ending with '-header'/'-footer' (e.g. <app-header>, <app-footer>)
    // get separate section slugs. Native HTML <header>/<footer> tags are treated as page content.
    const getSectionSlug = (el: HTMLElement): string => {
      let parent: HTMLElement | null = el.parentElement;
      while (parent && parent !== document.body) {
        const tag = parent.tagName.toLowerCase();
        if (tag.endsWith('-header')) return '/header';
        if (tag.endsWith('-footer')) return '/footer';
        parent = parent.parentElement;
      }
      return this.currentSlug;
    };

    // Section-aware tag counters to avoid key collisions across sections
    const tagCounters: { [section: string]: { [tag: string]: number } } = {};

    const hasCmsKey = (candidate: string) => {
      return Array.from(document.querySelectorAll<HTMLElement>('[data-cms]'))
        .some(node => node.getAttribute('data-cms') === candidate);
    };

    const assignKey = (el: HTMLElement, sectionSlug: string) => {
      const sectionKey = sectionSlug === '/header' ? 'header'
                       : sectionSlug === '/footer' ? 'footer' : 'page';
      if (!tagCounters[sectionKey]) tagCounters[sectionKey] = {};
      const tag = el.tagName.toLowerCase();
      if (!tagCounters[sectionKey][tag]) tagCounters[sectionKey][tag] = 0;
      const prefix = sectionKey !== 'page' ? `${sectionKey}_` : '';
      let key = `${prefix}xcms_${tag}_${tagCounters[sectionKey][tag]}`;
      while (hasCmsKey(key)) {
        tagCounters[sectionKey][tag]++;
        key = `${prefix}xcms_${tag}_${tagCounters[sectionKey][tag]}`;
      }
      tagCounters[sectionKey][tag]++;
      el.setAttribute('data-cms', key);
      el.setAttribute('data-cms-section', sectionSlug); // used during save/load
      this.autoDetectedElements.add(el);
    };

    // Inline formatting tags created by rich text (execCommand) — never auto-scan these
    const RICH_TEXT_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUB', 'SUP', 'MARK']);

    // Scan standard editable tags (h1, p, div, etc.)
    const selector = this.editableTags.join(',');
    const elements = container.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => {
      if (el.hasAttribute('data-cms')) return;
      if (el.closest('#editinplace-root, #lcms-login-modal, script, style, noscript')) return;
      // Skip inline formatting tags inside elements already managed by CMS
      if (RICH_TEXT_INLINE.has(el.tagName) && el.parentElement?.closest('[data-cms]')) return;
      if (el.children.length > 3) return;
      const text = this.getDirectTextContent(el).trim();
      if (text.length < 2) return;
      assignKey(el, getSectionSlug(el));
    });

    // Scan [data-editable] elements — works with ANY tag (app-header, app-footer, custom components)
    // No children/text restrictions since user explicitly marked them
    const dataEditables = container.querySelectorAll<HTMLElement>('[data-editable]');
    dataEditables.forEach(el => {
      if (el.hasAttribute('data-cms')) return;
      if (el.closest('#editinplace-root, #lcms-login-modal, script, style, noscript')) return;
      assignKey(el, getSectionSlug(el));
    });
  }

  private scanDOM(): void {
    const elements = document.querySelectorAll<HTMLElement>('[data-cms]');
    const seenKeys = new Set<string>();
    elements.forEach(el => {
      if (el.closest('#editinplace-root, #lcms-login-modal')) return;
      let key = el.getAttribute('data-cms')!;
      if (seenKeys.has(key)) {
        let idx = 1;
        let repaired = `${key}__${idx}`;
        while (document.querySelector(`[data-cms="${repaired}"]`)) {
          idx++;
          repaired = `${key}__${idx}`;
        }
        el.setAttribute('data-cms', repaired);
        key = repaired;
      }
      seenKeys.add(key);
      this.registeredKeys.add(key);
      if (!this.managedElements.has(el)) {
        this.attachElement(el, key);
      }
    });
    // Cleanup removed elements
    for (const [el] of this.managedElements) {
      if (!document.contains(el)) this.detachElement(el);
    }
  }

  private scanImages(): void {
    const container = this.resolveContainer();
    if (!container) return;
    const currentImages = { ...this.pageImages };
    let hasNew = false;
    const images = container.querySelectorAll<HTMLImageElement>('img');
    images.forEach(img => {
      if (img.closest('#editinplace-root')) return;
      if (this.managedImages.has(img)) return;
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      this.attachImage(img, src);
      if (!currentImages[src]) {
        currentImages[src] = src;
        hasNew = true;
      }
    });
    if (hasNew) {
      this.pageImages = currentImages;
      this.originalImages = JSON.parse(JSON.stringify(currentImages));
    }
    for (const [img] of this.managedImages) {
      if (!document.contains(img)) this.detachImage(img);
    }
  }

  private getDirectTextContent(el: HTMLElement): string {
    let text = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
        text += el.childNodes[i].textContent || '';
      }
    }
    return text;
  }

  private hasEditableChildren(el: HTMLElement): boolean {
    return !!el.querySelector('[data-cms]');
  }

  private getElementContent(el: HTMLElement): string {
    if (this.richTextEnabled) return el.innerHTML?.trim() || '';
    if (this.hasEditableChildren(el)) return this.getDirectTextContent(el).trim();
    return el.textContent?.trim() || '';
  }

  private setElementContent(el: HTMLElement, val: string): void {
    if (this.richTextEnabled) {
      el.innerHTML = this.sanitizeHTML(val);
    } else if (this.hasEditableChildren(el)) {
      const textNodes: Text[] = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === Node.TEXT_NODE) textNodes.push(el.childNodes[i] as Text);
      }
      if (textNodes.length > 0) textNodes[0].textContent = val;
      else el.prepend(document.createTextNode(val));
    } else {
      el.textContent = val;
    }
  }

  // Legacy alias for backward compat with internal calls
  private setDirectTextContent(el: HTMLElement, val: string): void {
    this.setElementContent(el, val);
  }

  // ===============================================
  // ELEMENT EDITING
  // ===============================================

  private attachElement(el: HTMLElement, key: string): void {
    const getContent = () => this.getElementContent(el);
    const blurHandler = () => {
      const text = getContent();
      const currentVal = this.getPageText(key);
      if (text !== currentVal) this.onTextChanged(key, text);
      this.hideRichToolbar();
    };
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Allow Enter for multi-line elements when rich text is enabled
        if (this.richTextEnabled && !EditInPlace.SINGLE_LINE_TAGS.has(el.tagName)) {
          return; // Allow default Enter behavior (line break)
        }
        e.preventDefault();
        el.blur();
      }
    };
    const inputHandler = () => {
      const text = getContent();
      const currentVal = this.getPageText(key);
      if (text !== currentVal) this.onTextChanged(key, text);
    };
    const focusEditableEnd = () => {
      if (document.activeElement !== el) el.focus();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    // In edit mode: stop propagation to prevent dropdown close.
    // If editable is inside an anchor, block navigation.
    const clickHandler = (e: Event) => {
      e.stopPropagation();
      const inAnchor = el.tagName === 'A' || !!(e.target as HTMLElement).closest('a');
      if (inAnchor) {
        e.preventDefault();
        // Don't call focusEditableEnd() - let browser handle cursor positioning naturally
        // Element will focus automatically, and cursor will be placed where user clicked
      }
    };
    const sectionSlug = el.getAttribute('data-cms-section') || this.currentSlug;
    this.managedElements.set(el, { key, sectionSlug, blurHandler, keydownHandler, inputHandler, clickHandler });
    if (this.editMode) this.enableElementEdit(el, key, blurHandler, keydownHandler, inputHandler, clickHandler);
  }

  private detachElement(el: HTMLElement): void {
    const info = this.managedElements.get(el);
    if (info) {
      el.removeEventListener('blur', info.blurHandler);
      el.removeEventListener('keydown', info.keydownHandler as EventListener);
      el.removeEventListener('input', info.inputHandler);
      el.removeEventListener('click', info.clickHandler, true);
      el.removeAttribute('contenteditable');
      this.managedElements.delete(el);
    }
  }

  /** Stop propagation so parent carousels (Swiper, Owl, etc.) don't hijack the event */
  private static stopProp(e: Event): void { e.stopPropagation(); }

  private focusEditableEnd(el: HTMLElement): void {
    if (document.activeElement !== el) el.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private enableElementEdit(el: HTMLElement, _key: string, blurH: (e: Event) => void, keyH: (e: KeyboardEvent) => void, inputH: (e: Event) => void, clickH: (e: Event) => void): void {
    const val = this.getPageText(_key);
    // Only set content if element is NOT currently focused (preserve cursor position)
    if (val && document.activeElement !== el) {
      this.setElementContent(el, val);
    }
    el.setAttribute('contenteditable', 'true');
    el.style.setProperty('outline', `2px dashed ${this.highlightColor}`, 'important');
    el.style.setProperty('outline-offset', '-2px', 'important');
    el.style.cursor = 'text';
    el.style.transition = 'background 0.2s';
    el.style.minWidth = '20px';

    // COMMENTED OUT: Double-click to show floating edit dialog
    // const dblClickHandler = (e: Event) => {
    //   e.preventDefault();
    //   e.stopPropagation();
    //   this.showFloatingEditDialog(el, _key);
    // };
    // el.addEventListener('dblclick', dblClickHandler);
    // el.dataset.cmsDblClickAdded = 'true';

    el.addEventListener('blur', blurH);
    el.addEventListener('keydown', keyH as EventListener);
    el.addEventListener('input', inputH);
    el.addEventListener('click', clickH, true);
    // Prevent parent carousels/sliders from capturing pointer events on editable elements
    el.addEventListener('mousedown', EditInPlace.stopProp, true);
    el.addEventListener('touchstart', EditInPlace.stopProp, true);
    // Show rich text toolbar on focus
    el.addEventListener('focus', () => this.showRichToolbar(el));
  }

  private disableElementEdit(el: HTMLElement, _key: string, blurH: (e: Event) => void, keyH: (e: KeyboardEvent) => void, inputH: (e: Event) => void, clickH: (e: Event) => void): void {
    el.removeAttribute('contenteditable');
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.cursor = '';
    el.style.transition = '';
    el.style.minWidth = '';
    const val = this.getPageText(_key);
    if (val) this.setElementContent(el, val);
    el.removeEventListener('blur', blurH);
    el.removeEventListener('keydown', keyH as EventListener);
    el.removeEventListener('input', inputH);
    el.removeEventListener('click', clickH, true);
    el.removeEventListener('mousedown', EditInPlace.stopProp, true);
    el.removeEventListener('touchstart', EditInPlace.stopProp, true);
  }

  private applyEditMode(editMode: boolean): void {
    // Add/remove body class for edit-mode CSS overrides
    document.body.classList.toggle('lcms-editing', editMode);

    if (editMode) {
      // Document-level capture handler: stop pointer/click propagation on CMS-managed targets
      // so dropdowns, modals, etc. stay open while user edits content.
      this.editClickCaptureHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const editable = target.closest('[contenteditable="true"]') as HTMLElement | null;
        const imageTarget = target.closest('[data-cms-image-key], img[data-cms-key], [data-cms-key]') as HTMLElement | null;
        const isManagedEditable = !!editable && this.managedElements.has(editable);
        const isManagedImage = !!imageTarget && this.managedImages.has(imageTarget as HTMLImageElement);
        const isManagedTarget = isManagedEditable || isManagedImage || !!editable || !!imageTarget;

        if (isManagedTarget) {
          e.stopPropagation();
          // Only preventDefault on 'click' to block anchor navigation.
          // NOT on mousedown/pointerdown/touchstart — those need default
          // behavior so the browser sets focus and places the cursor.
          if (e.type === 'click') {
            const anchor = target.closest('a');
            if (anchor) e.preventDefault();
          }
        } else if (e.type === 'click') {
          // In edit mode, block navigation on ALL page anchors (not CMS UI).
          // This covers wrapper <a> tags around editable elements (e.g. mega-menu
          // cards with routerLink wrapping an editable <p>).
          const anchor = target.closest('a') as HTMLAnchorElement | null;
          if (anchor && !anchor.closest('#editinplace-root, #lcms-login-modal')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      };
      document.addEventListener('click', this.editClickCaptureHandler, true);
      document.addEventListener('mousedown', this.editClickCaptureHandler, true);
      document.addEventListener('pointerdown', this.editClickCaptureHandler, true);
      document.addEventListener('touchstart', this.editClickCaptureHandler, true);

      // Track scroll to toggle pointer-events on visible/hidden animated elements
      this.editScrollHandler = () => {
        if (this.editScrollRAF) return;
        this.editScrollRAF = requestAnimationFrame(() => {
          this.syncEditablePointerEvents();
          this.editScrollRAF = null;
        });
      };
      window.addEventListener('scroll', this.editScrollHandler, { passive: true });
      this.syncEditablePointerEvents();
    } else {
      // Clean up document-level capture handler
      if (this.editClickCaptureHandler) {
        document.removeEventListener('click', this.editClickCaptureHandler, true);
        document.removeEventListener('mousedown', this.editClickCaptureHandler, true);
        document.removeEventListener('pointerdown', this.editClickCaptureHandler, true);
        document.removeEventListener('touchstart', this.editClickCaptureHandler, true);
        this.editClickCaptureHandler = null;
      }
      // Clean up scroll listener
      if (this.editScrollHandler) {
        window.removeEventListener('scroll', this.editScrollHandler);
        this.editScrollHandler = null;
      }
      if (this.editScrollRAF) { cancelAnimationFrame(this.editScrollRAF); this.editScrollRAF = null; }
      // Restore pointer-events on all elements we modified
      for (const [el] of this.managedElements) el.style.pointerEvents = '';
      this.modifiedAncestors.forEach(a => { a.style.pointerEvents = ''; });
      this.modifiedAncestors.clear();
    }

    for (const [el, info] of this.managedElements) {
      if (editMode) this.enableElementEdit(el, info.key, info.blurHandler, info.keydownHandler, info.inputHandler, info.clickHandler);
      else this.disableElementEdit(el, info.key, info.blurHandler, info.keydownHandler, info.inputHandler, info.clickHandler);
    }
    this.applyImageEditMode(editMode);
    // Rich text toolbar lifecycle
    if (editMode) this.createRichToolbar();
    else this.destroyRichToolbar();
  }

  /** Set of positioned ancestors we added pointer-events:none to (for cleanup) */
  private modifiedAncestors = new Set<HTMLElement>();

  /**
   * For each managed element, find the nearest position:absolute/fixed ancestor.
   * If that ancestor is invisible (opacity ≈ 0), set pointer-events:none on it
   * so clicks pass through to the visible element behind it.
   */
  private syncEditablePointerEvents(): void {
    const checked = new Map<HTMLElement, boolean>();

    for (const [el] of this.managedElements) {
      const ancestor = this.findPositionedAncestor(el);
      if (!ancestor) continue;

      // Only compute once per ancestor
      if (!checked.has(ancestor)) {
        const cs = window.getComputedStyle(ancestor);
        const visible = parseFloat(cs.opacity) >= 0.15
          && cs.visibility !== 'hidden'
          && cs.display !== 'none';
        checked.set(ancestor, visible);

        if (!visible) {
          ancestor.style.pointerEvents = 'none';
          this.modifiedAncestors.add(ancestor);
        } else {
          if (this.modifiedAncestors.has(ancestor)) {
            ancestor.style.pointerEvents = '';
            this.modifiedAncestors.delete(ancestor);
          }
        }
      }
    }
  }

  /** Walk up from el to find the nearest position:absolute or position:fixed ancestor */
  private findPositionedAncestor(el: HTMLElement): HTMLElement | null {
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      if (cur.closest('#editinplace-root')) return null;
      const pos = window.getComputedStyle(cur).position;
      if (pos === 'absolute' || pos === 'fixed') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  private killAnimations(): void {
    const win = window as any;

    // Kill GSAP ScrollTrigger (CDN or global version)
    if (win.ScrollTrigger) {
      try { win.ScrollTrigger.getAll().forEach((t: any) => t.kill(true)); } catch { /* ignore */ }
    }
    // Kill all GSAP tweens
    if (win.gsap) {
      try {
        win.gsap.globalTimeline.clear();
        win.gsap.killTweensOf('*');
      } catch { /* ignore */ }
    }
    // Disable AOS
    if (win.AOS) {
      try { win.AOS.refreshHard?.(); } catch { /* ignore */ }
    }

    // Remove GSAP pin-spacer wrappers
    this.removePinSpacers();

    // Clear GSAP-set inline styles from elements (one-time cleanup)
    this.clearAnimationInlineStyles();

    // Re-run after delay for late-initialized animations
    setTimeout(() => { this.removePinSpacers(); this.clearAnimationInlineStyles(); }, 500);
    setTimeout(() => { this.removePinSpacers(); this.clearAnimationInlineStyles(); }, 1500);
  }

  /** Remove GSAP ScrollTrigger pin-spacer wrapper divs and restore original elements */
  private removePinSpacers(): void {
    document.querySelectorAll('.pin-spacer').forEach(spacer => {
      const child = spacer.firstElementChild as HTMLElement;
      if (child) {
        spacer.parentNode?.insertBefore(child, spacer);
        child.style.cssText = '';
      }
      spacer.remove();
    });
  }

  /** Clear only animation-related inline styles (set by GSAP/ScrollTrigger) without breaking layout */
  private clearAnimationInlineStyles(): void {
    const container = this.containerSelector
      ? document.querySelector(this.containerSelector) || document.body
      : document.body;
    container.querySelectorAll<HTMLElement>('*').forEach(el => {
      if (el.closest('#editinplace-root')) return;
      const s = el.style;
      // Only clear properties that GSAP typically sets for animations
      if (s.pointerEvents === 'none') s.pointerEvents = '';
      if (s.userSelect === 'none') s.userSelect = '';
      if (s.visibility === 'hidden') s.visibility = '';
      if (s.clipPath && s.clipPath !== 'none') s.clipPath = '';
    });
  }

  /** Capture each element's current DOM text before CMS applies saved edits */
  private captureDomOriginals(): void {
    this.domOriginals = {};
    for (const [el, info] of this.managedElements) {
      this.domOriginals[info.key] = this.getElementContent(el);
    }
  }

  /** Ensure every entry in pageTexts has _orig for current language (from domOriginals) */
  private ensureOriginals(): void {
    const origKey = `_orig_${this.currentLang}`;
    for (const key of Object.keys(this.pageTexts)) {
      if (!this.pageTexts[key][origKey] && this.domOriginals[key]) {
        this.pageTexts[key][origKey] = this.domOriginals[key];
      }
    }
  }

  /** Find a managed element whose current text matches the given original text */
  private findElementByOriginal(originalText: string, tagName: string): HTMLElement | null {
    for (const [el] of this.managedElements) {
      if (el.tagName !== tagName) continue;
      const current = this.getElementContent(el);
      if (current === originalText) return el;
    }
    return null;
  }

  private updateElementTexts(): void {
    this.observer?.disconnect();
    let orphanedCount = 0;

    for (const [el, info] of this.managedElements) {
      if (document.activeElement === el) continue;
      const entry = this.pageTexts[info.key];
      if (!entry) continue;

      const val = entry[this.currentLang];
      if (!val) continue;

      const orig = entry[`_orig_${this.currentLang}`];

      // No original stored (old data) → apply directly (backward compat)
      if (!orig) {
        const current = this.getElementContent(el);
        if (val !== current) this.setElementContent(el, val);
        continue;
      }

      // Verify: does this element's DOM text match the saved original?
      const domText = this.domOriginals[info.key] || this.getElementContent(el);
      if (domText === orig) {
        // Match → apply
        if (val !== this.getElementContent(el)) this.setElementContent(el, val);
      } else {
        // Mismatch → structure may have changed
        // findElementByOriginal disabled: same text can appear multiple times on page
        // const found = this.findElementByOriginal(orig, el.tagName);
        // if (found) {
        //   this.setElementContent(found, val);
        // } else {
        //   orphanedCount++;
        // }
        orphanedCount++;
      }
    }

    // if (orphanedCount > 0) {
    //   this.showToast(`${orphanedCount} edit(s) couldn't be matched to elements`, 'error');
    // }

    this.observer?.observe(document.body, EditInPlace.OBS_INIT);
  }

  private cleanupManagedElements(): void {
    for (const [el] of this.managedElements) this.detachElement(el);
    this.managedElements.clear();
    for (const el of this.autoDetectedElements) el.removeAttribute('data-cms');
    this.autoDetectedElements.clear();
    this.domOriginals = {};
    this.cleanupManagedImages();
  }

  // ===============================================
  // IMAGE MANAGEMENT
  // ===============================================

  private attachImage(img: HTMLImageElement, key: string): void {
    const ctxHandler = (e: MouseEvent) => {
      if (!this.editMode) return;
      e.preventDefault();
      e.stopPropagation();
      this.showImageContextMenu(e.clientX, e.clientY, img);
    };
    this.managedImages.set(img, { key, ctxHandler });
    if (this.editMode) this.enableImageEdit(img, ctxHandler);
  }

  private detachImage(img: HTMLImageElement): void {
    const info = this.managedImages.get(img);
    if (info) {
      img.removeEventListener('contextmenu', info.ctxHandler);
      img.style.removeProperty('outline');
      img.style.cursor = '';
      this.managedImages.delete(img);
    }
  }

  private cleanupManagedImages(): void {
    for (const [img] of this.managedImages) this.detachImage(img);
    this.managedImages.clear();
    this.dismissImageCtxMenu();
  }

  private applyImageEditMode(editMode: boolean): void {
    for (const [img, info] of this.managedImages) {
      if (editMode) this.enableImageEdit(img, info.ctxHandler);
      else this.disableImageEdit(img, info.ctxHandler);
    }
    if (!editMode) {
      this.dismissImageCtxMenu();
      this.dismissFloatingEditDialog();
    }
  }

  private enableImageEdit(img: HTMLImageElement, ctxHandler: (e: MouseEvent) => void): void {
    // Plans without image editing get no outline and no context menu, so the
    // capability is simply absent rather than failing on use.
    if (!this.planFeatures.images) return;

    if (!img.dataset.origTitle) img.dataset.origTitle = img.title || '';
    img.title = 'Right-click to change image';
    img.style.setProperty('outline', `2px dashed ${this.highlightColor}`, 'important');
    img.style.cursor = 'context-menu';
    img.addEventListener('contextmenu', ctxHandler);
  }

  private disableImageEdit(img: HTMLImageElement, ctxHandler: (e: MouseEvent) => void): void {
    img.title = img.dataset.origTitle || '';
    delete img.dataset.origTitle;
    img.style.removeProperty('outline');
    img.style.cursor = '';
    img.removeEventListener('contextmenu', ctxHandler);
  }

  private showImageContextMenu(x: number, y: number, img: HTMLImageElement): void {
    this.dismissImageCtxMenu();
    const menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'fixed', zIndex: '10005', minWidth: '160px',
      background: 'rgba(30,15,60,0.85)', backdropFilter: 'blur(16px)', webkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '4px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontFamily: 'system-ui, -apple-system, sans-serif',
      left: Math.min(x, window.innerWidth - 180) + 'px',
      top: Math.min(y, window.innerHeight - 50) + 'px',
    });
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      width: '100%', padding: '8px 12px', border: 'none', borderRadius: '7px',
      background: 'transparent', color: 'white', fontSize: '12px', fontWeight: '500',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
    });
    btn.innerHTML = `${ICON.image} Upload Image`;
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(103,34,251,0.3)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    btn.addEventListener('click', () => {
      this.activeImageEl = img;
      if (this.fileInput) { this.fileInput.value = ''; this.fileInput.click(); }
      this.dismissImageCtxMenu();
    });
    menu.appendChild(btn);
    (this.rootEl || document.body).appendChild(menu);
    this.imageCtxMenu = menu;

    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.dismissImageCtxMenu();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  private dismissImageCtxMenu(): void {
    if (this.imageCtxMenu) {
      this.imageCtxMenu.remove();
      this.imageCtxMenu = null;
    }
  }

  private showFloatingEditDialog(el: HTMLElement, key: string): void {
    this.dismissFloatingEditDialog();

    const currentText = el.textContent || '';
    const rect = el.getBoundingClientRect();

    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      position: 'fixed',
      zIndex: '99999',
      left: `${Math.max(20, rect.left)}px`,
      top: `${Math.max(20, rect.top - 120)}px`,
      background: 'rgba(15, 10, 40, 0.95)',
      backdropFilter: 'blur(20px)',
      webkitBackdropFilter: 'blur(20px)',
      border: '2px solid rgba(139, 92, 246, 0.5)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)',
      minWidth: '320px',
      maxWidth: '500px',
    });

    const title = document.createElement('div');
    title.textContent = 'Edit Text';
    Object.assign(title.style, {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '13px',
      fontWeight: '600',
      marginBottom: '12px',
      fontFamily: 'system-ui, sans-serif',
    });

    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    Object.assign(textarea.style, {
      width: '100%',
      minHeight: '80px',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '8px',
      color: 'white',
      padding: '10px',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      resize: 'vertical',
      outline: 'none',
    });
    textarea.addEventListener('focus', () => {
      textarea.style.borderColor = this.highlightColor;
    });
    textarea.addEventListener('blur', () => {
      textarea.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    });

    const buttons = document.createElement('div');
    Object.assign(buttons.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '12px',
      justifyContent: 'flex-end',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '8px 16px',
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '6px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      fontFamily: 'system-ui, sans-serif',
    });
    cancelBtn.addEventListener('click', () => this.dismissFloatingEditDialog());
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    Object.assign(saveBtn.style, {
      padding: '8px 16px',
      background: this.highlightColor,
      border: 'none',
      borderRadius: '6px',
      color: 'white',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      fontFamily: 'system-ui, sans-serif',
    });
    saveBtn.addEventListener('click', () => {
      const newText = textarea.value;
      this.setElementContent(el, newText);
      this.onTextChanged(key, newText);
      this.dismissFloatingEditDialog();
    });
    saveBtn.addEventListener('mouseenter', () => saveBtn.style.opacity = '0.9');
    saveBtn.addEventListener('mouseleave', () => saveBtn.style.opacity = '1');

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);

    dialog.appendChild(title);
    dialog.appendChild(textarea);
    dialog.appendChild(buttons);

    (this.rootEl || document.body).appendChild(dialog);
    this.floatingEditDialog = dialog;

    textarea.focus();
    textarea.select();

    const closeHandler = (e: MouseEvent) => {
      if (!dialog.contains(e.target as Node)) {
        this.dismissFloatingEditDialog();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  private dismissFloatingEditDialog(): void {
    if (this.floatingEditDialog) {
      this.floatingEditDialog.remove();
      this.floatingEditDialog = null;
    }
  }

  private onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.activeImageEl) return;

    this.imageUploading = true;
    this.updateUI();

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.uploadImageToApi(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  private async uploadImageToApi(dataUrl: string): Promise<void> {
    if (!this.planFeatures.images) {
      this.imageUploading = false;
      this.activeImageEl = null;
      this.updateUI();
      this.showToast('Image editing is a Pro feature. Upgrade to replace images.', 'error');
      return;
    }

    try {
      // If image_url is set (from company detail), resolve it; otherwise use default
      const storedImageUrl = secureGet('editinplace_image_url');
      const clientBase = this.config.clientApi || this.config.apiBase;
      const uploadUrl = storedImageUrl ? resolveClientUrl(storedImageUrl, this.config.clientApi || this.config.apiBase) : `${clientBase}/web/upload-image`;

      const res = await this.apiFetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dataUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Use apiBase origin as base for the returned image path
      const imgOriginBase = this.config.clientApi || this.config.apiBase || '';
      const baseUrl = this.config.imageBaseUrl || (imgOriginBase ? new URL(imgOriginBase).origin : '');
      const fullUrl = baseUrl + data.path;
      if (this.activeImageEl) {
        const key = this.managedImages.get(this.activeImageEl)?.key || '';
        const imgEl = this.activeImageEl;

        // Wait for image to actually load before hiding loader
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => reject(new Error('Image failed to load'));
          imgEl.src = fullUrl;
        });

        this.onImageChanged(key, fullUrl);
      }
      this.imageUploading = false;
      this.activeImageEl = null;
      this.updateUI();
      this.showToast('Image updated!', 'success');
    } catch (err) {
      this.imageUploading = false;
      this.activeImageEl = null;
      this.updateUI();
      this.showToast('Image upload failed.', 'error');
      this.config.onError?.('upload-image', err);
    }
  }

  private applyPageImages(): void {
    for (const [img, info] of this.managedImages) {
      const url = this.pageImages[info.key];
      if (url && img.src !== url) img.src = url;
    }
  }

  // ===============================================
  // TEXT STATE
  // ===============================================

  private getPageText(key: string): string {
    return this.pageTexts[key]?.[this.currentLang] || '';
  }

  private onTextChanged(key: string, newValue: string): void {
    this.undoStack.push(this.createSnapshot());
    this.redoStack = [];
    this.canUndo = true;
    this.canRedo = false;

    if (!this.pageTexts[key]) this.pageTexts[key] = {};
    // Store original DOM text on first edit (for structure-change resilience)
    const origKey = `_orig_${this.currentLang}`;
    if (!this.pageTexts[key][origKey]) {
      this.pageTexts[key][origKey] = this.domOriginals[key] || '';
    }
    this.pageTexts[key] = { ...this.pageTexts[key], [this.currentLang]: newValue };
    this.dirtyKeys.add(key);
    this.unsavedChanges = this.dirtyKeys.size + this.dirtyImageKeys.size;
    this.pushHistory(key, this.currentLang);
    this.updateUI();
  }

  private onImageChanged(key: string, url: string): void {
    this.undoStack.push(this.createSnapshot());
    this.redoStack = [];
    this.canUndo = true;
    this.canRedo = false;

    this.pageImages = { ...this.pageImages, [key]: url };
    this.dirtyImageKeys.add(key);
    this.unsavedChanges = this.dirtyKeys.size + this.dirtyImageKeys.size;
    this.pushHistory(key, 'img');
    this.updateUI();
  }

  private createSnapshot(): string {
    return JSON.stringify({ texts: this.pageTexts, images: this.pageImages });
  }

  private applySnapshot(raw: string): void {
    const data = JSON.parse(raw);
    if (data.texts) {
      this.pageTexts = data.texts;
      if (data.images) this.pageImages = data.images;
    } else {
      this.pageTexts = data;
    }
  }

  // ===============================================
  // RICH TEXT TOOLBAR
  // ===============================================

  private get richTextEnabled(): boolean {
    return this.config.richText !== false; // default true
  }

  // Tags where Enter should be blocked (single-line elements)
  private static readonly SINGLE_LINE_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'LABEL', 'SPAN', 'A', 'SMALL', 'B', 'STRONG', 'I', 'EM',
  ]);

  // Allowed HTML tags for sanitization
  private static readonly ALLOWED_TAGS = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'BR', 'UL', 'OL', 'LI', 'SUB', 'SUP',
  ]);

  // Allowed attributes per tag
  private static readonly ALLOWED_ATTRS: Record<string, Set<string>> = {
    A: new Set(['href', 'target', 'rel']),
  };

  private sanitizeHTML(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const clean = (node: Node): void => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          if (!EditInPlace.ALLOWED_TAGS.has(el.tagName)) {
            // Unwrap: keep children, remove the tag
            while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
            el.remove();
          } else {
            // Remove disallowed attributes
            const allowedAttrs = EditInPlace.ALLOWED_ATTRS[el.tagName] || new Set();
            for (const attr of Array.from(el.attributes)) {
              if (!allowedAttrs.has(attr.name)) el.removeAttribute(attr.name);
            }
            // Sanitize href to prevent javascript: URLs
            if (el.tagName === 'A') {
              const href = el.getAttribute('href') || '';
              if (href.trim().toLowerCase().startsWith('javascript:')) {
                el.setAttribute('href', '#');
              }
            }
            clean(el);
          }
        } else {
          child.remove(); // Remove comments, etc.
        }
      }
    };
    clean(doc.body);
    return doc.body.innerHTML;
  }

  private createRichToolbar(): void {
    if (!this.richTextEnabled || this.richToolbarEl) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'lcms-rich-toolbar';

    const buttons: { cmd: string; label: string; title: string }[] = [
      { cmd: 'bold', label: 'B', title: 'Bold' },
      { cmd: 'italic', label: '<i>I</i>', title: 'Italic' },
      { cmd: 'underline', label: '<u>U</u>', title: 'Underline' },
      { cmd: 'strikeThrough', label: '<s>S</s>', title: 'Strikethrough' },
    ];

    const linkButtons: { cmd: string; label: string; title: string }[] = [
      { cmd: 'createLink', label: '🔗', title: 'Insert Link' },
      { cmd: 'unlink', label: '⊘', title: 'Remove Link' },
    ];

    const utilButtons: { cmd: string; label: string; title: string }[] = [
      { cmd: 'removeFormat', label: '✕', title: 'Clear Formatting' },
    ];

    const makeBtn = (item: { cmd: string; label: string; title: string }) => {
      const btn = document.createElement('button');
      btn.innerHTML = item.label;
      btn.title = item.title;
      btn.dataset.cmd = item.cmd;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur on the editable element
        this.execToolbarCommand(item.cmd);
      });
      return btn;
    };

    const addSep = () => {
      const sep = document.createElement('div');
      sep.className = 'lcms-tb-sep';
      toolbar.appendChild(sep);
    };

    buttons.forEach(b => toolbar.appendChild(makeBtn(b)));
    addSep();
    linkButtons.forEach(b => toolbar.appendChild(makeBtn(b)));
    addSep();
    utilButtons.forEach(b => toolbar.appendChild(makeBtn(b)));

    this.rootEl?.appendChild(toolbar);
    this.richToolbarEl = toolbar;

    // Listen for selection changes to update active states
    this.selectionChangeHandler = () => this.updateToolbarState();
    document.addEventListener('selectionchange', this.selectionChangeHandler);
  }

  private destroyRichToolbar(): void {
    if (this.richToolbarEl) {
      this.richToolbarEl.remove();
      this.richToolbarEl = null;
    }
    if (this.selectionChangeHandler) {
      document.removeEventListener('selectionchange', this.selectionChangeHandler);
      this.selectionChangeHandler = null;
    }
    this.activeEditableEl = null;
  }

  private execToolbarCommand(cmd: string): void {
    // Pause MutationObserver so DOM changes from execCommand don't trigger rescan
    this.observer?.disconnect();
    if (this.scanTimeout) { clearTimeout(this.scanTimeout); this.scanTimeout = null; }

    if (cmd === 'createLink') {
      const url = prompt('Enter URL:', 'https://');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false);
    }
    this.updateToolbarState();
    // Trigger input to capture the change
    if (this.activeEditableEl) {
      this.activeEditableEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Re-enable observer after a short delay
    setTimeout(() => {
      this.observer?.observe(document.body, EditInPlace.OBS_INIT);
    }, 50);
  }

  private showRichToolbar(el: HTMLElement): void {
    if (!this.richTextEnabled || !this.richToolbarEl) return;
    if (this.toolbarHideTimeout) { clearTimeout(this.toolbarHideTimeout); this.toolbarHideTimeout = null; }

    this.activeEditableEl = el;
    this.positionToolbar(el);
    this.richToolbarEl.classList.add('visible');
    this.updateToolbarState();
  }

  private positionToolbar(el: HTMLElement): void {
    if (!this.richToolbarEl) return;
    const rect = el.getBoundingClientRect();
    const tbRect = this.richToolbarEl.getBoundingClientRect();
    let top = rect.top - tbRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tbRect.width / 2);

    // If above viewport, show below element
    if (top < 4) top = rect.bottom + 8;
    // Keep within horizontal bounds
    if (left < 4) left = 4;
    if (left + tbRect.width > window.innerWidth - 4) left = window.innerWidth - tbRect.width - 4;

    this.richToolbarEl.style.top = `${top}px`;
    this.richToolbarEl.style.left = `${left}px`;
  }

  private hideRichToolbar(): void {
    if (!this.richToolbarEl) return;
    // Small delay so user can click toolbar buttons without it hiding
    this.toolbarHideTimeout = setTimeout(() => {
      this.richToolbarEl?.classList.remove('visible');
      this.activeEditableEl = null;
      this.toolbarHideTimeout = null;
    }, 150);
  }

  private updateToolbarState(): void {
    if (!this.richToolbarEl) return;
    const cmds = ['bold', 'italic', 'underline', 'strikeThrough'];
    for (const btn of Array.from(this.richToolbarEl.querySelectorAll('button'))) {
      const cmd = (btn as HTMLElement).dataset.cmd;
      if (cmd && cmds.includes(cmd)) {
        try {
          (btn as HTMLElement).classList.toggle('active', document.queryCommandState(cmd));
        } catch { /* ignore */ }
      }
    }
  }

  // ===============================================
  // UNDO / REDO
  // ===============================================

  private onUndo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.createSnapshot());
    this.applySnapshot(this.undoStack.pop()!);
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = true;
    this.recalcDirtyKeys();
    this.updateElementTexts();
    this.applyPageImages();
    this.updateUI();
  }

  private onRedo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.createSnapshot());
    this.applySnapshot(this.redoStack.pop()!);
    this.canUndo = true;
    this.canRedo = this.redoStack.length > 0;
    this.recalcDirtyKeys();
    this.updateElementTexts();
    this.applyPageImages();
    this.updateUI();
  }

  private recalcDirtyKeys(): void {
    this.dirtyKeys.clear();
    for (const key of this.registeredKeys) {
      if (JSON.stringify(this.pageTexts[key]) !== JSON.stringify(this.originalTexts[key])) {
        this.dirtyKeys.add(key);
      }
    }
    this.unsavedChanges = this.dirtyKeys.size + this.dirtyImageKeys.size;
  }

  private resetAll(): void {
    this.dirtyKeys.clear();
    this.dirtyImageKeys.clear();
    this.unsavedChanges = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo = false;
    this.canRedo = false;
    this.updateUI();
  }

  private resetAfterSave(): void {
    this.dirtyKeys.clear();
    this.dirtyImageKeys.clear();
    this.unsavedChanges = 0;
    this.originalTexts = JSON.parse(JSON.stringify(this.pageTexts));
    this.originalImages = JSON.parse(JSON.stringify(this.pageImages));
  }

  private cancelEditing(): void {
    this.pageTexts = JSON.parse(JSON.stringify(this.originalTexts));
    this.pageImages = JSON.parse(JSON.stringify(this.originalImages));
    this.dirtyKeys.clear();
    this.dirtyImageKeys.clear();
    this.unsavedChanges = 0;
    this.updateElementTexts();
    this.applyPageImages();
    this.updateUI();
  }

  private logout(): void {
    this.clearTokenExpiryWatcher();
    secureClear();
    sessionStorage.removeItem('builder_edit_mode');
    this.editMode = false;
    this.isEditAllowed = false;
    this.applyEditMode(false);
    this.isOpen = false;
    this.updateUI();

    // Remove ?edit=true from URL and reload page
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.location.href = url.toString();
  }

  private clearTokenExpiryWatcher(): void {
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
  }

  private decodeTokenExpiryMs(token: string): number | null {
    try {
      const payloadSegment = token.split('.')[0];
      if (!payloadSegment) return null;
      const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      if (typeof payload?.exp !== 'number') return null;
      return payload.exp < 1e12 ? payload.exp * 1000 : payload.exp;
    } catch {
      return null;
    }
  }

  private expireSessionAndPromptLogin(message: string = 'Session expired. Please login again.'): void {
    this.clearTokenExpiryWatcher();
    secureClear();
    sessionStorage.removeItem('builder_edit_mode');
    this.editMode = false;
    this.isEditAllowed = false;
    this.pendingEditMode = false;
    this.applyEditMode(false);
    this.isOpen = false;
    this.updateUI();
    this.showToast(message, 'error');
    this.showLoginModal();
  }

  private startTokenExpiryWatcher(token: string): boolean {
    this.clearTokenExpiryWatcher();
    const expiryMs = this.decodeTokenExpiryMs(token);
    if (!expiryMs) return true;
    const remainingMs = expiryMs - Date.now();
    if (remainingMs <= 0) {
      this.expireSessionAndPromptLogin();
      return false;
    }
    this.tokenExpiryTimer = setTimeout(() => {
      this.expireSessionAndPromptLogin();
    }, remainingMs);
    return true;
  }

  // ===============================================
  // API
  // ===============================================

  private async loadTranslationsAndInit(loadDraft: boolean): Promise<void> {
    if (this.config.i18nBasePath) {
      try {
        const lang = this.currentLang;
        const res = await fetch(`${this.config.i18nBasePath}/${lang}.json`);
        if (res.ok) {
          const translations = await res.json();
          this.translationCache.clear();
          this.flattenTranslations(translations, '', this.getPageSection());
        }
      } catch { /* ignore */ }
    }

    this.autoDetectAndScan();
    this.captureDomOriginals();
    if (this.editMode) this.applyEditMode(true);
    if (this.config.apiBase) {
      if (loadDraft) this.loadPageContent('draft');
      else this.loadPublishedContent();
    } else {
      this.buildDefaultTexts();
      this.originalTexts = JSON.parse(JSON.stringify(this.pageTexts));
      this.originalImages = JSON.parse(JSON.stringify(this.pageImages));
      this.setLoading(false);
    }
    this.updateUI();
  }

  private flattenTranslations(obj: any, prefix: string, pageSection: string): void {
    for (const k of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof obj[k] === 'string') {
        const text = obj[k].trim();
        if (text.length >= 2) {
          const existing = this.translationCache.get(text);
          if (!existing || fullKey.toUpperCase().startsWith(pageSection)) {
            this.translationCache.set(text, fullKey);
          }
        }
      } else if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        this.flattenTranslations(obj[k], fullKey, pageSection);
      }
    }
  }

  private getPageSection(): string {
    return this.currentSlug.replace(/^\//, '').replace(/-/g, '_').toUpperCase();
  }

  /** Resolve a stored URL against our server (apiBase) */
  private resolveServerUrl(storedUrl: string): string {
    if (storedUrl.startsWith('/')) return `${this.config.apiBase}${storedUrl}`;
    return storedUrl;
  }

  /** Resolve a stored URL against client's server (clientApi, falls back to apiBase) */

  private getOrCreateDeviceId(): string {
    const key = 'editinplace_device_id';
    const legacy = localStorage.getItem('xtroedge_device_id');
    if (legacy && !localStorage.getItem(key)) localStorage.setItem(key, legacy);
    try {
      const existing = localStorage.getItem(key);
      if (existing && existing.trim()) return existing;
    } catch {
      // Ignore storage access errors and generate in-memory fallback.
    }

    let id = '';
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    } catch {
      id = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    try {
      localStorage.setItem(key, id);
    } catch {
      // Ignore storage write errors.
    }

    return id;
  }

  private apiFetch(url: string, opts?: RequestInit): Promise<Response> {
    const token = secureGet('builder_token') || '';
    const licenseKey = this.config.licenseKey || '';
    const headers: Record<string, string> = { ...(opts?.headers as Record<string, string> || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (licenseKey) headers['X-License-Key'] = licenseKey;

    // Merge client headers only for requests going to client's server (not our apiBase)
    const isOurServer = this.config.apiBase && url.startsWith(this.config.apiBase);
    if (!isOurServer && this.config.clientHeaders) {
      for (const [k, v] of Object.entries(this.config.clientHeaders)) {
        if (!headers[k]) headers[k] = v;
      }
    }

    return fetch(url, { ...opts, headers });
  }

  // Fetch page by slug — if get_url exists in localStorage, call it directly (bypass our server)
  private async fetchSection(slug: string, status?: string): Promise<WebPageContent | null> {
    try {
      const storedGetUrl = secureGet('editinplace_get_url');
      const clientBase = this.config.clientApi || this.config.apiBase;
      const getBase = storedGetUrl ? resolveClientUrl(storedGetUrl, this.config.clientApi || this.config.apiBase) : `${clientBase}/web-page/get`;
      let getUrl = `${getBase}?slug=${encodeURIComponent(slug)}`;
      if (status) getUrl += `&status=${encodeURIComponent(status)}`;
      const res = await this.apiFetch(getUrl);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  private hasSection(type: 'header' | 'footer'): boolean {
    const slug = type === 'header' ? '/header' : '/footer';
    for (const [, info] of this.managedElements) {
      if (info.sectionSlug === slug) return true;
    }
    return false;
  }

  private async loadPageContent(status: 'draft' | 'published'): Promise<void> {
    this.setLoading(true);
    this.cleanOldHistory();

    try {
      // Only fetch sections that exist in the DOM
      const requests: Promise<WebPageContent | null>[] = [this.fetchSection(this.currentSlug, status)];
      const hasHeader = this.hasSection('header');
      const hasFooter = this.hasSection('footer');
      if (hasHeader) requests.push(this.fetchSection('/header', status));
      if (hasFooter) requests.push(this.fetchSection('/footer', status));

      const results = await Promise.all(requests);
      const pageSec = results[0];
      const headerSec = hasHeader ? results[1] : null;
      const footerSec = hasFooter ? results[hasHeader ? 2 : 1] : null;

      const getTexts = (sec: WebPageContent | null) => sec?.content?.texts || sec?.published_content?.texts || null;
      const pageTexts = getTexts(pageSec);
      const headerTexts = getTexts(headerSec);
      const footerTexts = getTexts(footerSec);

      if (pageTexts || headerTexts || footerTexts) {
        this.pageTexts = { ...(pageTexts || {}), ...(headerTexts || {}), ...(footerTexts || {}) };
      } else {
        this.buildDefaultTexts();
      }

      // Extract images from the page response (no extra API call)
      const images = pageSec?.content?.images || pageSec?.published_content?.images;
      if (images) {
        this.pageImages = JSON.parse(JSON.stringify(images));
        this.applyPageImages();
      }

      this.originalTexts = JSON.parse(JSON.stringify(this.pageTexts));
      this.originalImages = JSON.parse(JSON.stringify(this.pageImages));
      this.resetAll();
      this.updateElementTexts();
    } catch {
      this.buildDefaultTexts();
      this.originalTexts = JSON.parse(JSON.stringify(this.pageTexts));
      this.originalImages = JSON.parse(JSON.stringify(this.pageImages));
      this.resetAll();
    } finally {
      this.setLoading(false);
    }
  }

  private async loadPublishedContent(): Promise<void> {
    this.setLoading(true);

    try {
      // Only fetch sections that exist in the DOM
      const requests: Promise<WebPageContent | null>[] = [this.fetchSection(this.currentSlug, 'published')];
      const hasHeader = this.hasSection('header');
      const hasFooter = this.hasSection('footer');
      if (hasHeader) requests.push(this.fetchSection('/header', 'published'));
      if (hasFooter) requests.push(this.fetchSection('/footer', 'published'));

      const results = await Promise.all(requests);
      const pageSec = results[0];
      const headerSec = hasHeader ? results[1] : null;
      const footerSec = hasFooter ? results[hasHeader ? 2 : 1] : null;

      const getTexts = (sec: WebPageContent | null) => sec?.published_content?.texts || null;
      const merged = { ...(getTexts(pageSec) || {}), ...(getTexts(headerSec) || {}), ...(getTexts(footerSec) || {}) };
      if (Object.keys(merged).length > 0) {
        this.pageTexts = JSON.parse(JSON.stringify(merged));
        this.updateElementTexts();
      }

      // Extract images from page response (no extra API call)
      const images = pageSec?.published_content?.images;
      if (images && Object.keys(images).length > 0) {
        this.pageImages = JSON.parse(JSON.stringify(images));
        this.applyPageImages();
      }
    } catch { /* ignore - use current DOM text */ }
    finally { this.setLoading(false); }
  }

  private buildDefaultTexts(): void {
    const texts: { [key: string]: PageTextEntry } = {};
    for (const key of this.registeredKeys) {
      const el = document.querySelector(`[data-cms="${key}"]`);
      const val = el?.textContent?.trim() || '';
      // Only store DOM text under the default language — other languages start empty
      // so users must translate them explicitly
      const entry: PageTextEntry = { [this.defaultLanguage]: val };
      texts[key] = entry;
    }
    this.pageTexts = texts;

    // Load other languages from i18n files if available
    if (this.config.i18nBasePath) {
      const otherLangs = this.languages.filter(l => l !== this.currentLang);
      for (const lang of otherLangs) {
        fetch(`${this.config.i18nBasePath}/${lang}.json`)
          .then(r => r.json())
          .then(translations => {
            const updated = { ...this.pageTexts };
            for (const key of this.registeredKeys) {
              // Try to resolve key path in translations
              const parts = key.split('.');
              let val: any = translations;
              for (const part of parts) { val = val?.[part]; }
              if (val && typeof val === 'string') {
                updated[key] = { ...updated[key], [lang]: val };
              }
            }
            this.pageTexts = updated;
            this.originalTexts = JSON.parse(JSON.stringify(updated));
            this.updateElementTexts();
          })
          .catch(() => { /* ignore */ });
      }
    }
  }

  // Group pageTexts by section slug based on managedElements info
  private groupTextsBySection(): { [sectionSlug: string]: { [key: string]: PageTextEntry } } {
    const sections: { [sectionSlug: string]: { [key: string]: PageTextEntry } } = {};
    for (const [, info] of this.managedElements) {
      const slug = info.sectionSlug;
      if (!sections[slug]) sections[slug] = {};
      if (this.pageTexts[info.key] !== undefined) {
        sections[slug][info.key] = this.pageTexts[info.key];
      }
    }
    return sections;
  }

  private async saveChanges(): Promise<void> {
    if (!this.licenseValid) {
      this.showLicenseExpiredToast();
      return;
    }
    if (!this.config.apiBase) {
      this.showToast('No API configured. Set apiBase to enable save.', 'error');
      return;
    }
    this.isSaving = true;
    this.updateUI();

    // Ensure _orig for current language is stored for ALL entries before saving
    const origKey = `_orig_${this.currentLang}`;
    for (const key of Object.keys(this.pageTexts)) {
      if (!this.pageTexts[key][origKey] && this.domOriginals[key]) {
        this.pageTexts[key][origKey] = this.domOriginals[key];
      }
    }

    try {
      const sections = this.groupTextsBySection();
      const requests = Object.entries(sections).map(([slug, texts]) =>
        this.apiFetch(`${this.config.apiBase}/web_page/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            title: slug === this.currentSlug ? this.currentTitle : slug.replace('/', ''),
            content: { texts, ...(slug === this.currentSlug ? { images: this.pageImages } : {}) }
          }),
        })
      );
      const responses = await Promise.all(requests);
      const saveResults: any[] = [];
      for (const res of responses) {
        const data = await res.json();
        saveResults.push({ ok: res.ok, status: res.status, data });
      }
      const unauthorized = saveResults.find(r => r.status === 401);
      if (unauthorized) {
        const msg = unauthorized?.data?.message || unauthorized?.data?.error || 'Session expired. Please login again.';
        this.expireSessionAndPromptLogin(msg);
        return;
      }
      if (saveResults.some(r => !r.ok)) throw new Error('One or more sections failed to save');
      console.info('[EditInPlace] Save responses:', saveResults.map(r => r.data));
      this.isSaving = false;
      this.resetAfterSave();
      this.updateUI();
      this.showToast('Draft saved successfully!', 'success');
      this.config.onSaved?.();
    } catch (err) {
      this.isSaving = false;
      this.updateUI();
      this.showToast('Save failed. Please try again.', 'error');
      this.config.onError?.('save', err);
    }
  }

  private async publishChanges(): Promise<void> {
    if (!this.licenseValid) {
      this.showLicenseExpiredToast();
      return;
    }
    if (!this.config.apiBase) {
      this.showToast('No API configured. Set apiBase to enable publish.', 'error');
      return;
    }
    this.isPublishing = true;
    this.updateUI();

    // Ensure _orig for current language is stored for ALL entries before publishing
    const origKey = `_orig_${this.currentLang}`;
    for (const key of Object.keys(this.pageTexts)) {
      if (!this.pageTexts[key][origKey] && this.domOriginals[key]) {
        this.pageTexts[key][origKey] = this.domOriginals[key];
      }
    }

    try {
      const sections = this.groupTextsBySection();

      const requests = Object.entries(sections).map(([slug, texts]) =>
        this.apiFetch(`${this.config.apiBase}/web_page/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            title: slug === this.currentSlug ? this.currentTitle : slug.replace('/', ''),
            published_content: { texts, ...(slug === this.currentSlug ? { images: this.pageImages } : {}) },
          }),
        })
      );

      const results = await Promise.all(requests);
      const publishResults: any[] = [];
      for (const res of results) {
        const data = await res.json();
        publishResults.push({ ok: res.ok, status: res.status, data });
      }
      const unauthorized = publishResults.find(r => r.status === 401);
      if (unauthorized) {
        const msg = unauthorized?.data?.message || unauthorized?.data?.error || 'Session expired. Please login again.';
        this.expireSessionAndPromptLogin(msg);
        return;
      }
      if (publishResults.some(r => !r.ok)) throw new Error('One or more sections failed to publish');
      console.info('[EditInPlace] Publish responses:', publishResults.map(r => r.data));
      this.isPublishing = false;
      this.resetAfterSave();
      this.updateUI();
      this.showToast('Published successfully!', 'success');
      this.config.onPublished?.();
    } catch (err) {
      this.isPublishing = false;
      this.updateUI();
      this.showToast('Publish failed. Please try again.', 'error');
      this.config.onError?.('publish', err);
    }
  }

  // ===============================================
  // HISTORY (IndexedDB)
  // ===============================================

  private async toggleHistory(): Promise<void> {
    this.showHistory = !this.showHistory;
    if (this.showHistory) await this.loadHistory();
    this.updateUI();
  }

  private async loadHistory(): Promise<void> {
    this.historyList = await readHistory(this.currentSlug);
    this.renderHistoryList();
  }

  private renderHistoryList(): void {
    if (!this.historyListEl) return;
    this.historyListEl.innerHTML = '';
    if (this.historyList.length === 0) {
      const empty = createElement('div', 'lcms-history-empty');
      empty.textContent = 'No history yet';
      this.historyListEl.appendChild(empty);
      return;
    }
    for (const entry of this.historyList) {
      const item = document.createElement('button');
      item.className = 'lcms-history-item';
      const labelEl = createElement('div', 'lcms-history-label');
      labelEl.textContent = entry.label;
      const metaEl = createElement('div', 'lcms-history-meta');
      const langEl = createElement('span', 'lcms-history-lang');
      langEl.textContent = entry.lang.toUpperCase();
      const dateText = document.createTextNode(' ' + formatHistoryDate(entry.timestamp));
      metaEl.appendChild(langEl);
      metaEl.appendChild(dateText);
      item.appendChild(labelEl);
      item.appendChild(metaEl);
      item.addEventListener('click', (e) => { e.stopPropagation(); this.restoreHistory(entry); });
      this.historyListEl.appendChild(item);
    }
  }

  private restoreHistory(entry: EditHistoryEntry): void {
    this.undoStack.push(this.createSnapshot());
    this.canUndo = true;
    this.applySnapshot(entry.snapshot);
    this.recalcDirtyKeys();
    this.showHistory = false;
    this.updateElementTexts();
    this.applyPageImages();
    this.updateUI();
    this.showToast('Restored from history', 'success');
  }

  private pushHistory(key: string, lang: string): void {
    void writeHistoryEntry({
      slug: this.currentSlug,
      key,
      lang,
      snapshot: JSON.stringify({ texts: this.pageTexts, images: this.pageImages }),
    });
  }

  private async cleanOldHistory(): Promise<void> {
    await pruneHistory(this.historyRetentionMs);
  }


  // ===============================================
  // TOAST
  // ===============================================

  private showToast(message: string, type: 'success' | 'error'): void {
    if (!this.toastEl) return;
    this.toastMessage = message;
    this.toastType = type;

    const icon = type === 'success' ? ICON.check : ICON.error;
    this.toastEl.className = `lcms-toast lcms-toast-${type}`;
    this.toastEl.innerHTML = `${icon} ${message}`;

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this.toastEl) this.toastEl.classList.add('lcms-hidden');
    }, 3000);
  }

  // ===============================================
  // FAB & PANEL
  // ===============================================

  private onFabClick(e: Event): void {
    e.stopPropagation();
    if (this.hasMoved) return;
    this.isOpen = !this.isOpen;
    this.updateUI();
  }

  private togglePanel(): void {
    if (!this.hasMoved) {
      this.isOpen = !this.isOpen;
      this.updateUI();
    }
  }

  private toggleEditMode(e: Event): void {
    e.stopPropagation();
    const checked = (e.target as HTMLInputElement).checked;

    // Gate: block edit mode if license is not valid
    if (checked && !this.licenseValid) {
      (e.target as HTMLInputElement).checked = false;
      this.showLicenseExpiredToast();
      return;
    }

    if (checked) {
      sessionStorage.setItem('builder_edit_mode', 'true');
      this.editMode = true;
      this.currentLang = detectLanguage(this.languages, this.defaultLanguage);
      this.applyEditMode(true);
      this.loadPageContent('draft');
    } else {
      sessionStorage.removeItem('builder_edit_mode');
      this.editMode = false;
      this.applyEditMode(false);
    }
    this.updateUI();
    this.config.onEditModeChanged?.(this.editMode);
  }

  private switchLang(lang: string): void {
    this.currentLang = lang;

    // 1. Persist language so framework picks it up after reload
    localStorage.setItem('selectedLanguage', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // 2. Notify (fires before reload so any sync listener can catch it)
    this.config.onLangChanged?.(lang);
    window.dispatchEvent(new CustomEvent('cms:langChanged', { detail: { lang } }));

    // 3. Reload so the framework re-initializes with the new language
    window.location.reload();
  }

  // ===============================================
  // FAB DRAG
  // ===============================================

  private onDragStart(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('button:not(.lcms-fab-btn)') || (e.target as HTMLElement).closest('.lcms-panel')) return;
    this.isDragging = true;
    this.hasMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.startPosX = this.posX;
    this.startPosY = this.posY;
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.fabEl) return;
    const dx = e.clientX - this.dragStartX, dy = e.clientY - this.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
    this.posX = Math.max(0, Math.min(window.innerWidth - 60, this.startPosX + dx));
    this.posY = Math.max(0, Math.min(window.innerHeight - 60, this.startPosY + dy));
    this.fabEl.style.left = this.posX + 'px';
    this.fabEl.style.top = this.posY + 'px';
  }

  private onDragEnd(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  private onTouchStart(e: TouchEvent): void {
    if ((e.target as HTMLElement).closest('button:not(.lcms-fab-btn)') || (e.target as HTMLElement).closest('.lcms-panel')) return;
    const t = e.touches[0];
    this.isDragging = true;
    this.hasMoved = false;
    this.dragStartX = t.clientX;
    this.dragStartY = t.clientY;
    this.startPosX = this.posX;
    this.startPosY = this.posY;
    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.isDragging || !this.fabEl) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - this.dragStartX, dy = t.clientY - this.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
    this.posX = Math.max(0, Math.min(window.innerWidth - 60, this.startPosX + dx));
    this.posY = Math.max(0, Math.min(window.innerHeight - 60, this.startPosY + dy));
    this.fabEl.style.left = this.posX + 'px';
    this.fabEl.style.top = this.posY + 'px';
  }

  private onTouchEnd(): void {
    this.isDragging = false;
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
  }

  // ===============================================
  // HELPERS
  // ===============================================

  private setLoading(val: boolean): void {
    this.loading = val;
    this.updateUI();
  }




  // ===============================================
  // LOGIN MODAL
  // ===============================================

  private showLoginModal(): void {
    if (this.loginModalEl) return;

    const overlay = document.createElement('div');
    overlay.className = 'lcms-login-overlay';
    overlay.id = 'lcms-login-modal';

    overlay.innerHTML = `
      <div class="lcms-login-box">
        <div class="lcms-login-logo">
          <div class="lcms-login-logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <span class="lcms-login-logo-text">EditInPlace CMS</span>
        </div>
        <div class="lcms-login-title">Builder Login</div>
        <div class="lcms-login-sub">Sign in to access edit mode</div>
        <div class="lcms-login-field">
          <label class="lcms-login-label">Email</label>
          <input class="lcms-login-input" id="lcms-login-email" type="email" placeholder="Enter your email" autocomplete="username" />
        </div>
        <div class="lcms-login-field">
          <label class="lcms-login-label">Password</label>
          <div class="lcms-password-wrapper">
            <input class="lcms-login-input" id="lcms-login-password" type="password" placeholder="Enter your password" autocomplete="current-password" />
            <button type="button" class="lcms-password-toggle" id="lcms-password-toggle" tabindex="-1">
              <svg class="lcms-eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="lcms-eye-closed lcms-hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <button class="lcms-login-btn" id="lcms-login-btn">Sign In</button>
        <div class="lcms-login-error" id="lcms-login-error"></div>
      </div>
    `;

    (this.rootEl || document.body).appendChild(overlay);
    this.loginModalEl = overlay;

    const btn = overlay.querySelector('#lcms-login-btn') as HTMLButtonElement;
    const emailInput = overlay.querySelector('#lcms-login-email') as HTMLInputElement;
    const passInput = overlay.querySelector('#lcms-login-password') as HTMLInputElement;
    const doLogin = () => this.attemptLogin(emailInput.value.trim(), passInput.value);
    btn.addEventListener('click', doLogin);
    passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

    // Password show/hide toggle
    const toggleBtn = overlay.querySelector('#lcms-password-toggle') as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = passInput.type === 'password';
        passInput.type = isPassword ? 'text' : 'password';
        toggleBtn.querySelector('.lcms-eye-open')!.classList.toggle('lcms-hidden', !isPassword);
        toggleBtn.querySelector('.lcms-eye-closed')!.classList.toggle('lcms-hidden', isPassword);
        passInput.focus();
      });
    }

    // Focus email field
    setTimeout(() => emailInput.focus(), 50);
  }

  private hideLoginModal(): void {
    if (this.loginCooldownTimer) {
      clearInterval(this.loginCooldownTimer);
      this.loginCooldownTimer = null;
    }
    this.loginModalEl?.remove();
    this.loginModalEl = null;
  }

  private completeLogin(data: any): void {
    const token = data?.token || data?.authToken || data?.auth_token || data?.data?.token;
    if (!token) throw new Error('Login successful but no token returned.');

    secureSet('builder_token', token);

    // Signing in re-checks the plan from scratch, so logging out and back in
    // is a reliable way to pick up an upgrade straight away.
    clearLicenseCache();

    if (data?.get_url) secureSet('editinplace_get_url', data.get_url);
    else secureRemove('editinplace_get_url');
    if (data?.published_url) secureSet('editinplace_published_url', data.published_url);
    else secureRemove('editinplace_published_url');
    if (data?.image_url) secureSet('editinplace_image_url', data.image_url);
    else secureRemove('editinplace_image_url');
    if (data?.client_api) {
      secureSet('editinplace_client_api', data.client_api);
      this.config.clientApi = data.client_api;
    } else {
      secureRemove('editinplace_client_api');
    }
    if (data?.save_url) secureSet('editinplace_save_url', data.save_url);
    else secureRemove('editinplace_save_url');

    this.clearOtpState();
    this.hideLoginModal();

    this.editMode = true;
    this.pendingEditMode = false;
    sessionStorage.setItem('builder_edit_mode', 'true');
    this.applyEditMode(true);
    this.updateUI();
    this.loadPageContent('draft');
  }

  private async attemptLogin(email: string, password: string): Promise<void> {
    const btn = document.getElementById('lcms-login-btn') as HTMLButtonElement;
    const errorEl = document.getElementById('lcms-login-error') as HTMLElement;

    if (!email || !password) {
      errorEl.textContent = 'Please enter your email and password.';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.classList.remove('visible');

    try {
      const loginUrl = this.config.loginUrl || `${this.config.apiBase}/auth/login`;
      const deviceId = this.getOrCreateDeviceId();
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ email, password }),
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* ignore parse error */ }

      if (!res.ok) {
        if (res.status === 429 && Number(data?.retryAfterSeconds) > 0) {
          this.startLoginCooldown(Number(data.retryAfterSeconds));
          // Timer on button already communicates lockout; suppress extra error alert.
          errorEl.classList.remove('visible');
          return;
        }
        const apiMsg = data?.message || data?.error || null;
        throw new Error(apiMsg || `HTTP ${res.status}`);
      }

      // Check if OTP verification is required
      if (data?.step === 'otp_required') {
        this.otpSessionId = data.sessionId;
        this.showOtpScreen(data.email, data.expiresIn || 120, Number(data?.resendRetryAfterSeconds) || 0);
        return;
      }

      this.completeLogin(data);
    } catch (err: any) {
      if (Date.now() >= this.loginAvailableAt) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
      errorEl.textContent = err?.message || 'Login failed. Please try again.';
      errorEl.classList.add('visible');
    }
  }

  private startLoginCooldown(seconds: number): void {
    const btn = document.getElementById('lcms-login-btn') as HTMLButtonElement;
    if (!btn) return;

    if (this.loginCooldownTimer) clearInterval(this.loginCooldownTimer);

    const safeSeconds = Math.max(1, Math.ceil(seconds));
    this.loginAvailableAt = Date.now() + (safeSeconds * 1000);

    const update = () => {
      const remainingMs = Math.max(0, this.loginAvailableAt - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec > 0) {
        const minutes = Math.floor(remainingSec / 60);
        const secondsPart = remainingSec % 60;
        btn.disabled = true;
        btn.textContent = `Try again in ${minutes}:${secondsPart.toString().padStart(2, '0')}`;
        return;
      }

      if (this.loginCooldownTimer) clearInterval(this.loginCooldownTimer);
      this.loginCooldownTimer = null;
      btn.disabled = false;
      btn.textContent = 'Sign In';
    };

    update();
    this.loginCooldownTimer = setInterval(update, 1000);
  }

  // ===============================================
  // OTP VERIFICATION
  // ===============================================

  private showOtpScreen(maskedEmail: string, expiresIn: number, resendRetryAfterSeconds: number = 0): void {
    const box = this.loginModalEl?.querySelector('.lcms-login-box');
    if (!box) return;

    this.otpExpiryTime = Date.now() + (expiresIn * 1000);

    box.innerHTML = `
      <div class="lcms-login-logo">
        <div class="lcms-login-logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <span class="lcms-login-logo-text">EditInPlace CMS</span>
      </div>
      <div class="lcms-login-title">Verify Your Identity</div>
      <div class="lcms-login-sub">Enter the 6-digit code sent to<br/><strong style="color:rgba(255,255,255,0.7)">${maskedEmail}</strong></div>
      <div class="lcms-login-field">
        <label class="lcms-login-label">Verification Code</label>
        <input class="lcms-login-input lcms-otp-input" id="lcms-otp-input" type="text"
               inputmode="numeric" maxlength="6" placeholder="000000"
               autocomplete="one-time-code" />
      </div>
      <div class="lcms-otp-timer" id="lcms-otp-timer">Code expires in <span id="lcms-otp-countdown">2:00</span></div>
      <button class="lcms-login-btn" id="lcms-otp-btn">Verify</button>
      <div class="lcms-otp-resend" id="lcms-otp-resend">
        Didn't receive the code? <button class="lcms-otp-resend-btn" id="lcms-resend-btn">Resend Code</button>
      </div>
      <button class="lcms-otp-back-btn" id="lcms-otp-back">\u2190 Back to login</button>
      <div class="lcms-login-error" id="lcms-login-error"></div>
    `;

    const otpInput = box.querySelector('#lcms-otp-input') as HTMLInputElement;
    const verifyBtn = box.querySelector('#lcms-otp-btn') as HTMLButtonElement;
    const resendBtn = box.querySelector('#lcms-resend-btn') as HTMLButtonElement;
    const backBtn = box.querySelector('#lcms-otp-back') as HTMLButtonElement;
    // Only allow digits
    otpInput.addEventListener('input', () => {
      otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 6);
      if (otpInput.value.length === 6) {
        this.attemptOtpVerify(otpInput.value);
      }
    });

    const doVerify = () => this.attemptOtpVerify(otpInput.value);
    verifyBtn.addEventListener('click', doVerify);
    otpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doVerify(); });

    resendBtn.addEventListener('click', () => this.resendOtp());
    backBtn.addEventListener('click', () => {
      this.clearOtpState();
      this.hideLoginModal();
      this.showLoginModal();
    });

    this.startOtpCountdown();
    this.startResendCooldown(resendRetryAfterSeconds > 0 ? resendRetryAfterSeconds : 30);
    setTimeout(() => otpInput.focus(), 50);
  }

  private async attemptOtpVerify(otp: string): Promise<void> {
    const btn = document.getElementById('lcms-otp-btn') as HTMLButtonElement;
    const errorEl = document.getElementById('lcms-login-error') as HTMLElement;

    if (!otp || otp.length !== 6) {
      if (errorEl) {
        errorEl.textContent = 'Please enter the 6-digit verification code.';
        errorEl.classList.add('visible');
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
    if (errorEl) errorEl.classList.remove('visible');

    try {
      const verifyUrl = `${this.config.apiBase}/auth/verify-otp`;
      const deviceId = this.getOrCreateDeviceId();
      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ sessionId: this.otpSessionId, otp }),
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        if (res.status === 401) {
          const apiMsg = data?.message || data?.error || 'Session expired. Please login again.';
          this.invalidateOtpSessionUI(apiMsg);
          return;
        }
        const apiMsg = data?.message || data?.error || null;
        throw new Error(apiMsg || `HTTP ${res.status}`);
      }

      this.completeLogin(data);
    } catch (err: any) {
      if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
      if (errorEl) {
        errorEl.textContent = err?.message || 'Verification failed. Please try again.';
        errorEl.classList.add('visible');
      }
    }
  }

  private async resendOtp(): Promise<void> {
    const resendBtn = document.getElementById('lcms-resend-btn') as HTMLButtonElement;
    const errorEl = document.getElementById('lcms-login-error') as HTMLElement;

    if (!this.otpSessionId) return;

    if (resendBtn) { resendBtn.disabled = true; resendBtn.textContent = 'Sending...'; }
    if (errorEl) errorEl.classList.remove('visible');

    try {
      const resendUrl = `${this.config.apiBase}/auth/resend-otp`;
      const deviceId = this.getOrCreateDeviceId();
      const res = await fetch(resendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ sessionId: this.otpSessionId }),
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        if (res.status === 401) {
          const apiMsg = data?.message || data?.error || 'Session expired. Please login again.';
          this.invalidateOtpSessionUI(apiMsg);
          return;
        }

        if (res.status === 429 && Number(data?.retryAfterSeconds) > 0) {
          this.startResendCooldown(Number(data.retryAfterSeconds), true);
          // Intentionally suppress inline error alert; cooldown timer on button is enough UX.
          if (errorEl) errorEl.classList.remove('visible');
          return;
        }

        const apiMsg = data?.message || data?.error || null;
        throw new Error(apiMsg || 'Failed to resend code');
      }

      // Reset countdown
      this.otpExpiryTime = Date.now() + ((data?.expiresIn || 120) * 1000);
      this.startOtpCountdown();
      this.startResendCooldown(Number(data?.resendCooldownSeconds) || 30);

      // Re-enable verify button if it was disabled due to expiry
      const verifyBtn = document.getElementById('lcms-otp-btn') as HTMLButtonElement;
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
    } catch (err: any) {
      if (resendBtn && Date.now() >= this.resendAvailableAt) {
        resendBtn.textContent = 'Resend Code';
        resendBtn.disabled = false;
      }
      if (errorEl) {
        errorEl.textContent = err?.message || 'Failed to resend code.';
        errorEl.classList.add('visible');
      }
    }
  }

  private invalidateOtpSessionUI(message: string): void {
    this.clearOtpState();

    const otpInput = document.getElementById('lcms-otp-input') as HTMLInputElement;
    const verifyBtn = document.getElementById('lcms-otp-btn') as HTMLButtonElement;
    const resendBtn = document.getElementById('lcms-resend-btn') as HTMLButtonElement;
    const errorEl = document.getElementById('lcms-login-error') as HTMLElement;

    if (otpInput) {
      otpInput.disabled = true;
      otpInput.value = '';
    }
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verify';
    }
    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resend Code';
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  private startResendCooldown(seconds: number, showCounter: boolean = true): void {
    const resendBtn = document.getElementById('lcms-resend-btn') as HTMLButtonElement;
    if (!resendBtn) return;

    if (this.resendCooldownTimer) clearInterval(this.resendCooldownTimer);

    const safeSeconds = Math.max(1, Math.ceil(seconds));
    this.resendAvailableAt = Date.now() + (safeSeconds * 1000);

    const update = () => {
      const remainingMs = Math.max(0, this.resendAvailableAt - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec > 0) {
        resendBtn.disabled = true;
        if (showCounter) {
          const minutes = Math.floor(remainingSec / 60);
          const secondsPart = remainingSec % 60;
          resendBtn.textContent = `Resend in ${minutes}:${secondsPart.toString().padStart(2, '0')}`;
        } else {
          resendBtn.textContent = 'Resend Code';
        }
        return;
      }

      if (this.resendCooldownTimer) clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend Code';
    };

    update();
    this.resendCooldownTimer = setInterval(update, 1000);
  }

  private startOtpCountdown(): void {
    if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);

    const update = () => {
      const remaining = Math.max(0, this.otpExpiryTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const el = document.getElementById('lcms-otp-countdown');
      const timerEl = document.getElementById('lcms-otp-timer');
      if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;

      if (seconds <= 0) {
        if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);
        if (timerEl) { timerEl.textContent = 'Code expired'; timerEl.style.color = '#f87171'; }
        const btn = document.getElementById('lcms-otp-btn') as HTMLButtonElement;
        if (btn) { btn.disabled = true; btn.textContent = 'Code Expired'; }
      }
    };

    update();
    this.otpCountdownTimer = setInterval(update, 1000);
  }

  private clearOtpState(): void {
    this.otpSessionId = null;
    if (this.otpCountdownTimer) {
      clearInterval(this.otpCountdownTimer);
      this.otpCountdownTimer = null;
    }
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }
    this.otpExpiryTime = 0;
    this.resendAvailableAt = 0;
  }

  // ===============================================
  // SITE IDENTIFIER
  // ===============================================


  // ===============================================
  // THEME COLOR
  // ===============================================



  private applyThemeColor(color: string): void {
    this.highlightColor = color;
    document.documentElement.style.setProperty('--lcms-primary', color);
    document.documentElement.style.setProperty('--lcms-primary-rgb', hexToRgb(color));
    document.documentElement.style.setProperty('--lcms-primary-dark', darkenHex(color));

    // Re-apply highlight to managed elements
    if (this.editMode) {
      for (const [el] of this.managedElements) {
        el.style.setProperty('outline', `2px dashed ${color}`, 'important');
      }
      for (const [img] of this.managedImages) {
        img.style.setProperty('outline', `2px dashed ${color}`, 'important');
      }
    }

    // Update swatch active states
    const swatches = this.panelEl?.querySelectorAll('.lcms-theme-swatch');
    swatches?.forEach(s => {
      (s as HTMLElement).classList.toggle('active', (s as HTMLElement).dataset.color === color);
    });

    // Persist to localStorage
    localStorage.setItem('editinplace_theme_color', color);
  }

  // ===============================================
  // STATIC CONVENIENCE
  // ===============================================

  /** Quick init - create and start CMS in one call */
  static async create(config?: EditInPlaceConfig): Promise<EditInPlace> {
    // Importing this package auto-initialises an instance from
    // window.__EDITINPLACE_CONFIG__. Calling create() yourself means your own
    // config should win, so replace that instance instead of stacking a second
    // editor — two panels and two floating buttons on the same page.
    if (typeof window !== 'undefined') {
      const existing = (window as any).__editinplace_instance__ as EditInPlace | undefined;
      if (existing) existing.destroy();
    }

    const cms = new EditInPlace(config);
    await cms.init();

    if (typeof window !== 'undefined') {
      (window as any).__editinplace_instance__ = cms;
    }

    return cms;
  }

  /** Auto-init: called automatically when package is loaded. No user code needed. */
  static async autoInit(): Promise<void> {
    // Prevent double init
    if ((window as any).__editinplace_instance__) return;

    // Sites written before the rename still set __XTROEDGE_CMS_CONFIG__. Read
    // the current name first, fall back to the old one, so an existing install
    // keeps working without anyone touching their HTML.
    const w = window as any;
    const userConfig: EditInPlaceConfig =
      w.__EDITINPLACE_CONFIG__ || w.__XTROEDGE_CMS_CONFIG__ || {};

    const cms = await EditInPlace.create(userConfig);
    (window as any).__editinplace_instance__ = cms;
  }
}


