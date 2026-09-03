
// ==UserScript==
// @name           Zentral
// @description    Unified Apps Grid and Tabs Groups
// @author         Michele Pierini
// @version        v0.1.6
// @include        main
// ==/UserScript==

"use strict";

(function ZentralWorkspace() {
  if (typeof gBrowser === "undefined") return;
  if (window.ZentralInitialized === true) {
    return;
  }
  window.ZentralInitialized = true;

  /* ============================================================================
   * ZENTRAL ARCHITECTURE & INDEX (TABLE OF CONTENTS)
   * ============================================================================
   * 
   * 1.0 CONFIGURATION & CONSTANTS
   *     1.1 Pref Key Definitions
   *     1.2 Default Constant Values
   *
   * 2.0 ZENTRAL CORE ENGINE (ZentralCore)
   *     2.1 Core State & Config Storage
   *     2.2 Native Browser Preference Utilities
   *     2.3 System Event Bus
   *
   * 3.0 APPS MODULE (ZentralApps)
   *     3.1 State Initialization & Properties
   *     3.2 CSS Style Injection
   *     3.3 Layout & Sidebar Position Detection
   *     3.4 Grid & Tile Rendering
   *     3.5 App Panel Lifecycle & Animations
   *     3.6 Drag & Drop / Grid Reordering
   *     3.7 App Context Menus & Space Scoping
   *
   * 4.0 TAB GROUPS MODULE (ZentralTabGroups)
   *     4.1 Initialization & Observers
   *     4.2 Custom CSS & Visual Enhancements
   *     4.3 Group Hierarchy & Storage Serialization
   *     4.4 Color Picker & Theme Processing
   *     4.5 Custom Tooltips & Context Menus
   *
   * 5.0 SETTINGS MODULE (ZentralSettings)
   *     5.1 Modal UI Structure & Injection
   *     5.2 Form Data Binding & Persistence
   *     5.3 Modal Animation & Dialog Styles
   *
   * 6.0 MASTER BOOTSTRAPPER & ENTRY POINT
   *     6.1 Global Namespace Definition
   *     6.2 Browser Startup Observers
   * ============================================================================
   */

  /* ============================================================================
   * 1.0 CONFIGURATION & CONSTANTS
   * ============================================================================
   */

  /**
   * Zentral Constants shared across modules (Preferences keys, default bounds, etc.)
   */
  const Constants = {
    /**
     * 1.1 Apps Module Preference Keys & Dimension Constraints
     */
    Apps: {
      PREF_APPS: "zen.workspace.apps.sidebar.apps",
      PREF_WIDTH: "zen.workspace.apps.sidebar.width",
      PREF_ANIMATION_SPEED: "zen.workspace.apps.sidebar.animation_speed",
      PREF_ANIMATION_TYPE: "zen.workspace.apps.sidebar.animation_type",
      PREF_ENABLED: "zen.workspace.apps.sidebar.enabled",
      PREF_MAX_APPS: "zen.workspace.apps.sidebar.max_apps",
      PREF_APPS_PER_ROW: "zen.workspace.apps.sidebar.apps_per_row",
      PREF_MAX_ROWS: "zen.workspace.apps.sidebar.max_rows",
      PREF_AUTOHIDE: "zen.workspace.apps.sidebar.autohide",
      PREF_PLACEMENT: "zen.workspace.apps.sidebar.placement",
      PREF_UTILITY_ORDER: "zen.workspace.apps.sidebar.utility_order",
      MIN_WIDTH_PX: 280,
      MAX_WIDTH_RATIO: 0.80,
      DEFAULT_SLIDE_MS: 450,
      DEFAULT_MAX_APPS: 21,
      DEFAULT_APPS_PER_ROW: 7,
      DEFAULT_MAX_ROWS: 3,
      /** Fixed number of slots hosted in the Utility section */
      UTILITY_SLOTS_COUNT: 4,
      /** Sidebar width (px) below which layout is treated as collapsed. */
      COLLAPSED_WIDTH_THRESHOLD: 140
    },
    /**
     * 1.2 Tab Groups Preference Keys
     */
    TabGroups: {
      PREF_COLORS: "zen.workspace.tabgroups.colors",
      PREF_STATE: "zen.workspace.tabgroups.state",
      PREF_ENABLED: "zen.workspace.tabgroups.enabled",
      PREF_COLLAPSE_ON_LAUNCH: "zen.workspace.tabgroups.collapse_on_launch",
      PREF_THUMBNAILS: "zen.workspace.tabgroups.thumbnails",
      PREF_SHOW_CHEVRON: "zen.workspace.tabgroups.show_chevron",
      PREF_INDICATOR_TYPE: "zen.workspace.tabgroups.indicator_type",
      PREF_LABEL_OPACITY: "zen.workspace.tabgroups.label_opacity"
    },
    /**
     * 1.3 Diagnostics Preference Keys
     */
    Diagnostics: {
      PREF_LOGGER_ENABLED: "zen.workspace.zentral.debug",
      PREF_LOGGER_PATH: "zentral.logger.path",
      PREF_LOGGER_FULL: "zen.workspace.zentral.debug.full",
      PREF_LOGGER_CORE: "zen.workspace.zentral.debug.core",
      PREF_LOGGER_TABS: "zen.workspace.zentral.debug.tabs",
      PREF_LOGGER_APPS: "zen.workspace.zentral.debug.apps",
      PREF_LOGGER_MENUS: "zen.workspace.zentral.debug.menus",
      PREF_LOGGER_LAYOUT: "zen.workspace.zentral.debug.layout",
      PREF_REPORT_ENDPOINT: "zen.workspace.zentral.report_endpoint"
    },
    /** Debug logging preference — set true in about:config to enable verbose console output */
    DEBUG_PREF: "zen.workspace.zentral.debug"
  };

  /* ============================================================================
   * 2.0 ZENTRAL CORE ENGINE (ZentralCore)
   * ============================================================================
   */

  /**
   * Core orchestrator managing Events, Configurations, and Preference Fallbacks.
   */
  class ZentralCore {
    /**
     * Constructs the ZentralCore instance and initializes the event listener map and default preferences.
     */
    constructor() {
      /** @type {Map<string, Array<Function>>} Storage map for pub-sub event callbacks */
      this.listeners = new Map();
      
      /** @type {Object<string, any>} Default fallback preference values */
      this.defaultPrefs = {
        [Constants.Apps.PREF_APPS]: "[]",
        [Constants.Apps.PREF_WIDTH]: 350,
        [Constants.Apps.PREF_ANIMATION_SPEED]: Constants.Apps.DEFAULT_SLIDE_MS,
        [Constants.Apps.PREF_ANIMATION_TYPE]: "slide",
        [Constants.Apps.PREF_ENABLED]: true,
        [Constants.Apps.PREF_MAX_APPS]: Constants.Apps.DEFAULT_MAX_APPS,
        [Constants.Apps.PREF_APPS_PER_ROW]: Constants.Apps.DEFAULT_APPS_PER_ROW,
        [Constants.Apps.PREF_MAX_ROWS]: Constants.Apps.DEFAULT_MAX_ROWS,
        [Constants.Apps.PREF_AUTOHIDE]: false,
        [Constants.Apps.PREF_PLACEMENT]: "sidebar",
        [Constants.Apps.PREF_UTILITY_ORDER]: '["autohide",null,null,"settings"]',
        [Constants.TabGroups.PREF_COLORS]: "{}",
        [Constants.TabGroups.PREF_STATE]: "{}",
        [Constants.TabGroups.PREF_ENABLED]: true,
        [Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH]: false,
        [Constants.TabGroups.PREF_THUMBNAILS]: true,
        [Constants.TabGroups.PREF_SHOW_CHEVRON]: true,
        [Constants.TabGroups.PREF_INDICATOR_TYPE]: "circle",
        [Constants.TabGroups.PREF_LABEL_OPACITY]: 85,
        [Constants.Diagnostics.PREF_LOGGER_ENABLED]: false,
        [Constants.Diagnostics.PREF_LOGGER_PATH]: "",
        [Constants.Diagnostics.PREF_LOGGER_FULL]: true,
        [Constants.Diagnostics.PREF_LOGGER_CORE]: true,
        [Constants.Diagnostics.PREF_LOGGER_TABS]: false,
        [Constants.Diagnostics.PREF_LOGGER_APPS]: false,
        [Constants.Diagnostics.PREF_LOGGER_MENUS]: false,
        [Constants.Diagnostics.PREF_LOGGER_LAYOUT]: false,
        [Constants.Diagnostics.PREF_REPORT_ENDPOINT]: "https://zentral-issue-reporter.michele-pierini.workers.dev/"
      };
    }

    /**
     * Subscribes a callback function to a system or config event.
     * @param {string} event - The event identifier name.
     * @param {Function} callback - The handler function to invoke when event triggers.
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    /**
     * Emits an event to all subscribed callback functions.
     * @param {string} event - The event identifier name.
     * @param {any} data - The payload data passed to subscribers.
     */
    emit(event, data) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => {
          try { cb(data); } catch (e) { console.error(`[ZentralCore] Event error on ${event}:`, e); }
        });
      }
    }

    /**
     * Safely retrieves a Zentral preference value, returning configured default if user pref doesn't exist.
     * @param {string} key - Preference string identifier key.
     * @param {any} [fallback] - Optional override fallback value.
     * @returns {any} The stored or fallback preference value.
     */
    getPref(key, fallback) {
      const defaultVal = this.defaultPrefs[key] !== undefined ? this.defaultPrefs[key] : fallback;
      try {
        if (!Services.prefs.prefHasUserValue(key)) return defaultVal;
        const prefType = Services.prefs.getPrefType(key);
        if (prefType === Services.prefs.PREF_BOOL) return Services.prefs.getBoolPref(key);
        if (prefType === Services.prefs.PREF_INT) return Services.prefs.getIntPref(key);
        if (prefType === Services.prefs.PREF_STRING) return Services.prefs.getStringPref(key);
      } catch (e) {
        console.warn("[ZentralCore] Config failed to read pref", key, e);
      }
      return defaultVal;
    }

    /**
     * Sets a Zentral preference value and notifies subscribers via the config event channel.
     * @param {string} key - Preference string identifier key.
     * @param {any} value - The new value to assign.
     */
    setPref(key, value) {
      try {
        if (typeof value === "number") {
          if (Number.isInteger(value)) Services.prefs.setIntPref(key, value);
          else Services.prefs.setStringPref(key, value.toString());
        }
        else if (typeof value === "string") Services.prefs.setStringPref(key, value);
        else if (typeof value === "boolean") Services.prefs.setBoolPref(key, value);
        this.emit(`config:${key}`, value);
      } catch (e) {
        console.warn("[ZentralCore] Config failed to save pref", key, e);
      }
    }


    getNativePref(key, fallback) {
      try {
        if (typeof fallback === "boolean") return Services.prefs.getBoolPref(key, fallback);
        if (typeof fallback === "number") return Number.isInteger(fallback) ? Services.prefs.getIntPref(key, fallback) : parseFloat(Services.prefs.getStringPref(key, String(fallback)));
        if (typeof fallback === "string") return Services.prefs.getStringPref(key, fallback);
      } catch (e) {
        return fallback;
      }
      return fallback;
    }
  }

  // Instantiate Core immediately
  const Core = new ZentralCore();
  if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralCore] Initialized.");
  /* ============================================================================
   * 3.0 APPS MODULE (ZentralApps)
   * ============================================================================
   */

  /**
   * Zentral Apps Module
   * Manages sidebar app grid, floating app panels, workspace isolation, and drag/drop reordering.
   */
  class ZentralApps {
    /** @private Side attribute MutationObserver */
    #sideObserver = null;
    /** @private Toolbox & theme mutation observer */
    #toolboxThemeObserver = null;
    /** @private Pref observer callback */
    #layoutObserver = null;
    /** @private ResizeObserver on sidebar */
    #resizeObs = null;
    /** @private TabSelect event listener */
    #tabSelectListener = null;
    /** @private Workspace switch event listener */
    #workspaceSwitchListener = null;
    /** @private Toolbar background observer */
    #toolbarBgObserver = null;

    /**
     * Module tear down for Sine hot unloading
     */
    destroy() {
      try {
        if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] Destroying Apps module...");
        
        // 1. Clear timers and animation frames
        if (this.#state.repositionTimer) {
          clearTimeout(this.#state.repositionTimer);
          this.#state.repositionTimer = null;
        }
        if (this.#state.closeTimerId) {
          clearTimeout(this.#state.closeTimerId);
          this.#state.closeTimerId = null;
        }
        if (this.#state.positionRafId) {
          cancelAnimationFrame(this.#state.positionRafId);
          this.#state.positionRafId = null;
        }
        if (this.#state.autohideRevealTimer) {
          clearTimeout(this.#state.autohideRevealTimer);
          this.#state.autohideRevealTimer = null;
        }
        if (this.#state.autohideCollapseTimer) {
          clearTimeout(this.#state.autohideCollapseTimer);
          this.#state.autohideCollapseTimer = null;
        }
        this.stopPositionTracking();

        // 2. Disconnect observers
        if (this.#sideObserver) {
          try { this.#sideObserver.disconnect(); } catch (_) {}
          this.#sideObserver = null;
        }
        if (this.#toolboxThemeObserver) {
          try { this.#toolboxThemeObserver.disconnect(); } catch (_) {}
          this.#toolboxThemeObserver = null;
        }
        if (this.#resizeObs) {
          try { this.#resizeObs.disconnect(); } catch (_) {}
          this.#resizeObs = null;
        }
        if (this.#layoutObserver) {
          try { Services.prefs.removeObserver("zen.view.use-single-toolbar", this.#layoutObserver); } catch (_) {}
          try { Services.prefs.removeObserver("zen.view.sidebar-expanded", this.#layoutObserver); } catch (_) {}
          this.#layoutObserver = null;
        }

        // 3. Remove window / document event listeners
        window.removeEventListener("mousedown", this.handleOutsideClick);
        if (this.#tabSelectListener) {
          window.removeEventListener("TabSelect", this.#tabSelectListener);
          this.#tabSelectListener = null;
        }
        if (this.#workspaceSwitchListener) {
          window.removeEventListener("zen-workspace-switched", this.#workspaceSwitchListener);
          window.removeEventListener("zen-workspace-changed", this.#workspaceSwitchListener);
          window.removeEventListener("zen-workspaces-change", this.#workspaceSwitchListener);
          this.#workspaceSwitchListener = null;
        }
        if (this.#toolbarBgObserver) {
          try { this.#toolbarBgObserver.disconnect(); } catch (_) {}
          this.#toolbarBgObserver = null;
        }
        document.removeEventListener("mousemove", this.onDrag);
        document.removeEventListener("mouseup", this.onStopDrag);

        // 4. Remove injected DOM elements
        const idsToRemove = [
          "zen-apps-sidebar-grid",
          "zen-apps-sidebar-styles",
          "zentral-apps-utility-section",
          "zen-app-panel-root",
          "zen-apps-autohide-trigger",
          "zen-apps-sidebar-tile-context",
          "zentral-apps-vertical-bar",
          "zentral-apps-vertical-bar-footer",
          "zentral-apps-vertical-bar-trigger",
          "context_zenAppsSidebarAdd_sep",
          "context_zenAppsSidebarAdd"
        ];
        idsToRemove.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.remove();
        });

        // 5. Clean up floating panels and browser frames
        document.querySelectorAll(".zs-app-panel, .zen-app-floating-panel, #zen-app-panel-root, #zentral-apps-vertical-bar, #zentral-apps-vertical-bar-trigger, #zentral-apps-vertical-bar-footer, #zentral-apps-utility-section").forEach(p => p.remove());
        if (this.#state && this.#state.appBrowsers) {
          this.#state.appBrowsers.forEach(b => { if (b && b.remove) b.remove(); });
          this.#state.appBrowsers.clear();
        }
        if (this.#state && this.#state.badgeSyncTimer) {
          clearInterval(this.#state.badgeSyncTimer);
          this.#state.badgeSyncTimer = null;
        }

        // 6. Reset DOM references and state
        this.#dom = {
          grid: null,
          scrollBox: null,
          autohideDots: null,
          utilitySection: null,
          utilityDots: null,
          utilityDotsVertical: null,
          utilityContent: null,
          utilityRow: null,
          utilityDivider: null,
          utilitySettingsBtn: null,
          utilityAutohideBtn: null,
          verticalBar: null,
          verticalBarTrigger: null,
          vbFooter: null,
          vbAutohideBtn: null,
          vbSettingsBtn: null,
          root: null,
          clip: null,
          panel: null,
          pill: null,
          pinBtn: null,
          expandBtn: null
        };
        this._stylesInjected = false;
        delete window.ZenApps;
      } catch(e) {
        console.error("[Zentral] Apps destroy error:", e);
      }
    }

    /**
     * 3.1 State Initialization & Internal Properties
     * @private
     */
    #state = {
      apps: [],
      utilitySlots: ["autohide", null, null, "settings"],
      activeAppId: null,
      isPinned: false,
      isExpanded: false,
      preExpandWidth: null,
      panelWidthPx: 0,
      appBrowsers: new Map(),
      positionRafId: null,
      closeTimerId: null,
      cachedScrollbarWidth: null,
      repositionTimer: null,
      utilityCollapseTimer: null,
      autohideCollapseTimer: null,
      autohideRevealTimer: null,
      badgeSyncTimer: null
    };

    /**
     * DOM element references cached for high-performance access
     * @private
     */
    #dom = {
      grid: null,
      scrollBox: null,
      autohideDots: null,
      utilitySection: null,
      utilityDots: null,
      utilityDotsVertical: null,
      utilityContent: null,
      utilityRow: null,
      utilityDivider: null,
      utilitySettingsBtn: null,
      utilityAutohideBtn: null,
      verticalBar: null,
      verticalBarTrigger: null,
      vbFooter: null,
      vbAutohideBtn: null,
      vbSettingsBtn: null,
      root: null,
      clip: null,
      panel: null,
      pill: null,
      pinBtn: null,
      expandBtn: null
    };

    /**
     * Constructs the ZentralApps instance and binds event handlers.
     */
    constructor() {
      // Binding methods to maintain 'this' context across event callbacks
      this.handleTabContextMenuCommand = this.handleTabContextMenuCommand.bind(this);
      this.handleOutsideClick = this.handleOutsideClick.bind(this);
      this.toggleExpand = this.toggleExpand.bind(this);
      this.startResize = this.startResize.bind(this);
      this.onDrag = this.onDrag.bind(this);
      this.onStopDrag = this.onStopDrag.bind(this);
      this.repositionGrid = this.repositionGrid.bind(this);
    }

    /**
     * Calculates the CSS cubic-bezier easing string for panel slide animations.
     * @private
     * @param {string} animType - Selected animation preset name (e.g. 'spring-gentle', 'elastic').
     * @returns {string} The cubic-bezier function string.
     */
    #getEasingBezier(animType) {
      switch (animType) {
        case "spring-gentle": return "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        case "spring-bouncy": return "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
        case "spring-snappy": return "cubic-bezier(0.34, 1.56, 0.64, 1)";
        case "elastic": return "cubic-bezier(0.5, 2.5, 0.4, 0.8)";
        default: return "cubic-bezier(0.22, 1, 0.36, 1)";
      }
    }

    /**
     * Initializes the Apps Module UI, preferences, event observers, and preloading timers.
     */
    init() {
      if (!Core.getPref(Constants.Apps.PREF_ENABLED)) {
        if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] Apps Grid feature is disabled.");
        return;
      }
      this.injectStyles();
      this.createContainers();
      this.loadApps();
      this.loadUtilityOrder();
      this.renderGrid();
      this.setupContextMenu();
      this.setupObservers();
      
      // Expose legacy/debug global helper
      window.ZenApps = {
        addApp: this.addApp.bind(this),
        removeApp: this.removeApp.bind(this)
      };
      
      Core.emit("appsInitComplete", this);

      // Preload apps sequentially after browser startup
      setTimeout(() => this.preloadAppsSequence(), 2000);
    }

    /**
     * Loads configured web app objects from user preferences.
     */
    loadApps() {
      try {
        const str = Core.getPref(Constants.Apps.PREF_APPS);
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          this.#state.apps = parsed.filter(a => a && typeof a.id === "string" && typeof a.url === "string");
        }
      } catch (e) {
        console.warn("[ZentralApps] Failed to load apps pref:", e);
      }
    }

    /**
     * Serializes and saves the active apps list to user preferences.
     */
    saveApps() {
      try {
        const clean = this.#state.apps.map(({ id, url, title, icon, width, preload, workspaceId }) => ({ id, url, title, icon, width, preload: !!preload, workspaceId }));
        Core.setPref(Constants.Apps.PREF_APPS, JSON.stringify(clean));
      } catch (e) {
        console.warn("[ZentralApps] Failed to save apps pref:", e);
      }
    }

    /**
     * Loads the preferred display slot positions for the Apps Grid Utility Section buttons.
     */
    loadUtilityOrder() {
      const slotCount = Constants.Apps.UTILITY_SLOTS_COUNT || 4;
      try {
        const raw = Core.getPref(Constants.Apps.PREF_UTILITY_ORDER);
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const slots = new Array(slotCount).fill(null);
          parsed.forEach((k, idx) => { if (idx < slotCount && k) slots[idx] = k; });
          const required = ["settings", "autohide"];
          required.forEach(reqKey => {
            if (!slots.includes(reqKey)) {
              const emptyIdx = slots.indexOf(null);
              if (emptyIdx > -1) slots[emptyIdx] = reqKey;
              else slots[0] = reqKey;
            }
          });
          this.#state.utilitySlots = slots;
          return;
        }
      } catch (e) {
        console.warn("[ZentralApps] Failed to load utility order pref:", e);
      }
      const defaultSlots = new Array(slotCount).fill(null);
      defaultSlots[0] = "autohide";
      defaultSlots[3] = "settings";
      this.#state.utilitySlots = defaultSlots;
    }

    /**
     * Persists the preferred display slot positions for the Apps Grid Utility Section buttons.
     */
    saveUtilityOrder() {
      try {
        Core.setPref(Constants.Apps.PREF_UTILITY_ORDER, JSON.stringify(this.#state.utilitySlots));
      } catch (e) {
        console.warn("[ZentralApps] Failed to save utility order pref:", e);
      }
    }

    /**
     * Sequentially preloads browser background instances for apps configured with preload enabled.
     * Uses staggered delays to prevent startup performance hits.
     */
    async preloadAppsSequence() {
      const preloadedApps = this.#state.apps.filter(a => a.preload === true);
      for (const app of preloadedApps) {
        const { browser, isNew } = this.getOrCreateAppBrowser(app);
        if (isNew) {
          try {
            const uri = Services.io.newURI(app.url);
            if (typeof browser.fixupAndLoadURIString === "function") {
              browser.fixupAndLoadURIString(app.url, { triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(uri, {}) });
            } else {
              browser.loadURI(uri, { triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(uri, {}) });
            }
          } catch (e) { console.error("[ZentralApps] Preload failed:", e); }
        }
        // Stagger preloads by 1.5 seconds to minimize main thread blocking
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    /**
     * Retrieves stored panel width or calculates fallback based on window proportion.
     * @returns {number} Panel width in pixels.
     */
    loadWidth() {
      let width = Core.getPref(Constants.Apps.PREF_WIDTH);
      return Math.max(Constants.Apps.MIN_WIDTH_PX, width || (window.innerWidth * 0.333));
    }

    /**
     * Persists custom panel width for active app object.
     * @param {number} px - Panel width in pixels.
     */
    saveWidth(px) {
      if (this.#state.activeAppId) {
        const app = this.#state.apps.find(a => a.id === this.#state.activeAppId);
        if (app) app.width = px;
        this.saveApps();
      }
    }

    /* --------------------------------------------------------------------------
     * 3.3 Layout & Sidebar Position Detection
     * --------------------------------------------------------------------------
     */

    /**
     * Determines whether the sidebar is positioned on the right side of the browser window.
     * @returns {boolean} True if sidebar is on the right side.
     */
    isSidebarRight() {
      // 1. Direct Zen root attributes
      if (document.documentElement.getAttribute("zen-right-side") === "true") return true;
      if (document.documentElement.getAttribute("zen-sidebar-right") === "true") return true;
      if (document.documentElement.getAttribute("zen-right-side") === "false") return false;
      if (document.documentElement.getAttribute("zen-sidebar-right") === "false") return false;

      // 2. Physical DOM measurement of the sidebar container
      const sidebarBox = document.getElementById("sidebar-box") ||
                         document.getElementById("sidebar-container") ||
                         document.getElementById("vertical-tabs");
      if (sidebarBox && sidebarBox.isConnected) {
        const rect = sidebarBox.getBoundingClientRect();
        if (rect.width > 0) {
          return (rect.left + rect.width / 2) > (window.innerWidth / 2);
        }
      }

      // 3. Fallback preferences
      if (Core.getNativePref("zen.tabs.vertical.right-side", false)) return true;
      if (Core.getNativePref("zen.view.sidebar-right", false)) return true;
      if (Core.getNativePref("zen.view.sidebar-on-right", false)) return true;

      return false;
    }

    /**
     * Determines whether the Apps grid is configured to be placed in the opposite Vertical Bar.
     * @returns {boolean} True if apps placement is set to 'vertical-bar'.
     */
    isPlacementVerticalBar() {
      return Core.getPref(Constants.Apps.PREF_PLACEMENT, "sidebar") === "vertical-bar";
    }

    /**
     * Determines whether the opposite Vertical Bar is on the right side of the screen.
     * (Attached to the screen edge opposite to the native Zen sidebar).
     * @returns {boolean} True if the Vertical Bar is on the right.
     */
    isVerticalBarOnRight() {
      return !this.isSidebarRight();
    }

    /**
     * Determines whether the active floating app panel should attach to and slide from the right.
     * @returns {boolean} True if panel attaches to the right edge.
     */
    isPanelAttachedToRight() {
      if (this.isPlacementVerticalBar()) {
        return this.isVerticalBarOnRight();
      }
      return this.isSidebarRight();
    }

    /**
     * Determines whether the Zen sidebar is currently collapsed.
     * @returns {boolean} True if sidebar is collapsed.
     */
    isCollapsedSidebar() {
      // Fully delegate to the single authoritative collapse-detection method.
      // Previously this method duplicated zen-sidebar-collapsed + sidebar-expanded pref reads
      // that isPhysicallySidebarCollapsed() already handles — removed duplication (Q-05).
      return this.isPhysicallySidebarCollapsed();
    }





    /**
     * Determines whether Zen Browser is using the "Collapsed Sidebar" layout mode (horizontal apps bar in top toolbar).
     * This includes:
     *   - sidebar-expanded pref false (traditional collapsed layout)
     *   - Compact Mode active (sidebar-expanded=true but physically collapsed/thin)
     *   - zen-sidebar-collapsed DOM attribute set
     * @returns {boolean} True if in Collapsed Sidebar layout mode.
     */
    isCollapsedLayoutMode() {
      if (this.#dom.grid?.classList.contains("zen-apps-horizontal")) return true;
      if (this.isPhysicallySidebarCollapsed()) return true;
      const useSingleToolbar = Core.getNativePref("zen.view.use-single-toolbar", true);
      const sidebarExpanded = Core.getNativePref("zen.view.sidebar-expanded", true);
      return !useSingleToolbar && !sidebarExpanded;
    }

    /**
     * Checks physical sidebar state via DOM attributes and pixel width.
     * Handles both Collapsed Sidebar mode and Compact Mode (sidebar-expanded=true but visually thin/hidden).
     * @returns {boolean} True if the sidebar is physically not expanded.
     */
    isPhysicallySidebarCollapsed() {
      // DOM attribute set by Zen in Collapsed Sidebar mode
      const collapsedAttr = document.documentElement.getAttribute("zen-sidebar-collapsed");
      if (collapsedAttr === "true") return true;

      // Compact mode: sidebar is visually collapsed but pref says expanded.
      // Detect by measuring physical width of the tab/sidebar container.
      const sidebarBox = document.getElementById("tabbrowser-tabbox") ||
                         document.getElementById("sidebar-box") ||
                         document.getElementById("sidebar-container") ||
                         gBrowser?.tabContainer;
      if (sidebarBox) {
        const rect = sidebarBox.getBoundingClientRect();
        // Sidebar is considered collapsed if its width is narrower than COLLAPSED_WIDTH_THRESHOLD
        const T = Constants.Apps.COLLAPSED_WIDTH_THRESHOLD;
        if (rect.width > 0 && rect.width < T) return true;
        if (rect.width === 0) return true;
      }

      // Also check via single-toolbar indicator
      const useSingleToolbar = Core.getNativePref("zen.view.use-single-toolbar", true);
      if (useSingleToolbar) return false; // Single toolbar = expanded layout

      const sidebarExpanded = Core.getNativePref("zen.view.sidebar-expanded", true);
      if (!sidebarExpanded) return true;

      return false;
    }

    /* --------------------------------------------------------------------------
     * 3.2 CSS Style Injection (Constructable Stylesheets)
     * --------------------------------------------------------------------------
     */

    /**
     * Injects CSS styling for grid, tiles, badges, floating panel slider, and pills.
     */
    injectStyles() {
      if (document.getElementById("zen-apps-sidebar-styles") || this._stylesInjected) return;
      this._stylesInjected = true;
      const css = `
        /* Morphing Autohide Apps Grid */
        #zen-apps-sidebar-grid .zen-apps-autohide-dots {
          display: none;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(1);
          align-items: center;
          justify-content: center;
          gap: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.20s ease, transform 0.24s cubic-bezier(0.25, 1, 0.5, 1);
          z-index: 5;
        }
        #zen-apps-sidebar-grid .zen-apps-autohide-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: currentColor;
          opacity: 0.65;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        #zen-apps-sidebar-grid:hover .zen-apps-autohide-dot {
          opacity: 1;
        }

        /* When Autohide is active in expanded vertical sidebar */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal) {
          min-height: 22px;
          max-height: 22px;
          padding: 0 10px !important;
          cursor: pointer;
          overflow: hidden !important;
          border-radius: var(--toolbarbutton-border-radius, 6px);
          position: relative !important;
          background-color: transparent;
          will-change: max-height, padding, background-color;
          transition: max-height 0.24s cubic-bezier(0.25, 1, 0.5, 1),
                      padding 0.24s cubic-bezier(0.25, 1, 0.5, 1),
                      background-color 0.18s ease !important;
        }

        /* Scrollbox grid layout in Vertical Sidebar */
        :root:not([zentral-apps-placement="vertical-bar"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-apps-scroll-box {
          display: grid !important;
          grid-template-columns: repeat(var(--zentral-grid-cols, 7), minmax(0, 1fr)) !important;
          justify-items: center !important;
          align-items: center !important;
          gap: 6px !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          max-height: calc(var(--zentral-max-rows, 3) * 42px - 2px) !important;
          overflow-y: auto !important;
          scrollbar-width: none !important;
          margin: 0 !important;
          padding: 4px 2px !important;
        }
        #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-apps-scroll-box::-webkit-scrollbar {
          display: none !important;
        }

        /* Collapsed Strip State: Show 3 dots, hide all inner tiles and utility with Vertical Bar transition */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) {
          background: transparent;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) .zen-apps-autohide-dots {
          display: flex !important;
          opacity: 0.75;
          transform: translate(-50%, -50%);
          transition: opacity 0.20s ease, transform 0.24s cubic-bezier(0.25, 1, 0.5, 1);
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]):hover .zen-apps-autohide-dots {
          opacity: 1;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) #zentral-apps-utility-section,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) .zen-app-add-btn {
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
          transition: opacity 0.20s ease, visibility 0.24s ease !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) #zentral-apps-utility-section {
          max-height: 0 !important;
          overflow: hidden !important;
        }

        /* Expanded Grid State: Hide 3 dots, reveal the solid single-piece grid with exact dimensions */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"],
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) {
          max-height: calc(var(--zentral-apps-grid-expanded-height, 180px) + 8px) !important;
          padding: 6px 10px !important;
          margin: 0 !important;
          overflow: visible !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-apps-autohide-dots,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-apps-autohide-dots,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-apps-autohide-dots {
          opacity: 0 !important;
          transform: translate(-50%, -50%) scale(0.8) !important;
          pointer-events: none !important;
          transition: opacity 0.18s ease, transform 0.24s cubic-bezier(0.25, 1, 0.5, 1) !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] #zentral-apps-utility-section,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover #zentral-apps-utility-section,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) #zentral-apps-utility-section {
          display: flex !important;
          opacity: 1 !important;
          max-height: 40px !important;
          pointer-events: auto !important;
          visibility: visible !important;
          overflow: visible !important;
          transition: opacity 0.20s ease, visibility 0.24s ease !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-app-add-btn,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-app-add-btn,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-app-add-btn {
          display: flex !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          visibility: visible !important;
          transition: opacity 0.20s ease, visibility 0.24s ease !important;
        }

        /* Scoped to expanded / revealed state only in autohide */
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zentral-apps-utility-content,
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zentral-apps-utility-content,
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[zentral-app-panel-open="true"] .zentral-apps-utility-content {
          max-height: 38px !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          overflow: visible !important;
          margin-bottom: 2px !important;
        }
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zentral-apps-utility-divider,
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zentral-apps-utility-divider,
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[zentral-app-panel-open="true"] .zentral-apps-utility-divider {
          display: block !important;
          opacity: 0.5 !important;
          transform: none !important;
        }
        :root[zentral-apps-autohide="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zentral-apps-utility-dots {
          display: none !important;
        }

        /* ==========================================================================
         * Zentral Apps Utility Section
         * ========================================================================== */
        #zentral-apps-utility-section {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          box-sizing: border-box !important;
          position: relative !important;
          margin: 0 0 2px 0 !important;
          padding: 0 !important;
          z-index: 12 !important;
          user-select: none !important;
          grid-column: 1 / -1 !important;
        }

        /* 3 Horizontal Dots Trigger Strip (Vertical Sidebar mode) */
        .zentral-apps-utility-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3.5px;
          width: 100%;
          height: 8px;
          min-height: 8px;
          cursor: pointer;
          opacity: 0.65;
          transition: opacity 0.18s ease;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          order: 0;
        }

        .zentral-apps-utility-dots:hover {
          opacity: 1;
        }

        .zentral-apps-utility-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background-color: currentColor;
          opacity: 0.75;
        }

        /* Vertical 3 dots trigger (for Horizontal Toolbar mode) */
        .zentral-apps-utility-dots-vertical {
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3.5px;
          width: 10px;
          height: 28px;
          cursor: pointer;
          opacity: 0.65;
          transition: opacity 0.2s ease;
          padding: 0 2px;
          box-sizing: border-box;
          flex-shrink: 0;
          order: 0;
        }

        .zentral-apps-utility-dots-vertical:hover {
          opacity: 1;
        }

        .zentral-apps-utility-dots-vertical:hover .zentral-apps-utility-dot {
          opacity: 1;
          transform: scale(1.2);
        }

        /* Utility Content Row & Single-Piece Slide Transition */
        .zentral-apps-utility-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          transform: translateY(-8px);
          order: 1;
          will-change: max-height, opacity, transform;
          transition: max-height 0.24s cubic-bezier(0.25, 1, 0.5, 1),
                      opacity 0.20s ease,
                      transform 0.24s cubic-bezier(0.25, 1, 0.5, 1),
                      visibility 0.24s ease;
        }

        .zentral-apps-utility-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          justify-items: center;
          align-items: center;
          width: 100%;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        }

        /* Utility Slot (Grid Column Cell) */
        .zentral-utility-slot {
          width: 100%;
          height: 28px;
          min-height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
          border-radius: var(--toolbarbutton-border-radius, 6px);
          transition: background-color 0.15s ease;
        }

        .zentral-utility-slot.zentral-utility-slot-dragover {
          background-color: color-mix(in srgb, var(--zen-primary-color, currentColor) 20%, transparent);
          outline: 1px dashed var(--zen-primary-color, currentColor);
          outline-offset: -1px;
        }

        /* 28px Buttons */
        .zentral-utility-btn {
          width: 28px !important;
          height: 28px !important;
          min-width: 28px !important;
          min-height: 28px !important;
          max-width: 28px !important;
          max-height: 28px !important;
          padding: 0 !important;
          border-radius: var(--toolbarbutton-border-radius, 6px) !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          color: inherit !important;
          opacity: 0.85 !important;
          flex-shrink: 0 !important;
          transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease !important;
        }

        .zentral-utility-btn:hover {
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 14%, transparent)) !important;
          opacity: 1 !important;
        }

        .zentral-utility-btn:active {
          transform: scale(0.94) !important;
        }

        .zentral-utility-btn svg {
          width: 16px !important;
          height: 16px !important;
          pointer-events: none !important;
        }

        /* Morphing Divider Line (Lighter color) */
        .zentral-apps-utility-divider {
          width: calc(100% - 16px);
          height: 1px;
          background-color: color-mix(in srgb, currentColor 12%, transparent);
          margin: 2px auto 3px auto;
          pointer-events: none;
          order: 2;
        }

        /* When Hidden in Autohide OFF: Divider takes 0 space */
        :root:not([zentral-apps-autohide="true"]) #zentral-apps-utility-section:not([data-utility-revealed="true"]) .zentral-apps-utility-divider {
          display: none !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* When Revealed (Autohide OFF): Dots disappear, Content slides down as a single piece */
        #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-dots {
          display: none !important;
        }

        #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-content {
          max-height: 38px !important;
          opacity: 1 !important;
          transform: translateY(0) !important;
          pointer-events: auto !important;
          visibility: visible !important;
          overflow: visible !important;
          margin-bottom: 2px !important;
        }

        #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-divider {
          display: block !important;
          opacity: 0.5 !important;
        }

        /* While grid is collapsed in autohide, utility section is hidden with the grid */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) #zentral-apps-utility-section {
          opacity: 0 !important;
          pointer-events: none !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }

        /* Eye open/closed visibility for utility autohide button */
        :root[zentral-apps-autohide="true"] #zentral-utility-autohide-btn .zs-eye-open {
          display: none !important;
        }
        :root[zentral-apps-autohide="true"] #zentral-utility-autohide-btn .zs-eye-closed {
          display: block !important;
        }
        :root:not([zentral-apps-autohide="true"]) #zentral-utility-autohide-btn .zs-eye-open {
          display: block !important;
        }
        :root:not([zentral-apps-autohide="true"]) #zentral-utility-autohide-btn .zs-eye-closed {
          display: none !important;
        }

        /* Horizontal Toolbar Mode Styling */
        .zen-apps-horizontal #zentral-apps-utility-section {
          flex-direction: row !important;
          align-items: center !important;
          width: auto !important;
          height: 100% !important;
          margin: 0 0 0 2px !important;
          grid-column: auto !important;
          flex-shrink: 0 !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-apps-utility-dots {
          display: none !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-apps-utility-dots-vertical {
          display: flex !important;
          order: 0 !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-apps-utility-divider {
          width: 1px !important;
          height: 16px !important;
          margin: 0 4px 0 2px !important;
          background-color: color-mix(in srgb, currentColor 12%, transparent) !important;
          opacity: 0 !important;
          transform: scaleY(0) !important;
          transform-origin: center !important;
          order: 1 !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-apps-utility-content {
          order: 2 !important;
          flex-direction: row !important;
          max-height: 100% !important;
          max-width: 0 !important;
          width: auto !important;
          transform: translateX(-4px) !important;
          transition: max-width 0.24s cubic-bezier(0.25, 1, 0.5, 1),
                      opacity 0.2s ease,
                      transform 0.22s cubic-bezier(0.25, 1, 0.5, 1) !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-apps-utility-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          padding: 0 !important;
          width: auto !important;
          gap: 4px !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section .zentral-utility-slot {
          width: auto !important;
          height: auto !important;
          min-height: 0 !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-dots-vertical {
          display: none !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-divider {
          opacity: 0.5 !important;
          transform: scaleY(1) !important;
        }

        .zen-apps-horizontal #zentral-apps-utility-section[data-utility-revealed="true"] .zentral-apps-utility-content {
          max-width: 36px !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translateX(0) !important;
        }

        .zen-apps-horizontal #zentral-utility-autohide-btn {
          display: none !important;
        }

        /* Hide Utility Section in Vertical Bar placement mode (VB uses its footer) */
        :root[zentral-apps-placement="vertical-bar"] #zentral-apps-utility-section {
          display: none !important;
        }

        #zen-apps-sidebar-grid { display: flex; flex-direction: column; align-items: center; padding: 4px 10px 0px 10px; margin: 0; width: 100%; box-sizing: border-box; position: relative; z-index: 10; overflow: visible; }
        #zen-apps-sidebar-grid::-webkit-scrollbar { display: none; }
        .zen-apps-scroll-box { display: grid; grid-template-columns: repeat(var(--zentral-grid-cols, 7), minmax(0, 1fr)); justify-items: center; align-items: center; gap: 6px; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; max-height: calc(var(--zentral-max-rows, 3) * 42px - 2px); overflow-y: auto; scrollbar-width: none; margin: 0; padding: 0; }
        .zen-apps-scroll-box::-webkit-scrollbar { display: none; }
        #zen-apps-sidebar-grid.zen-apps-horizontal { display: flex; flex-direction: row; padding: 0 2px; gap: 2px; width: auto; align-items: center; -moz-window-dragging: no; position: relative; flex-shrink: 1 !important; min-width: 0 !important; margin-left: auto !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box { display: flex; flex-direction: row; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; width: max-content; max-width: calc(10 * 38px + 9 * 4px) !important; scroll-behavior: smooth; -moz-window-dragging: no; flex-shrink: 1 !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box::-webkit-scrollbar { display: none; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-app-tile { width: 38px !important; min-width: 38px !important; max-width: 38px !important; height: 28px !important; padding: 0 !important; aspect-ratio: auto; border-radius: var(--toolbarbutton-border-radius, 6px); flex-shrink: 0 !important; }
        .zen-app-tile { position: relative; appearance: none; border: none; width: 100%; height: auto; aspect-ratio: 1 / 1; max-width: 36px; max-height: 36px; border-radius: var(--toolbarbutton-border-radius, 8px); background-color: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease; padding: 0; margin: 0; overflow: visible; -moz-window-dragging: no-drag; pointer-events: auto !important; }
        .zen-app-tile:hover { background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 10%, transparent)) !important; }
        .zen-app-tile:active { transform: scale(0.95); }
        .zen-app-tile[data-active="true"] { background-color: color-mix(in srgb, var(--zen-primary-color, #707ac2) 36%, rgba(255, 255, 255, 0.18)) !important; border: 1.5px solid color-mix(in srgb, var(--zen-primary-color, #707ac2) 75%, rgba(255, 255, 255, 0.4)) !important; box-shadow: 0 0 10px color-mix(in srgb, var(--zen-primary-color, #707ac2) 40%, transparent), 0 1px 3px rgba(0, 0, 0, 0.2) !important; }
        .zen-app-tile[data-active="true"] img, .zen-app-tile[data-active="true"] svg { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 4px color-mix(in srgb, var(--zen-primary-color, #707ac2) 60%, transparent)) !important; }
        .zen-app-tile img { width: 18px; height: 18px; object-fit: contain; pointer-events: none; border-radius: 4px; image-rendering: -webkit-optimize-contrast; }
        .zen-app-add-btn { background-color: transparent; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); opacity: 0.7; flex-shrink: 0 !important; }
        .zen-app-add-btn:hover { opacity: 1; border-style: solid; }
        .zen-app-add-btn svg { width: 16px; height: 16px; pointer-events: none; }
        .zen-app-badge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px; background-color: #ff3b30; color: #ffffff; font-size: 9px; font-weight: 700; line-height: 14px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3); pointer-events: none; z-index: 10; box-sizing: border-box; }
        .zen-app-badge[data-dot="true"] { min-width: 8px; width: 8px; height: 8px; padding: 0; border-radius: 50%; top: 3px; right: 3px; font-size: 0; }

        #zen-app-panel-root { position: fixed; display: none; pointer-events: none; overflow: visible; z-index: 2147483600 !important; }
        #zen-app-panel-root[open] { display: block; }
        #zen-app-panel-root:not([open]) #zen-app-panel-slider, #zen-app-panel-root[closing] #zen-app-panel-slider { box-shadow: none !important; }
        #zen-app-panel-clip { position: absolute; inset: 0; overflow: hidden; border-radius: var(--zen-border-radius, 8px); pointer-events: none; }
        #zen-app-panel-slider { position: absolute; inset: 0; display: flex; flex-direction: column; border-radius: inherit; overflow: hidden; background: var(--tabpanels-background-color, #1e1e24); border: 1px solid color-mix(in srgb, var(--zen-primary-color, currentColor) 25%, rgba(255, 255, 255, 0.14)); box-sizing: border-box; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.30); pointer-events: auto; will-change: transform; }
        #zen-app-panel-pill { position: absolute; top: 50%; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 4px; border-radius: 14px; background: var(--zen-colors-tertiary, var(--zen-colors-secondary, var(--zen-primary-color, light-dark(#f4b4b4, #362929)))); color: var(--zen-colors-tertiary-text, light-dark(#18181b, #f4f4f5)); border: 1px solid color-mix(in srgb, currentColor 12%, transparent); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35); z-index: 20; opacity: 0; transition: opacity 0.2s ease 0.3s; pointer-events: none; }
        #zen-app-panel-root:not([open]) #zen-app-panel-pill, #zen-app-panel-root[closing] #zen-app-panel-pill { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        :root[zen-right-side="true"] #zen-app-panel-pill { left: 0; transform: translate(-50%, -50%); }
        :root:not([zen-right-side="true"]) #zen-app-panel-pill { right: 0; transform: translate(50%, -50%); }
        #zen-app-panel-root[data-panel-side="right"] #zen-app-panel-pill { left: 0 !important; right: auto !important; transform: translate(-50%, -50%) !important; }
        #zen-app-panel-root[data-panel-side="left"] #zen-app-panel-pill { right: 0 !important; left: auto !important; transform: translate(50%, -50%) !important; }

        .zen-app-hover-zone { position: absolute; top: 0; bottom: 0; width: 44px; z-index: 10; pointer-events: none; background: transparent; }
        #zen-app-panel-root[open] .zen-app-hover-zone { pointer-events: auto; }
        :root[zen-right-side="true"] .zen-app-hover-zone { left: -22px; right: auto; }
        :root:not([zen-right-side="true"]) .zen-app-hover-zone { right: -22px; left: auto; }
        #zen-app-panel-root[data-panel-side="right"] .zen-app-hover-zone { left: -22px !important; right: auto !important; }
        #zen-app-panel-root[data-panel-side="left"] .zen-app-hover-zone { right: -22px !important; left: auto !important; }

        .zen-app-hover-zone:hover ~ #zen-app-panel-pill, #zen-app-panel-pill:hover, .zen-app-resize-strip:hover ~ #zen-app-panel-pill { opacity: 1; pointer-events: auto; transition-delay: 0s; }
        .zen-app-btn { appearance: none; background: transparent; border: none; border-radius: 8px; color: inherit; padding: 4px; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.15s ease; }
        .zen-app-btn:hover { background-color: color-mix(in srgb, currentColor 15%, transparent); }
        .zen-app-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; display: block; }
        .zen-app-btn[data-pinned="true"] { background-color: color-mix(in srgb, currentColor 20%, transparent); }
        .zen-app-btn[data-pinned="true"] svg { fill: currentColor; stroke: currentColor; stroke-width: 0.5; }
        .zen-app-close-btn { color: #ff4d4d !important; }
        .zen-app-close-btn:hover { background-color: rgba(255, 77, 77, 0.22) !important; color: #ff6666 !important; }
        .zen-app-close-btn svg { stroke: #ff4d4d !important; stroke-width: 2 !important; }
        .zen-app-close-btn:hover svg { stroke: #ff6666 !important; }
        .zen-app-grabber { cursor: ew-resize; padding: 4px 2px; width: 26px; height: 24px; display: flex; align-items: center; justify-content: center; color: inherit; border-radius: 8px; user-select: none; transition: background-color 0.15s ease; }
        .zen-app-grabber:hover { background-color: color-mix(in srgb, currentColor 15%, transparent); }
        .zen-app-grabber svg { width: 10px; height: 14px; fill: currentColor; stroke: none; display: block; }
        .zen-app-resize-strip { position: absolute; top: 0; bottom: 0; width: 10px; cursor: ew-resize; z-index: 15; background: transparent; pointer-events: none; }
        #zen-app-panel-root[open] .zen-app-resize-strip { pointer-events: auto; }
        :root[zen-right-side="true"] .zen-app-resize-strip { left: -5px; right: auto; }
        :root:not([zen-right-side="true"]) .zen-app-resize-strip { right: -5px; left: auto; }
        #zen-app-panel-root[data-panel-side="right"] .zen-app-resize-strip { left: -5px !important; right: auto !important; }
        #zen-app-panel-root[data-panel-side="left"] .zen-app-resize-strip { right: -5px !important; left: auto !important; }

        /* ==========================================================================
         * Zentral Apps Vertical Bar
         * ========================================================================== */
        #zentral-apps-vertical-bar {
          display: none !important;
        }

        /* Base style */
        :root[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar {
          min-height: 0 !important;
          max-height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          box-sizing: border-box !important;
          color: var(--zen-colors-text, var(--arrowpanel-color, inherit)) !important;
          padding: 8px 0 !important;
          gap: 6px !important;
          overflow: hidden !important;
          user-select: none !important;
          border: none !important;
        }

        /* Mode A: Autohide DISABLED (Pinned / Docked into Frame) */
        :root[zentral-apps-placement="vertical-bar"]:not([zentral-apps-autohide="true"]) #zentral-apps-vertical-bar {
          position: relative !important;
          width: 44px !important;
          min-width: 44px !important;
          max-width: 44px !important;
          height: calc(100% - var(--zen-element-separation, 8px) * 2) !important;
          max-height: calc(100% - var(--zen-element-separation, 8px) * 2) !important;
          min-height: 0 !important;
          flex: 0 0 44px !important;
          flex-shrink: 0 !important;
          z-index: 10 !important;
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          border: none !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          transform: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          padding: 8px 4px !important;
          margin-top: var(--zen-element-separation, 8px) !important;
          margin-bottom: var(--zen-element-separation, 8px) !important;
          transition: width 0.22s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease !important;
        }

        /* Outer margin matching Zen's element separation for exact visual symmetry */
        :root[zentral-apps-placement="vertical-bar"]:not([zentral-apps-autohide="true"])[zen-right-side="true"] #zentral-apps-vertical-bar,
        :root[zentral-apps-placement="vertical-bar"]:not([zentral-apps-autohide="true"])[zen-sidebar-right="true"] #zentral-apps-vertical-bar {
          margin-left: var(--zen-element-separation, 8px) !important;
          margin-right: 0 !important;
        }

        :root[zentral-apps-placement="vertical-bar"]:not([zentral-apps-autohide="true"]):not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar {
          margin-right: var(--zen-element-separation, 8px) !important;
          margin-left: 0 !important;
        }

        :root[zentral-apps-placement="vertical-bar"]:not([zentral-apps-autohide="true"]) #zentral-apps-vertical-bar #zen-apps-sidebar-grid {
          padding: 0 !important;
        }

        /* Mode B: Autohide ENABLED (Compact Floating Panel) */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar {
          position: fixed !important;
          width: 48px !important;
          min-width: 48px !important;
          max-width: 48px !important;
          z-index: 2147483500 !important;
          background-color: color-mix(in srgb, var(--zen-primary-color, rgb(112, 122, 194)) 14%, var(--zen-colors-base, rgb(19, 19, 19))) !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          box-shadow: var(--zen-big-shadow, rgba(0, 0, 0, 0.24) 0px 3px 8px 0px) !important;
          border: 1px solid color-mix(in srgb, var(--zen-primary-color, rgb(112, 122, 194)) 25%, transparent) !important;
          backdrop-filter: blur(24px) saturate(130%) !important;
          transition: transform 0.25s cubic-bezier(0.075, 0.82, 0.165, 1), opacity 0.15s ease, visibility 0.25s ease, top 0.18s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.25s ease, border-color 0.25s ease !important;
          will-change: transform, opacity;
          overflow: visible !important;
          padding: 8px 5px !important;
          box-sizing: border-box !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar #zen-apps-sidebar-grid {
          padding: 0 !important;
        }

        /* Zen Theme Wallpaper / Gradient Layer */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -2 !important;
          border-radius: inherit !important;
          background-image: var(--zen-theme-gradient-override, radial-gradient(circle at top, color-mix(in srgb, var(--zen-primary-color, transparent) 30%, transparent) 0%, transparent 85%)) !important;
          background-size: 100% 100% !important;
          background-repeat: no-repeat !important;
          background-position: center top !important;
          pointer-events: none !important;
          transition: background-image 0.25s ease !important;
        }

        /* Zen Film Grain Texture Layer */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -1 !important;
          border-radius: inherit !important;
          background-image: url("chrome://browser/content/zen-images/grain-bg.png") !important;
          background-repeat: repeat !important;
          opacity: 0.7 !important;
          pointer-events: none !important;
        }

        /* Autohide Mode B: Position on Left (Sidebar on Right) */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-right-side="true"] #zentral-apps-vertical-bar,
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] #zentral-apps-vertical-bar {
          left: 8px !important;
          right: auto !important;
        }

        /* Autohide Mode B: Position on Right (Sidebar on Left) */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar {
          right: 8px !important;
          left: auto !important;
        }

        /* Autohide Mode B: Idle/Collapsed State on Left */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-right-side="true"] #zentral-apps-vertical-bar:not([data-revealed="true"]):not([zentral-app-panel-open="true"]),
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] #zentral-apps-vertical-bar:not([data-revealed="true"]):not([zentral-app-panel-open="true"]) {
          transform: translateX(calc(-100% - 16px)) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        /* Autohide Mode B: Idle/Collapsed State on Right */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar:not([data-revealed="true"]):not([zentral-app-panel-open="true"]) {
          transform: translateX(calc(100% + 16px)) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        /* Autohide Mode B: Revealed State on Hover / Active Panel */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar[data-revealed="true"],
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar[zentral-app-panel-open="true"] {
          transform: translateX(0) !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          visibility: visible !important;
        }

        #zen-app-panel-root { position: fixed; display: none; pointer-events: none; overflow: visible; z-index: 2147483600 !important; }
        #zen-app-panel-root[open] { display: block; }

        #zentral-apps-vertical-bar #zen-apps-sidebar-grid {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: 0 !important;
          flex: 1 1 0px !important;
          padding: 0 !important;
          max-height: 100% !important;
          min-height: 0 !important;
          gap: 6px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: none !important;
          background: transparent !important;
          box-sizing: border-box !important;
        }

        #zentral-apps-vertical-bar #zen-apps-sidebar-grid::-webkit-scrollbar {
          display: none !important;
        }

        #zentral-apps-vertical-bar #zen-apps-sidebar-grid .zen-apps-scroll-box {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 6px !important;
          width: 100% !important;
          height: auto !important;
          min-height: min-content !important;
          max-height: none !important;
          flex-shrink: 0 !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        #zentral-apps-vertical-bar-footer {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          gap: 6px !important;
          padding: 4px 0 0 0 !important;
          box-sizing: border-box !important;
          margin-top: auto !important;
          z-index: 10 !important;
        }

        #zentral-apps-vertical-bar .zen-app-tile,
        #zentral-apps-vertical-bar .zen-app-add-btn,
        #zentral-apps-vertical-bar .zen-app-vb-footer-btn {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
          flex-shrink: 0 !important;
          overflow: visible !important;
        }

        #zentral-apps-vertical-bar .zen-app-vb-footer-btn svg {
          width: 18px !important;
          height: 18px !important;
          pointer-events: none !important;
        }

        :root[zentral-apps-autohide="true"] #zentral-apps-vb-autohide-btn .zs-eye-open {
          display: none !important;
        }
        :root[zentral-apps-autohide="true"] #zentral-apps-vb-autohide-btn .zs-eye-closed {
          display: block !important;
        }
        :root:not([zentral-apps-autohide="true"]) #zentral-apps-vb-autohide-btn .zs-eye-open {
          display: block !important;
        }
        :root:not([zentral-apps-autohide="true"]) #zentral-apps-vb-autohide-btn .zs-eye-closed {
          display: none !important;
        }

        /* Autohide Mode B: Tile Button Enhancements (Scoped ONLY to autohide mode) */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          background-color: color-mix(in srgb, currentColor 8%, transparent) !important;
          border: none !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          flex-shrink: 0 !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          color: inherit !important;
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile img,
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile svg {
          width: 18px !important;
          height: 18px !important;
          object-fit: contain !important;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4)) !important;
          transition: transform 0.15s ease, filter 0.15s ease !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile:hover {
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 14%, transparent)) !important;
          border: none !important;
          transform: translateY(-1px) scale(1.04) !important;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile:hover img,
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile:hover svg {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile:active {
          transform: scale(0.96) !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile[data-active="true"] {
          background-color: color-mix(in srgb, var(--zen-primary-color, #707ac2) 32%, var(--zen-colors-base, #131313)) !important;
          border: none !important;
          box-shadow: 0 0 0 1px var(--zen-primary-color, #707ac2), 0 2px 8px rgba(0, 0, 0, 0.25) !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-add-btn {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          background-color: color-mix(in srgb, currentColor 8%, transparent) !important;
          border: 1.5px dashed color-mix(in srgb, currentColor 25%, transparent) !important;
          opacity: 0.85 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          flex-shrink: 0 !important;
          color: inherit !important;
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-add-btn:hover {
          opacity: 1 !important;
          border-style: solid !important;
          border-color: var(--zen-primary-color, currentColor) !important;
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 15%, transparent)) !important;
          transform: translateY(-1px) scale(1.04) !important;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-add-btn:active {
          transform: scale(0.96) !important;
        }

        /* Default / Non-autohide Vertical Bar (Clean standard tile styling) */
        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          flex-shrink: 0 !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          color: inherit !important;
          margin: 0 auto !important;
        }

        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile:hover {
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 10%, transparent)) !important;
        }

        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile[data-active="true"] {
          background-color: var(--toolbarbutton-active-background, color-mix(in srgb, currentColor 15%, transparent)) !important;
        }

        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-add-btn {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          border-radius: var(--zen-border-radius, 8px) !important;
          background-color: transparent !important;
          border: 1px dashed color-mix(in srgb, currentColor 30%, transparent) !important;
          opacity: 0.7 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          box-shadow: none !important;
          flex-shrink: 0 !important;
          color: inherit !important;
          margin: 0 auto !important;
          transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease !important;
        }

        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-add-btn:hover {
          opacity: 1 !important;
          border-style: solid !important;
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 10%, transparent)) !important;
          box-shadow: none !important;
        }

        #zentral-apps-vertical-bar .zen-apps-autohide-dots {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        #zentral-apps-vertical-bar-trigger {
          display: none !important;
        }

        :root[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar-trigger {
          display: block !important;
          position: fixed !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 1px !important;
          z-index: 2147483550 !important;
          pointer-events: auto !important;
          background: transparent !important;
        }

        :root[zentral-apps-placement="vertical-bar"][zen-right-side="true"] #zentral-apps-vertical-bar-trigger,
        :root[zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] #zentral-apps-vertical-bar-trigger {
          left: 0 !important;
          right: auto !important;
        }

        :root[zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar-trigger {
          right: 0 !important;
          left: auto !important;
        }

        /* Autohide Vertical Bar Inner Hover Extension (1/2 width = 24px) */
        .zen-app-vb-hover-zone {
          position: absolute !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 24px !important;
          z-index: 15 !important;
          pointer-events: none;
          background: transparent !important;
        }

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar[data-revealed="true"] .zen-app-vb-hover-zone {
          pointer-events: auto !important;
        }

        :root[zentral-apps-placement="vertical-bar"][zen-right-side="true"] .zen-app-vb-hover-zone,
        :root[zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] .zen-app-vb-hover-zone {
          right: -24px !important;
          left: auto !important;
        }

        :root[zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) .zen-app-vb-hover-zone {
          left: -24px !important;
          right: auto !important;
        }

        /* ===========================================================================
         * Zentral - Compact Sidebar Mode: Apps & Utility Button Styling & Animations
         * =========================================================================== */
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile,
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-add-btn,
        :root[zen-compact-mode="true"] #zentral-apps-utility-section .zentral-utility-btn,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn,
        :root[zen-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn,
        :root[zentral-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn {
          border-radius: var(--toolbarbutton-border-radius, 8px) !important;
          background-color: color-mix(in srgb, currentColor 8%, transparent) !important;
          border: none !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile img,
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile svg,
        :root[zen-compact-mode="true"] #zentral-apps-utility-section .zentral-utility-btn svg,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile img,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile svg,
        :root[zen-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn svg,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile img,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile svg,
        :root[zentral-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn svg {
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4)) !important;
          transition: transform 0.15s ease, filter 0.15s ease !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile:hover,
        :root[zen-compact-mode="true"] #zentral-apps-utility-section .zentral-utility-btn:hover,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover,
        :root[zen-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:hover,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover,
        :root[zentral-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:hover {
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 14%, transparent)) !important;
          transform: translateY(-1px) scale(1.04) !important;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile:hover img,
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile:hover svg,
        :root[zen-compact-mode="true"] #zentral-apps-utility-section .zentral-utility-btn:hover svg,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover img,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover svg,
        :root[zen-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:hover svg,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover img,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:hover svg,
        :root[zentral-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:hover svg {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile:active,
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-add-btn:active,
        :root[zen-compact-mode="true"] #zentral-apps-utility-section .zentral-utility-btn:active,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:active,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn:active,
        :root[zen-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:active,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile:active,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn:active,
        :root[zentral-sidebar-collapsed="true"] #zentral-apps-utility-section .zentral-utility-btn:active {
          transform: scale(0.96) !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-tile[data-active="true"],
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile[data-active="true"],
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-tile[data-active="true"] {
          background-color: color-mix(in srgb, var(--zen-primary-color, #707ac2) 32%, var(--zen-colors-base, #131313)) !important;
          box-shadow: 0 0 0 1px var(--zen-primary-color, #707ac2), 0 2px 8px rgba(0, 0, 0, 0.25) !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-add-btn,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn {
          border: 1.5px dashed color-mix(in srgb, currentColor 25%, transparent) !important;
          opacity: 0.85 !important;
        }

        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid .zen-app-add-btn:hover,
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn:hover,
        :root[zentral-sidebar-collapsed="true"] #zen-apps-sidebar-grid .zen-app-add-btn:hover {
          opacity: 1 !important;
          border-style: solid !important;
          border-color: var(--zen-primary-color, currentColor) !important;
          background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 15%, transparent)) !important;
          transform: translateY(-1px) scale(1.04) !important;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
        }
      `;
      try {
        const style = document.createElement("style");
        style.id = "zen-apps-sidebar-styles";
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      } catch (e) {
        console.error("[Zentral] Error injecting sidebar styles:", e);
      }
    }

    /* --------------------------------------------------------------------------
     * 3.4 Grid & Tile Rendering
     * --------------------------------------------------------------------------
     */

    /**
     * Safely constructs SVG elements from an raw XML string.
     * @private
     * @param {string} svgString - Valid SVG XML markup string.
     * @returns {Element} SVG Document root element.
     */
    #createSVG(svgString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      return doc.documentElement;
    }

    /**
     * Updates CSS gradient scroll masks on horizontal apps scroll boxes.
     */
    updateScrollMask() {
      const scrollBox = this.#dom.scrollBox;
      if (!scrollBox) return;

      if (!this.#dom.grid?.classList.contains("zen-apps-horizontal")) {
        scrollBox.style.maskImage = "none";
        scrollBox.style.webkitMaskImage = "none";
        return;
      }

      const isOverflowing = scrollBox.scrollWidth > scrollBox.clientWidth + 2;

      const sl = scrollBox.scrollLeft;
      const maxScroll = scrollBox.scrollWidth - scrollBox.clientWidth;

      const hasLeft = isOverflowing && sl > 2;
      const hasRight = isOverflowing && maxScroll - sl > 2;
      const dist = "28px";

      let mask = "none";
      if (hasLeft && hasRight) {
        mask = `linear-gradient(to right, transparent 0px, black ${dist}, black calc(100% - ${dist}), transparent 100%)`;
      } else if (hasLeft) {
        mask = `linear-gradient(to right, transparent 0px, black ${dist}, black 100%)`;
      } else if (hasRight) {
        mask = `linear-gradient(to right, black 0px, black calc(100% - ${dist}), transparent 100%)`;
      }

      scrollBox.style.maskImage = mask;
      scrollBox.style.webkitMaskImage = mask;
    }

    /**
     * Creates and attaches persistent DOM elements for the app grid and panel overlays.
     */
    createContainers() {
      if (!this.#dom.grid) {
        this.#dom.grid = document.createElement("div");
        this.#dom.grid.id = "zen-apps-sidebar-grid";

        const utilitySection = document.createElement("div");
        utilitySection.id = "zentral-apps-utility-section";
        utilitySection.className = "zentral-apps-utility-section";

        const uDots = document.createElement("div");
        uDots.className = "zentral-apps-utility-dots";
        uDots.title = "Utility Tools";
        uDots.innerHTML = `
          <span class="zentral-apps-utility-dot"></span>
          <span class="zentral-apps-utility-dot"></span>
          <span class="zentral-apps-utility-dot"></span>
        `;

        const uDotsVert = document.createElement("div");
        uDotsVert.className = "zentral-apps-utility-dots-vertical";
        uDotsVert.title = "Utility Tools";
        uDotsVert.innerHTML = `
          <span class="zentral-apps-utility-dot"></span>
          <span class="zentral-apps-utility-dot"></span>
          <span class="zentral-apps-utility-dot"></span>
        `;

        const uContent = document.createElement("div");
        uContent.className = "zentral-apps-utility-content";

        const uRow = document.createElement("div");
        uRow.className = "zentral-apps-utility-row";
        uContent.appendChild(uRow);

        const uDivider = document.createElement("div");
        uDivider.className = "zentral-apps-utility-divider";

        utilitySection.appendChild(uDots);
        utilitySection.appendChild(uDotsVert);
        utilitySection.appendChild(uContent);
        utilitySection.appendChild(uDivider);

        this.#dom.grid.appendChild(utilitySection);

        this.#dom.utilitySection = utilitySection;
        this.#dom.utilityDots = uDots;
        this.#dom.utilityDotsVertical = uDotsVert;
        this.#dom.utilityContent = uContent;
        this.#dom.utilityRow = uRow;
        this.#dom.utilityDivider = uDivider;

        const dots = document.createElement("div");
        dots.className = "zen-apps-autohide-dots";
        dots.innerHTML = `
          <span class="zen-apps-autohide-dot"></span>
          <span class="zen-apps-autohide-dot"></span>
          <span class="zen-apps-autohide-dot"></span>
        `;
        this.#dom.grid.appendChild(dots);
        this.#dom.autohideDots = dots;

        const scrollBox = document.createElement("div");
        scrollBox.className = "zen-apps-scroll-box";

        this.#dom.grid.appendChild(scrollBox);
        this.#dom.scrollBox = scrollBox;

        utilitySection.addEventListener("mouseenter", () => {
          if (!this.isPlacementVerticalBar()) {
            this.setUtilityHovered(true);
          }
        });
        utilitySection.addEventListener("mouseleave", (e) => {
          if (!this.isPlacementVerticalBar()) {
            if (this.#dom.grid && !this.#dom.grid.contains(e.relatedTarget)) {
              this.scheduleUtilityCollapse(260);
            }
          }
        });

        let cachedGridRect = null;
        const refreshGridRect = () => {
          if (this.#dom.grid) {
            const r = this.#dom.grid.getBoundingClientRect();
            if (r.width > 0 || r.height > 0) {
              cachedGridRect = r;
            }
          }
        };

        window.addEventListener("resize", refreshGridRect, { passive: true });
        if (typeof ResizeObserver !== "undefined" && this.#dom.grid) {
          try {
            new ResizeObserver(refreshGridRect).observe(this.#dom.grid);
          } catch (_) {}
        }

        this.#dom.grid.addEventListener("mouseenter", () => {
          if (!this.isPlacementVerticalBar()) {
            this.setAutohideHovered(true);
            refreshGridRect();
            if (this.#state.utilityCollapseTimer) {
              clearTimeout(this.#state.utilityCollapseTimer);
              this.#state.utilityCollapseTimer = null;
            }
            if (this.#state.autohideCollapseTimer) {
              clearTimeout(this.#state.autohideCollapseTimer);
              this.#state.autohideCollapseTimer = null;
            }
          }
        });
        this.#dom.grid.addEventListener("mouseleave", () => {
          if (!this.isPlacementVerticalBar()) {
            this.scheduleAutohideCollapse(260);
            this.scheduleUtilityCollapse(260);
          }
        });

        window.addEventListener("mousemove", (e) => {
          if (this.isPlacementVerticalBar()) return;
          const grid = this.#dom.grid;
          if (!grid) return;
          if (grid.classList.contains("zen-apps-horizontal")) return;
          if (this.#state.activeAppId) return; // Keep revealed while an app panel is open

          if (!cachedGridRect) refreshGridRect();
          const rect = cachedGridRect;
          if (!rect || (rect.width === 0 && rect.height === 0)) return;

          const isInsideGrid = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          );

          // Forgiving 18px upward margin over URL bar bottom edge
          const isNearTopEdge = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top - 18 &&
            e.clientY < rect.top
          );

          if (isInsideGrid) {
            if (this.#state.utilityCollapseTimer) {
              clearTimeout(this.#state.utilityCollapseTimer);
              this.#state.utilityCollapseTimer = null;
            }
            if (this.#state.autohideCollapseTimer) {
              clearTimeout(this.#state.autohideCollapseTimer);
              this.#state.autohideCollapseTimer = null;
            }
          } else if (isNearTopEdge) {
            // Hovering near top edge: refresh collapse timer
            this.scheduleAutohideCollapse(260);
            this.scheduleUtilityCollapse(260);
          } else {
            // Cursor is outside grid and outside top buffer (e.g. webpage, top bar, lower sidebar)
            const isRevealed = grid.hasAttribute("data-revealed") || this.#dom.utilitySection?.hasAttribute("data-utility-revealed");
            if (isRevealed) {
              this.scheduleAutohideCollapse(260);
              this.scheduleUtilityCollapse(260);
            }
          }
        }, { passive: true });

        window.addEventListener("blur", () => {
          if (this.isPlacementVerticalBar() || this.#state.activeAppId) return;
          this.setAutohideHovered(false);
          this.setUtilityHovered(false);
        });

        scrollBox.addEventListener("wheel", (e) => {
          if (!this.#dom.grid.classList.contains("zen-apps-horizontal")) return;
          if (e.deltaY !== 0 || e.deltaX !== 0) {
            e.preventDefault();
            const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
            scrollBox.scrollLeft += delta * 8;
            this.updateScrollMask();
          }
        }, { passive: false });

        scrollBox.addEventListener("scroll", () => {
          this.updateScrollMask();
        });

        this.#dom.grid.addEventListener("contextmenu", (e) => {
          if (e.target.closest(".zen-app-tile[data-app-id]") || e.target.closest(".zentral-utility-btn")) return;
          e.preventDefault();
          e.stopPropagation();
          const popup = document.getElementById("zen-apps-sidebar-tile-context");
          if (popup) {
            delete popup.dataset.activeAppId;
            popup.openPopupAtScreen(e.screenX, e.screenY, true);
          }
        });
      }

      if (!this.#dom.verticalBar) {
        let vb = document.getElementById("zentral-apps-vertical-bar");
        if (!vb) {
          vb = document.createElement("div");
          vb.id = "zentral-apps-vertical-bar";
        }

        vb.addEventListener("mouseenter", () => {
          if (this.isPlacementVerticalBar()) {
            if (this.#state.autohideCollapseTimer) {
              clearTimeout(this.#state.autohideCollapseTimer);
              this.#state.autohideCollapseTimer = null;
            }
          }
        });
        vb.addEventListener("mouseleave", (e) => {
          if (this.isPlacementVerticalBar()) {
            if (!vb.contains(e.relatedTarget) && e.relatedTarget !== trigger) {
              const isRight = this.isVerticalBarOnRight();
              const barWidth = 48 + 8 + 20;
              const isInsideBar = isRight ? (e.clientX >= window.innerWidth - barWidth) : (e.clientX <= barWidth);
              if (!isInsideBar) {
                this.scheduleAutohideCollapse(250);
              }
            }
          }
        });
        vb.addEventListener("wheel", (e) => {
          if (this.isPlacementVerticalBar()) {
            const scroller = this.#dom.scrollBox || this.#dom.grid;
            if (scroller) scroller.scrollTop += e.deltaY;
          }
        }, { passive: true });
        this.#dom.verticalBar = vb;

        let bgEl = vb.querySelector("#zentral-apps-vertical-bar-bg");
        if (!bgEl) {
          bgEl = document.createElement("div");
          bgEl.id = "zentral-apps-vertical-bar-bg";
          bgEl.className = "zen-toolbar-background zen-browser-generic-background";
          const grain = document.createElement("div");
          grain.className = "zen-browser-grain";
          bgEl.appendChild(grain);
          vb.insertBefore(bgEl, vb.firstChild);
        }

        let hoverZone = vb.querySelector(".zen-app-vb-hover-zone");
        if (!hoverZone) {
          hoverZone = document.createElement("div");
          hoverZone.className = "zen-app-vb-hover-zone";
          vb.appendChild(hoverZone);
        }

        let footer = document.getElementById("zentral-apps-vertical-bar-footer");
        if (!footer) {
          footer = document.createElement("div");
          footer.id = "zentral-apps-vertical-bar-footer";
        }

        let autohideBtn = footer.querySelector("#zentral-apps-vb-autohide-btn");
        if (!autohideBtn) {
          autohideBtn = document.createElement("button");
          autohideBtn.id = "zentral-apps-vb-autohide-btn";
          autohideBtn.className = "zen-app-tile zen-app-vb-footer-btn";
          autohideBtn.title = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true ? "Disable Autohide" : "Enable Autohide";
          autohideBtn.appendChild(this.#createSVG(`<svg class="zs-eye-open" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`));
          autohideBtn.appendChild(this.#createSVG(`<svg class="zs-eye-closed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`));
          autohideBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const cur = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
            const next = !cur;
            Core.setPref(Constants.Apps.PREF_AUTOHIDE, next);
            this.updateAutohideState();
          });
          autohideBtn.addEventListener("mousedown", (e) => {
            if (e.button === 0) e.stopPropagation();
          });
          footer.appendChild(autohideBtn);
        }

        let settingsBtn = footer.querySelector("#zentral-apps-vb-settings-btn");
        if (!settingsBtn) {
          settingsBtn = document.createElement("button");
          settingsBtn.id = "zentral-apps-vb-settings-btn";
          settingsBtn.className = "zen-app-tile zen-app-vb-footer-btn";
          settingsBtn.title = "Zentral Settings";
          settingsBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`));
          settingsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.Zentral?.Settings) window.Zentral.Settings.open();
            else if (window.ZentralSettingsInstance) window.ZentralSettingsInstance.open();
          });
          settingsBtn.addEventListener("mousedown", (e) => {
            if (e.button === 0) e.stopPropagation();
          });
          footer.appendChild(settingsBtn);
        }

        if (footer.parentNode !== vb) {
          vb.appendChild(footer);
        }

        this.#dom.vbFooter = footer;
        this.#dom.vbAutohideBtn = autohideBtn;
        this.#dom.vbSettingsBtn = settingsBtn;

        let trigger = document.getElementById("zentral-apps-vertical-bar-trigger");
        if (!trigger) {
          trigger = document.createElement("div");
          trigger.id = "zentral-apps-vertical-bar-trigger";
          (document.body || document.documentElement).appendChild(trigger);
        }
        trigger.addEventListener("mouseenter", () => {
          if (this.isPlacementVerticalBar()) {
            this.scheduleAutohideReveal(320);
          }
        });
        trigger.addEventListener("mouseleave", (e) => {
          if (this.isPlacementVerticalBar()) {
            if (e.relatedTarget !== vb && !vb.contains(e.relatedTarget)) {
              const isRight = this.isVerticalBarOnRight();
              const cancelDist = 24;
              const isStillNearEdge = isRight ? (e.clientX >= window.innerWidth - cancelDist) : (e.clientX <= cancelDist);
              if (!isStillNearEdge) {
                this.cancelAutohideReveal();
                this.scheduleAutohideCollapse(250);
              }
            }
          }
        });
        this.#dom.verticalBarTrigger = trigger;

        window.addEventListener("mousemove", (e) => {
          if (!this.isPlacementVerticalBar() || Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) !== true) return;
          if (this.#state.activeAppId) return; // Keep revealed while panel is open

          const isRight = this.isVerticalBarOnRight();
          const triggerDist = 1; // Screen edge proximity (within 1px of bezel)
          const cancelDist = 14;  // Cancel reveal only if cursor departs beyond 14px from edge
          const barWidth = 48 + 8 + 20; // 8px outer margin + 48px bar + 20px inner buffer = 76px

          const isNearEdge = isRight ? (e.clientX >= window.innerWidth - triggerDist) : (e.clientX <= triggerDist);
          const isDeparting = isRight ? (e.clientX < window.innerWidth - cancelDist) : (e.clientX > cancelDist);
          const isInsideBar = isRight ? (e.clientX >= window.innerWidth - barWidth) : (e.clientX <= barWidth);

          const isCurrentlyRevealed = this.#dom.verticalBar?.hasAttribute("data-revealed");

          if (!isCurrentlyRevealed) {
            // When hidden: schedule reveal when touching the edge
            if (isNearEdge) {
              this.scheduleAutohideReveal(320);
            } else if (isDeparting) {
              this.cancelAutohideReveal();
            }
          } else {
            // When already revealed: keep open while cursor is inside the bar or near edge
            if (isInsideBar || isNearEdge) {
              if (this.#state.autohideCollapseTimer) {
                clearTimeout(this.#state.autohideCollapseTimer);
                this.#state.autohideCollapseTimer = null;
              }
            } else {
              this.scheduleAutohideCollapse(250);
            }
          }
        }, { passive: true });
      }

      if (!this.#dom.root) {
        const root = document.createElement("div"); root.id = "zen-app-panel-root";
        const clip = document.createElement("div"); clip.id = "zen-app-panel-clip";
        const panel = document.createElement("div"); panel.id = "zen-app-panel-slider";
        clip.appendChild(panel);

        const hoverZone = document.createElement("div"); hoverZone.className = "zen-app-hover-zone";
        const pill = document.createElement("div"); pill.id = "zen-app-panel-pill";

        const pinBtn = document.createElement("button"); pinBtn.className = "zen-app-btn"; pinBtn.title = "Pin panel";
        pinBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 11V15M3.5 11.5h9c0 0 0-2-1.5-3l-.5-4c0 0 .5-.5.5-1H5.5c0 .5.5 1 .5 1L5.5 8.5c-1.5 1-2 3-2 3z"/></svg>`));
        pinBtn.addEventListener("click", (e) => { e.stopPropagation(); this.togglePin(); });

        const expandBtn = document.createElement("button"); expandBtn.className = "zen-app-btn"; expandBtn.title = "Expand panel";
        expandBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`));
        expandBtn.addEventListener("click", (e) => { e.stopPropagation(); this.toggleExpand(); });

        const grabberBtn = document.createElement("div"); grabberBtn.className = "zen-app-grabber"; grabberBtn.title = "Drag to resize";
        grabberBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 14"><circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/></svg>`));
        grabberBtn.addEventListener("mousedown", this.startResize);

        const closeBtn = document.createElement("button"); closeBtn.className = "zen-app-btn zen-app-close-btn"; closeBtn.title = "Close panel";
        closeBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`));
        closeBtn.addEventListener("click", (e) => { e.stopPropagation(); this.closePanel(); });

        pill.append(pinBtn, expandBtn, grabberBtn, closeBtn);

        const strip = document.createElement("div"); strip.className = "zen-app-resize-strip";
        strip.addEventListener("mousedown", this.startResize);

        root.append(clip, hoverZone, pill, strip);
        document.documentElement.appendChild(root);

        this.#dom.root = root; 
        this.#dom.clip = clip; 
        this.#dom.panel = panel; 
        this.#dom.pill = pill; 
        this.#dom.pinBtn = pinBtn;
        this.#dom.expandBtn = expandBtn;
      }
    }

    /**
     * Updates documentElement and trigger state based on autohide preference.
     */
    updateAutohideState() {
      const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      const isCollapsed = this.isPhysicallySidebarCollapsed();
      const isVerticalBar = this.isPlacementVerticalBar();
      const activeAutohide = isAutohide && (isVerticalBar || !isCollapsed);

      document.documentElement.setAttribute("zentral-apps-autohide", activeAutohide ? "true" : "false");
      document.documentElement.setAttribute("zentral-apps-placement", isVerticalBar ? "vertical-bar" : "sidebar");
      if (!activeAutohide) {
        if (this.#dom.grid) this.#dom.grid.removeAttribute("data-revealed");
        if (this.#dom.verticalBar) this.#dom.verticalBar.removeAttribute("data-revealed");
      }
      if (isVerticalBar) {
        this.updateVerticalBarBounds();
      }
      if (this.#dom.vbAutohideBtn) {
        this.#dom.vbAutohideBtn.title = isAutohide ? "Disable Autohide" : "Enable Autohide";
      }
      if (this.#dom.utilityAutohideBtn) {
        this.#dom.utilityAutohideBtn.title = isAutohide ? "Disable Autohide" : "Enable Autohide";
      }

      if (!this.#state.badgeSyncTimer) {
        this.#state.badgeSyncTimer = setInterval(() => {
          this.syncAllAppBadges();
        }, 2000);
      }
    }

    /**
     * Sets whether the utility section is revealed (Autohide OFF mode).
     * @param {boolean} hovered - Whether utility section or apps grid is hovered.
     */
    setUtilityHovered(hovered) {
      if (this.#state.utilityCollapseTimer) {
        clearTimeout(this.#state.utilityCollapseTimer);
        this.#state.utilityCollapseTimer = null;
      }
      const util = this.#dom.utilitySection;
      if (!util) return;

      if (hovered) {
        util.setAttribute("data-utility-revealed", "true");
      } else {
        util.removeAttribute("data-utility-revealed");
      }
    }

    /**
     * Schedules collapse of the utility section after cursor leaves.
     * @param {number} [delay=350] - Delay in milliseconds.
     */
    scheduleUtilityCollapse(delay = 350) {
      if (this.#state.utilityCollapseTimer) clearTimeout(this.#state.utilityCollapseTimer);
      this.#state.utilityCollapseTimer = setTimeout(() => {
        this.#state.utilityCollapseTimer = null;
        this.setUtilityHovered(false);
      }, delay);
    }

    /**
     * Schedules delayed reveal when cursor moves to the edge in autohide mode.
     * Prevents accidental opening during rapid mouse passes.
     * @param {number} [delay=320] - Delay in milliseconds.
     */
    scheduleAutohideReveal(delay = 320) {
      if (this.#state.autohideCollapseTimer) {
        clearTimeout(this.#state.autohideCollapseTimer);
        this.#state.autohideCollapseTimer = null;
      }
      if (this.#state.autohideRevealTimer) return;
      this.#state.autohideRevealTimer = setTimeout(() => {
        this.#state.autohideRevealTimer = null;
        this.setAutohideHovered(true);
      }, delay);
    }

    /**
     * Cancels any pending autohide reveal timer.
     */
    cancelAutohideReveal() {
      if (this.#state.autohideRevealTimer) {
        clearTimeout(this.#state.autohideRevealTimer);
        this.#state.autohideRevealTimer = null;
      }
    }

    /**
     * Sets whether the autohide apps grid is currently revealed.
     * @param {boolean} hovered - Whether cursor is over trigger or grid.
     */
    setAutohideHovered(hovered) {
      this.cancelAutohideReveal();
      if (this.#state.autohideCollapseTimer) {
        clearTimeout(this.#state.autohideCollapseTimer);
        this.#state.autohideCollapseTimer = null;
      }
      if (this.#dom.grid) {
        if (hovered) {
          this.#dom.grid.setAttribute("data-revealed", "true");
        } else if (!this.#state.activeAppId) {
          this.#dom.grid.removeAttribute("data-revealed");
        }
      }
      if (this.#dom.verticalBar) {
        if (hovered) {
          this.updateVerticalBarBounds();
          this.#dom.verticalBar.setAttribute("data-revealed", "true");
        } else if (!this.#state.activeAppId) {
          this.#dom.verticalBar.removeAttribute("data-revealed");
        }
      }
    }

    /**
     * Schedules delayed collapse after cursor leaves apps grid.
     * @param {number} [delay=250] - Delay in milliseconds.
     */
    scheduleAutohideCollapse(delay = 250) {
      this.cancelAutohideReveal();
      if (this.#state.autohideCollapseTimer) clearTimeout(this.#state.autohideCollapseTimer);
      this.#state.autohideCollapseTimer = setTimeout(() => {
        this.#state.autohideCollapseTimer = null;
        if (!this.#state.activeAppId) {
          this.setAutohideHovered(false);
        }
      }, delay);
    }

    /**
     * Renders the draggable buttons (Settings, Autohide) inside the Apps Grid Utility Section.
     * Supports free slot positioning across all grid columns.
     */
    renderUtilitySection() {
      if (!this.#dom.utilitySection || !this.#dom.utilityRow) return;
      const row = this.#dom.utilityRow;
      row.replaceChildren();

      const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      const isHorizontal = this.#dom.grid?.classList.contains("zen-apps-horizontal");
      const slotCount = Constants.Apps.UTILITY_SLOTS_COUNT || 4;
      row.style.setProperty("--zentral-grid-cols", slotCount);

      if (isHorizontal) {
        // Horizontal Toolbar Mode: Single inline flex row with Settings button (autohide excluded)
        const btn = document.createElement("button");
        btn.id = "zentral-utility-settings-btn";
        btn.className = "zen-app-tile zentral-utility-btn";
        btn.dataset.utilityKey = "settings";
        btn.title = "Zentral Settings";
        btn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`));
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.Zentral?.Settings) window.Zentral.Settings.open();
          else if (window.ZentralSettingsInstance) window.ZentralSettingsInstance.open();
        });
        btn.addEventListener("mousedown", (e) => {
          if (e.button === 0) e.stopPropagation();
        });
        this.#dom.utilitySettingsBtn = btn;
        row.appendChild(btn);
        return;
      }

      // Vertical Sidebar Mode: Always fixed 4-slot grid supporting free drag & drop
      if (!Array.isArray(this.#state.utilitySlots) || this.#state.utilitySlots.length !== slotCount) {
        const slots = new Array(slotCount).fill(null);
        if (Array.isArray(this.#state.utilitySlots)) {
          this.#state.utilitySlots.forEach((k, idx) => {
            if (idx < slotCount && k) slots[idx] = k;
          });
        }
        this.#state.utilitySlots = slots;
      }

      const required = ["settings", "autohide"];
      required.forEach(reqKey => {
        if (!this.#state.utilitySlots.includes(reqKey)) {
          const emptyIdx = this.#state.utilitySlots.indexOf(null);
          if (emptyIdx > -1) {
            this.#state.utilitySlots[emptyIdx] = reqKey;
          } else {
            this.#state.utilitySlots[0] = reqKey;
          }
        }
      });

      let draggedKey = null;

      for (let slotIdx = 0; slotIdx < slotCount; slotIdx++) {
        const slotEl = document.createElement("div");
        slotEl.className = "zentral-utility-slot";
        slotEl.dataset.slotIndex = slotIdx;

        const btnKey = this.#state.utilitySlots[slotIdx];
        if (btnKey) {
          let btn = null;
          if (btnKey === "settings") {
            btn = document.createElement("button");
            btn.id = "zentral-utility-settings-btn";
            btn.className = "zen-app-tile zentral-utility-btn";
            btn.dataset.utilityKey = "settings";
            btn.title = "Zentral Settings";
            btn.draggable = true;
            btn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`));
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (window.Zentral?.Settings) window.Zentral.Settings.open();
              else if (window.ZentralSettingsInstance) window.ZentralSettingsInstance.open();
            });
            btn.addEventListener("mousedown", (e) => {
              if (e.button === 0) e.stopPropagation();
            });
            this.#dom.utilitySettingsBtn = btn;
          } else if (btnKey === "autohide") {
            btn = document.createElement("button");
            btn.id = "zentral-utility-autohide-btn";
            btn.className = "zen-app-tile zentral-utility-btn";
            btn.dataset.utilityKey = "autohide";
            btn.title = isAutohide ? "Disable Autohide" : "Enable Autohide";
            btn.draggable = true;
            btn.appendChild(this.#createSVG(`<svg class="zs-eye-open" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`));
            btn.appendChild(this.#createSVG(`<svg class="zs-eye-closed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`));
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const cur = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
              const next = !cur;
              Core.setPref(Constants.Apps.PREF_AUTOHIDE, next);
              this.updateAutohideState();
            });
            btn.addEventListener("mousedown", (e) => {
              if (e.button === 0) e.stopPropagation();
            });
            this.#dom.utilityAutohideBtn = btn;
          }

          if (btn) {
            btn.addEventListener("dragstart", (e) => {
              e.stopPropagation();
              draggedKey = btnKey;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", "utility:" + btnKey);
              btn.style.opacity = "0.4";
            });
            btn.addEventListener("dragend", (e) => {
              e.stopPropagation();
              draggedKey = null;
              btn.style.opacity = "1";
              this.renderUtilitySection();
            });
            slotEl.appendChild(btn);
          }
        }

        slotEl.addEventListener("dragover", (e) => {
          if (draggedKey) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            slotEl.classList.add("zentral-utility-slot-dragover");
          }
        });
        slotEl.addEventListener("dragleave", (e) => {
          e.stopPropagation();
          slotEl.classList.remove("zentral-utility-slot-dragover");
        });
        slotEl.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          slotEl.classList.remove("zentral-utility-slot-dragover");
          const data = e.dataTransfer.getData("text/plain");
          if (data && data.startsWith("utility:")) {
            const sourceKey = data.replace("utility:", "");
            const fromIdx = this.#state.utilitySlots.indexOf(sourceKey);
            const toIdx = slotIdx;
            if (fromIdx > -1 && fromIdx !== toIdx) {
              const targetKey = this.#state.utilitySlots[toIdx];
              this.#state.utilitySlots[toIdx] = sourceKey;
              this.#state.utilitySlots[fromIdx] = targetKey || null;
              this.saveUtilityOrder();
              this.renderUtilitySection();
            }
          }
        });

        row.appendChild(slotEl);
      }
    }

    /**
     * Formats an app's title into a clean, friendly service/brand name
     * (e.g. "Discord", "WhatsApp", "Telegram", "Reddit") instead of raw URLs or domains ("discord.com").
     * @param {string} [title] - Raw title string or page label.
     * @param {string} [url] - Target app website URL.
     * @returns {string} Human-friendly service title.
     */
    formatAppDisplayName(title, url = "") {
      const WELL_KNOWN_SERVICES = {
        "discord.com": "Discord",
        "web.whatsapp.com": "WhatsApp",
        "whatsapp.com": "WhatsApp",
        "web.telegram.org": "Telegram",
        "telegram.org": "Telegram",
        "t.me": "Telegram",
        "reddit.com": "Reddit",
        "youtube.com": "YouTube",
        "music.youtube.com": "YouTube Music",
        "mail.google.com": "Gmail",
        "gmail.com": "Gmail",
        "github.com": "GitHub",
        "twitter.com": "Twitter",
        "x.com": "X",
        "chatgpt.com": "ChatGPT",
        "chat.openai.com": "ChatGPT",
        "instagram.com": "Instagram",
        "facebook.com": "Facebook",
        "linkedin.com": "LinkedIn",
        "spotify.com": "Spotify",
        "open.spotify.com": "Spotify",
        "twitch.tv": "Twitch",
        "slack.com": "Slack",
        "notion.so": "Notion",
        "netflix.com": "Netflix",
        "google.com": "Google",
        "drive.google.com": "Google Drive",
        "calendar.google.com": "Google Calendar",
        "maps.google.com": "Google Maps",
        "translate.google.com": "Google Translate",
        "keep.google.com": "Google Keep",
        "pinterest.com": "Pinterest",
        "amazon.com": "Amazon",
        "wikipedia.org": "Wikipedia",
        "outlook.live.com": "Outlook",
        "outlook.com": "Outlook",
        "messenger.com": "Messenger",
        "tiktok.com": "TikTok",
        "soundcloud.com": "SoundCloud",
        "music.apple.com": "Apple Music",
        "bsky.app": "Bluesky",
        "mastodon.social": "Mastodon",
        "threads.net": "Threads",
        "medium.com": "Medium",
        "substack.com": "Substack",
        "trello.com": "Trello",
        "asana.com": "Asana",
        "figma.com": "Figma",
        "canva.com": "Canva",
        "dropbox.com": "Dropbox",
        "steamcommunity.com": "Steam",
        "store.steampowered.com": "Steam",
        "mail.proton.me": "ProtonMail",
        "proton.me": "Proton",
        "deezer.com": "Deezer",
        "crunchyroll.com": "Crunchyroll"
      };

      let host = "";
      if (url) {
        try {
          host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        } catch (_) {}
      }

      if (host) {
        if (WELL_KNOWN_SERVICES[host]) return WELL_KNOWN_SERVICES[host];
        for (const [knownHost, knownName] of Object.entries(WELL_KNOWN_SERVICES)) {
          if (host === knownHost || host.endsWith("." + knownHost)) {
            return knownName;
          }
        }
      }

      let raw = (title || "").trim();
      const rawLower = raw.toLowerCase().replace(/^www\./, "");
      if (WELL_KNOWN_SERVICES[rawLower]) return WELL_KNOWN_SERVICES[rawLower];
      for (const [knownHost, knownName] of Object.entries(WELL_KNOWN_SERVICES)) {
        if (rawLower === knownHost || rawLower.endsWith("." + knownHost)) {
          return knownName;
        }
      }

      const isContaminated = !raw ||
        /^Group\s+Tab\s+\d+$/i.test(raw) ||
        /^Demo\s+Tab\s+\d+$/i.test(raw) ||
        /^New\s+Tab$/i.test(raw) ||
        /^about:blank$/i.test(raw) ||
        raw.startsWith("http://") ||
        raw.startsWith("https://");

      if (!isContaminated) {
        raw = raw.replace(/^[\(\[]\s*\d+\+?\s*[\)\]]\s*/, "");
        if (/web\b/i.test(raw)) raw = raw.replace(/\s+web\b/i, "");
        const parts = raw.split(/\s+[-|•—–:]\s+/);
        if (parts.length > 1) {
          const first = parts[0].trim();
          const last = parts[parts.length - 1].trim();
          if (first && first.length <= 20) raw = first;
          else if (last && last.length <= 20) raw = last;
        }
        if (raw && raw.length <= 30 && !raw.includes(".")) {
          return raw;
        }
      }

      if (host) {
        const cleanHost = host.replace(/^(app|web|mobile|m|my|auth|login)\./, "");
        const domainBase = cleanHost.replace(/\.(com|org|net|io|app|dev|tv|co|uk|it|de|fr|me|so|ai|gg|cc|xyz|info|biz|eu)(\.[a-z]{2})?$/, "");
        if (domainBase) {
          return domainBase.charAt(0).toUpperCase() + domainBase.slice(1);
        }
      }

      return raw || host || "App";
    }

    renderGrid() {
      if (!this.#dom.grid) return;
      const oldAddBtn = document.querySelector("#zentral-apps-vertical-bar .zen-app-add-btn") || this.#dom.grid.querySelector(".zen-app-add-btn");
      if (oldAddBtn) oldAddBtn.remove();
      const targetContainer = this.#dom.scrollBox || this.#dom.grid;
      targetContainer.replaceChildren(); // Faster than innerHTML = '' — avoids serialization
      
      const isVerticalBar = this.isPlacementVerticalBar();
      if (isVerticalBar) {
        this.#dom.grid.style.direction = "ltr";
      } else {
        const sidebarRight = this.isSidebarRight();
        const isCollapsed = this.isCollapsedSidebar();
        const shouldFlip = !sidebarRight && !isCollapsed;
        this.#dom.grid.style.direction = shouldFlip ? "rtl" : "ltr";
      }
      const cols = parseInt(Core.getPref(Constants.Apps.PREF_APPS_PER_ROW, 7), 10) || 7;
      const maxRows = parseInt(Core.getPref(Constants.Apps.PREF_MAX_ROWS, 3), 10) || 3;
      this.#dom.grid.style.setProperty("--zentral-grid-cols", cols);
      this.#dom.grid.style.setProperty("--zentral-max-rows", maxRows);

      const maxApps = Core.getPref(Constants.Apps.PREF_MAX_APPS);
      const activeWorkspaceId = window.gZenWorkspaces?.activeWorkspace;
      const visibleApps = this.#state.apps.filter(app => {
        if (!app.workspaceId || app.workspaceId === "all") return true;
        if (activeWorkspaceId && app.workspaceId === activeWorkspaceId) return true;
        return false;
      });
      const activeApps = visibleApps.slice(0, maxApps);

      const appCount = activeApps.length + 1;
      const actualRows = Math.min(Math.ceil(appCount / cols), maxRows);
      const expandedGridHeight = 44 + (actualRows * 42) + 4;
      this.#dom.grid.style.setProperty("--zentral-apps-grid-expanded-height", `${expandedGridHeight}px`);
      let draggedAppId = null;
      const fragment = document.createDocumentFragment();

      this.updateAutohideState();
      this.renderUtilitySection();

      activeApps.forEach((app) => {
        const btn = document.createElement("button");
        btn.id = "zen-app-btn-" + app.id;
        btn.className = "zen-app-tile";
        btn.dataset.appId = app.id;
        btn.dataset.active = (this.#state.activeAppId === app.id) ? "true" : "false";
        btn.title = this.formatAppDisplayName(app.title, app.url);

        const img = document.createElement("img");
        img.src = app.icon || `page-icon:${app.url}`;
        btn.appendChild(img);
        
        if (app.hasNotification) {
          const badge = document.createElement("div");
          badge.className = "zen-app-badge";
          if (app.notificationCount) {
            badge.textContent = app.notificationCount > 99 ? "99+" : app.notificationCount;
          } else {
            badge.setAttribute("data-dot", "true");
          }
          btn.appendChild(badge);
        }

        let wasDragged = false;
        let startX = 0;
        let startY = 0;

        const togglePanel = () => {
          if (this.#state.activeAppId === app.id) {
            this.closePanel();
          } else {
            this.openPanel(app);
          }
        };

        btn.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          wasDragged = false;
          startX = e.clientX;
          startY = e.clientY;
        });

        btn.addEventListener("mousemove", (e) => {
          if (e.buttons === 1) {
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (dist > 6) {
              wasDragged = true;
            }
          }
        });

        btn.addEventListener("click", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          if (wasDragged) {
            wasDragged = false;
            return;
          }
          togglePanel();
        });

        // Context menu and drag/drop logic
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const popup = document.getElementById("zen-apps-sidebar-tile-context");
          if (popup) { popup.dataset.activeAppId = app.id; popup.openPopupAtScreen(e.screenX, e.screenY, true); }
        });
        
        btn.draggable = true;
        btn.addEventListener("dragstart", (e) => { 
          wasDragged = true; 
          draggedAppId = app.id; 
          e.dataTransfer.effectAllowed = "move"; 
          e.dataTransfer.setData("text/plain", app.id); 
          btn.style.opacity = "0.4"; 
        });
        btn.addEventListener("dragend", () => { 
          draggedAppId = null; 
          btn.style.opacity = "1"; 
          setTimeout(() => { wasDragged = false; }, 60);
          this.renderGrid(); 
        });
        btn.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (draggedAppId && draggedAppId !== app.id) { btn.style.transform = "scale(1.15)"; btn.style.zIndex = "5"; } });
        btn.addEventListener("dragleave", () => { btn.style.transform = ""; btn.style.zIndex = ""; });
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          if (draggedAppId && draggedAppId !== app.id) {
            const fromIdx = this.#state.apps.findIndex(a => a.id === draggedAppId);
            const toIdx = this.#state.apps.findIndex(a => a.id === app.id);
            if (fromIdx > -1 && toIdx > -1) {
              const [movedApp] = this.#state.apps.splice(fromIdx, 1);
              this.#state.apps.splice(toIdx, 0, movedApp);
              this.saveApps();
              this.renderGrid();
            }
          }
        });

        fragment.appendChild(btn);
      });

      targetContainer.appendChild(fragment);

      if (Core.getPref(Constants.Apps.PREF_ENABLED) && activeApps.length < maxApps) {
        const addBtn = document.createElement("button");
        addBtn.className = "zen-app-tile zen-app-add-btn";
        addBtn.title = "Add App";
        addBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`));
        addBtn.addEventListener("click", (e) => {
          const tab = gBrowser.selectedTab; if (!tab) return;
          const url = tab.linkedBrowser?.currentURI?.spec || "about:blank";
          // Prefer the actual document title over tab.label, which can be contaminated by
          // tab group labels, loading states, or truncation. Fall back to hostname → URL.
          let title = "";
          try {
            title = tab.linkedBrowser?.contentDocument?.title || "";
          } catch (_) {}
          if (!title) {
            try {
              const host = tab.linkedBrowser?.currentURI?.host || "";
              title = host.replace(/^www\./, "") || tab.label || url;
            } catch (_) {
              title = tab.label || url;
            }
          }
          const cleanTitle = this.formatAppDisplayName(title, url);
          const icon = (typeof gBrowser.getIcon === "function" ? gBrowser.getIcon(tab) : null) || tab.getAttribute("image") || tab.image || "";
          if (url !== "about:blank") this.addApp(url, cleanTitle, icon);
        });

        addBtn.addEventListener("mousedown", (e) => {
          if (e.button === 0) e.stopPropagation();
        });

        targetContainer.appendChild(addBtn);
        if (isVerticalBar) {
          this.updateVerticalBarAddBtnPlacement();
        }
      }

      if (this.#dom.utilitySection && this.#dom.utilitySection.parentNode === this.#dom.grid) {
        if (this.#dom.grid.classList.contains("zen-apps-horizontal")) {
          this.#dom.grid.appendChild(this.#dom.utilitySection);
        } else {
          if (this.#dom.grid.firstChild !== this.#dom.utilitySection) {
            this.#dom.grid.insertBefore(this.#dom.utilitySection, this.#dom.grid.firstChild);
          }
        }
      }

      if (this.#dom.scrollBox) {
        if (this.#dom.grid.classList.contains("zen-apps-horizontal") && this.#state.apps.length >= 8) {
          this.#dom.scrollBox.style.setProperty("min-width", "calc(8 * 38px + 7 * 4px)", "important");
        } else {
          this.#dom.scrollBox.style.removeProperty("min-width");
        }
      }

      requestAnimationFrame(() => {
        this.updateScrollMask();
        if (isVerticalBar) {
          this.updateVerticalBarAddBtnPlacement();
        }
        if (this.#dom.scrollBox && this.#dom.scrollBox.scrollWidth > this.#dom.scrollBox.clientWidth) {
          this.#dom.scrollBox.scrollLeft = this.#dom.scrollBox.scrollWidth - this.#dom.scrollBox.clientWidth;
          this.updateScrollMask();
        }
      });
    }



    /**
     * Adds a new app tile to the configuration and re-renders the grid.
     * @param {string} url - Target website URL.
     * @param {string} title - App display label.
     * @param {string} [icon] - Custom icon URI or favicon path.
     */
    addApp(url, title, icon) {
      if (this.#state.apps.length >= Core.getPref(Constants.Apps.PREF_MAX_APPS)) return;
      const id = "app_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const crispIcon = url.startsWith("http") ? `page-icon:${url}` : (icon || `page-icon:${url}`);
      const cleanTitle = this.formatAppDisplayName(title, url);
      const newApp = { id, url, title: cleanTitle, icon: crispIcon };
      this.#state.apps.push(newApp);
      this.saveApps();
      this.renderGrid();
    }

    /**
     * Removes an app tile by ID and cleans up its loaded browser frame.
     * @param {string} id - App unique identifier string.
     */
    removeApp(id) {
      const idx = this.#state.apps.findIndex(app => app.id === id);
      if (idx === -1) return;
      this.#state.apps.splice(idx, 1);
      this.saveApps();
      
      if (this.#state.activeAppId === id) this.closePanel();
      
      const b = this.#state.appBrowsers.get(id);
      if (b && b.parentNode) b.parentNode.removeChild(b);
      this.#state.appBrowsers.delete(id);
      
      this.renderGrid();
    }

    /* --------------------------------------------------------------------------
     * 3.5 App Panel Lifecycle & Animations
     * --------------------------------------------------------------------------
     */

    /**
     * Opens the floating app panel for a selected web app with smooth sliding transitions.
     * @param {Object} app - The target app configuration object.
     */
    openPanel(app) {
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] openPanel called for app:", app.id, "URL:", app.url);
      if (this.#state.closeTimerId) {
        clearTimeout(this.#state.closeTimerId);
        this.#state.closeTimerId = null;
      }
      if (this.#dom.root) {
        this.#dom.root.style.pointerEvents = "";
      }
      this.#state.activeAppId = app.id;
      this.#state.isPinned = false;
      this.#state.isExpanded = false;
      document.documentElement.setAttribute("zentral-app-panel-open", "true");
      this.setAutohideHovered(true);
      this.#state.preExpandWidth = null;
      if(this.#dom.pinBtn) this.#dom.pinBtn.setAttribute("data-pinned", "false");
      if(this.#dom.expandBtn) {
        this.#dom.expandBtn.title = "Expand panel";
        this.#dom.expandBtn.replaceChildren(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`));
      }
      
      // Update tile selection
      const tiles = document.querySelectorAll(".zen-app-tile[data-app-id]");
      tiles.forEach(tile => tile.dataset.active = (tile.dataset.appId === app.id) ? "true" : "false");
      
      const targetWidth = app.width || this.loadWidth();
      this.updateWidthVar(Math.max(Constants.Apps.MIN_WIDTH_PX, targetWidth));
      this.positionPanel();
      this.updateVerticalBarBounds();
      this.startPositionTracking();

      const { browser, isNew } = this.getOrCreateAppBrowser(app);

      for (const [id, b] of this.#state.appBrowsers.entries()) {
        if (b && b.isConnected) b.style.display = (id === app.id) ? "" : "none";
      }

      if (isNew) {
        try {
          const uri = Services.io.newURI(app.url);
          if (typeof browser.fixupAndLoadURIString === "function") {
            browser.fixupAndLoadURIString(app.url, { triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(uri, {}) });
          } else {
            browser.loadURI(uri, { triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(uri, {}) });
          }
        } catch (e) { console.error("[ZentralApps] Failed to load URL:", e); }
      }

      const isTopSlide = this.isCollapsedLayoutMode() && !this.isPlacementVerticalBar();
      const isFromRight = this.isPanelAttachedToRight();
      const slideFrom = isTopSlide 
        ? "translateY(-100%)" 
        : (isFromRight ? "translateX(100%)" : "translateX(-100%)");
      this.#dom.panel.style.transition = "none";
      this.#dom.panel.style.transform  = slideFrom;
      if (this.#dom.root) {
        this.#dom.root.removeAttribute("closing");
        this.#dom.root.setAttribute("open", "true");
      }
      this.#dom.panel.getBoundingClientRect(); // Reflow

      requestAnimationFrame(() => {
        const slideMs = Core.getPref(Constants.Apps.PREF_ANIMATION_SPEED);
        const animType = Core.getPref(Constants.Apps.PREF_ANIMATION_TYPE);
        const bezier = this.#getEasingBezier(animType);
        
        if (animType === "none") {
          this.#dom.panel.style.transition = "none";
        } else {
          this.#dom.panel.style.transition = `transform ${slideMs}ms ${bezier}`;
        }
        this.#dom.panel.style.transform  = isTopSlide ? "translateY(0)" : "translateX(0)";
      });
    }

    /**
     * Closes the active floating app panel and triggers closing slide-out transition.
     */
    closePanel() {
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] closePanel called");
      if (!this.#state.activeAppId && !this.#dom.root?.hasAttribute("open")) return;
      
      if (this.#state.closeTimerId) {
        clearTimeout(this.#state.closeTimerId);
        this.#state.closeTimerId = null;
      }

      if (this.#dom.root) {
        this.#dom.root.setAttribute("closing", "true");
        this.#dom.root.style.pointerEvents = "none";
      }

      if (this.#state.isExpanded) {
        this.#state.isExpanded = false;
        if (this.#state.preExpandWidth) {
          this.#state.panelWidthPx = this.#state.preExpandWidth;
        }
      }
      this.#state.activeAppId = null;
      this.#state.isPinned = false;
      document.documentElement.removeAttribute("zentral-app-panel-open");
      if (this.#dom.grid && !this.#dom.grid.matches(":hover")) {
        this.setAutohideHovered(false);
      }
      
      const tiles = document.querySelectorAll(".zen-app-tile[data-app-id]");
      tiles.forEach(tile => tile.dataset.active = "false");

      const isTopSlide = this.isCollapsedLayoutMode() && !this.isPlacementVerticalBar();
      const isToRight = this.isPanelAttachedToRight();
      const slideTo = isTopSlide 
        ? "translateY(-100%)" 
        : (isToRight ? "translateX(100%)" : "translateX(-100%)");
      
      const slideMs = Core.getPref(Constants.Apps.PREF_ANIMATION_SPEED);
      const animType = Core.getPref(Constants.Apps.PREF_ANIMATION_TYPE);
      const bezier = this.#getEasingBezier(animType);
      
      if (animType === "none" || slideMs <= 0) {
        this.#dom.panel.style.transition = "none";
        this.#dom.panel.style.transform = slideTo;
        if (this.#dom.root) {
          this.#dom.root.removeAttribute("open");
          this.#dom.root.removeAttribute("closing");
          this.#dom.root.style.pointerEvents = "";
        }
        this.stopPositionTracking();
        return;
      }

      this.#dom.panel.style.transition = `transform ${slideMs}ms ${bezier}`;
      this.#dom.panel.style.transform  = slideTo;
      
      this.#state.closeTimerId = setTimeout(() => {
        this.#state.closeTimerId = null;
        if (this.#dom.root) {
          this.#dom.root.removeAttribute("open");
          this.#dom.root.removeAttribute("closing");
          this.#dom.root.style.pointerEvents = "";
        }
        this.stopPositionTracking();
      }, slideMs + 20);
    }

    /**
     * Extracts notification badge presence and count from a document title string.
     * Covers all major web services that embed unread counts in the title:
     *   - Gmail: "Inbox (118) - user@gmail.com", "Posta in arrivo (12) - ..."
     *   - Telegram: "Telegram (2)", "(2) Telegram"
     *   - WhatsApp: "(4) WhatsApp"
     *   - Slack: "(5) channel - Slack"
     *   - Discord: "Discord | Your place to talk", etc.
     *   - Any service using (N) or [N] prefix/suffix
     * @param {string} title - The document title string.
     * @returns {{hasNotification: boolean, notifCount: number|null}}
     */
    extractBadgeFromTitle(title) {
      if (!title || typeof title !== "string") return { hasNotification: false, notifCount: null };
      const trimmed = title.trim();

      // Match numeric counts in parentheses or brackets anywhere in the title
      // Covers: "Inbox (118)", "(4) WhatsApp", "[5] Messages", "(99+)"
      const numMatch = trimmed.match(/\((\d+)\+?\)/) ||
                       trimmed.match(/\[(\d+)\+?\]/) ||
                       trimmed.match(/\b(\d+)\s+unread\b/i) ||
                       trimmed.match(/\b(?:messages?|notif(?:ication)?s?)\s*[:(]?\s*(\d+)/i) ||
                       trimmed.match(/(?:^|\s)[\u2022\u25cf\u25cb]\s*(\d+)/);

      if (numMatch && numMatch[1]) {
        const count = parseInt(numMatch[1], 10);
        if (!isNaN(count) && count > 0) {
          return { hasNotification: true, notifCount: count };
        }
      }

      // Match unread indicator dot/bullet without a number (renders red dot badge)
      const dotPattern = /^[\u2022\u25cf\u25cb\u25a0\u25aa\u2219\u2731-\u2736\u2605\u2606\u2b24\u2023\u25b6\u25c0]\s|\s[\u2022\u25cf\u25cb\u25a0\u25aa\u2219\u2731-\u2736\u2605\u2606\u2b24\u2023\u25b6\u25c0]$|^\*\s|\s\*$/;
      if (dotPattern.test(trimmed)) {
        return { hasNotification: true, notifCount: null };
      }

      return { hasNotification: false, notifCount: null };
    }

    /**
     * Updates or removes the visual notification badge on an app tile button.
     * @param {string} appId - Target app ID.
     * @param {boolean} hasNotification - Whether badge should be visible.
     * @param {number|null} notifCount - Optional numeric counter.
     */
    updateAppBadge(appId, hasNotification, notifCount) {
      const btn = document.getElementById("zen-app-btn-" + appId);
      if (!btn) return;
      let badge = btn.querySelector(".zen-app-badge");
      if (hasNotification) {
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "zen-app-badge";
          btn.appendChild(badge);
        }
        if (notifCount) {
          badge.textContent = notifCount > 99 ? "99+" : notifCount;
          badge.removeAttribute("data-dot");
        } else {
          badge.textContent = "";
          badge.setAttribute("data-dot", "true");
        }
      } else {
        if (badge) badge.remove();
      }
    }

    /**
     * Polls all active app browsers for title changes and updates badges.
     * Uses browsingContext.currentWindowGlobal.documentTitle as the authoritative
     * title source — this works across process boundaries without FrameScripts
     * and is the correct modern Gecko API for chrome-privileged scripts.
     */
    syncAllAppBadges() {
      if (!this.#state.appBrowsers || this.#state.appBrowsers.size === 0) return;
      for (const [appId, browser] of this.#state.appBrowsers.entries()) {
        if (!browser || !browser.isConnected) continue;
        const app = this.#state.apps.find(a => a.id === appId);
        if (!app) continue;

        // Read title from all available sources — browsingContext.currentWindowGlobal
        // is the most reliable cross-process API in modern Gecko (Firefox 128+)
        let title = "";
        try {
          title = browser.browsingContext?.currentWindowGlobal?.documentTitle ||
                  browser.contentTitle ||
                  browser.getAttribute("label") || "";
        } catch (_) {
          title = browser.contentTitle || browser.getAttribute("label") || "";
        }

        const { hasNotification, notifCount } = this.extractBadgeFromTitle(title);
        if (app.hasNotification !== hasNotification || app.notificationCount !== notifCount) {
          app.hasNotification = hasNotification;
          app.notificationCount = notifCount;
          this.updateAppBadge(appId, hasNotification, notifCount);
        }
      }
    }

    /**
     * Retrieves existing XUL browser element for an app, or instantiates a new content browser.
     * Listens for title changes to trigger unread badge notifications in real time.
     * @param {Object} app - Target app configuration object.
     * @returns {{browser: Element, isNew: boolean}} The browser element and new creation flag.
     */
    getOrCreateAppBrowser(app) {
      let b = this.#state.appBrowsers.get(app.id);
      if (b && b.isConnected) return { browser: b, isNew: false };

      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0";
      b = document.createXULElement("browser");
      b.setAttribute("type", "content"); b.setAttribute("remote", "true"); b.setAttribute("maychangeremoteness", "true");
      b.setAttribute("nodefaultsrc", "true"); b.setAttribute("messagemanagergroup", "browsers");
      b.setAttribute("usercontextid", "0"); b.setAttribute("customuseragent", ua); b.setAttribute("useragent", ua);
      b.setAttribute("context", "contentAreaContextMenu"); b.setAttribute("flex", "1");
      b.style.cssText = "width: 100%; height: 100%; flex: 1; border: none; overflow: hidden;";

      const checkAndUpdateBadge = () => {
        let title = "";
        try {
          title = browser.browsingContext?.currentWindowGlobal?.documentTitle ||
                  browser.contentTitle ||
                  browser.getAttribute("label") || "";
        } catch (_) {
          title = browser.contentTitle || browser.getAttribute("label") || "";
        }
        const { hasNotification, notifCount } = this.extractBadgeFromTitle(title);
        if (app.hasNotification !== hasNotification || app.notificationCount !== notifCount) {
          app.hasNotification = hasNotification;
          app.notificationCount = notifCount;
          this.updateAppBadge(app.id, hasNotification, notifCount);
        }
      };

      // Chrome-side event listeners for immediate title-change response
      b.addEventListener("pagetitlechanged", checkAndUpdateBadge);
      b.addEventListener("DOMTitleChanged", checkAndUpdateBadge);
      b.addEventListener("load", checkAndUpdateBadge);
      b.addEventListener("pageshow", checkAndUpdateBadge);

      this.#dom.panel.appendChild(b);
      this.#state.appBrowsers.set(app.id, b);
      return { browser: b, isNew: true };
    }
    /**
     * Starts sidebar-aware position tracking for the floating app panel.
     *
     * Zen Browser's compact sidebar mode hides and expands via:
     *   (a) CSS width transitions on #sidebar-box / tabContainer
     *   (b) DOM attribute changes on document.documentElement (zen-sidebar-expanded, etc.)
     *   (c) CSS transform transitions (which do NOT trigger ResizeObserver)
     *
     * To track smooth hover-expands without burning CPU on a permanent 60fps loop,
     * this uses a "RAF Burst" mechanism: a requestAnimationFrame loop runs only
     * while the mouse is moving or a CSS transition is active, and lingers for 500ms.
     */
    startPositionTracking() {
      if (this._isTrackingPosition) return;
      this._isTrackingPosition = true;

      this.positionPanel(); // Immediate initial positioning

      const reposition = () => {
        if (this.#state.activeAppId && this.#dom.root?.hasAttribute("open")) {
          this.positionPanel();
        }
        if (this.isPlacementVerticalBar()) {
          this.updateVerticalBarBounds();
        }
      };

      // --- Vector 1: RAF Burst (Smooth tracking for transforms/hovers) ---
      let rafId = null;
      let lastActivityTime = 0;

      const rafLoop = () => {
        if (!this._isTrackingPosition) return;
        reposition();
        
        if (Date.now() - lastActivityTime < 500) {
          rafId = requestAnimationFrame(rafLoop);
        } else {
          rafId = null;
        }
      };

      const triggerBurst = () => {
        // Run burst when floating panel is open OR when vertical bar is active
        if (!this.isPlacementVerticalBar() && !this.#dom.root?.hasAttribute("open")) return;
        lastActivityTime = Date.now();
        if (!rafId) {
          rafId = requestAnimationFrame(rafLoop);
        }
      };

      this._mouseMoveHandler = triggerBurst;
      window.addEventListener("mousemove", this._mouseMoveHandler, { passive: true });

      this._globalTransitionHandler = () => {
        reposition();
        triggerBurst();
      };
      window.addEventListener("transitionstart", this._globalTransitionHandler, { passive: true });
      window.addEventListener("transitionrun", this._globalTransitionHandler, { passive: true });
      window.addEventListener("transitionend", this._globalTransitionHandler, { passive: true });

      // --- Vector 2: ResizeObserver ---
      // Catches structural layout box changes (like window resize or sidebar/toolbar toggle)
      this._sidebarResizeObserver = new ResizeObserver(reposition);
      const idsToObserve = [
        "sidebar-box", "sidebar-container", "vertical-tabs", 
        "navigator-toolbox", "zen-appcontent-navbar-wrapper",
        "nav-bar", "TabsToolbar", "titlebar", "zen-window-controls",
        "titlebar-buttonbox-container", "zen-appcontent-wrapper"
      ];
      idsToObserve.forEach(id => {
        const el = document.getElementById(id) || document.querySelector("." + id);
        if (el) this._sidebarResizeObserver.observe(el);
      });
      if (gBrowser?.tabContainer) {
        this._sidebarResizeObserver.observe(gBrowser.tabContainer);
      }

      // --- Vector 3: MutationObserver ---
      // Catches Zen's live DOM attributes
      this._docAttrObserver = new MutationObserver((mutations) => {
        reposition();
        triggerBurst(); // A class change might kick off an animation
      });
      this._docAttrObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          "zen-sidebar-expanded",
          "zen-compact-mode",
          "zen-sidebar-hidden",
          "zen-right-side",
          "style",
          "zen-compact-navbar-visible",
        ],
      });

      // --- Vector 4: window resize fallback ---
      this._windowResizeListener = reposition;
      window.addEventListener("resize", this._windowResizeListener, { passive: true });
    }

    /**
     * Stops sidebar-aware position tracking and disconnects all observers/listeners.
     */
    stopPositionTracking() {
      this._isTrackingPosition = false;
      
      if (this._sidebarResizeObserver) {
        this._sidebarResizeObserver.disconnect();
        this._sidebarResizeObserver = null;
      }
      if (this._docAttrObserver) {
        this._docAttrObserver.disconnect();
        this._docAttrObserver = null;
      }
      if (this._globalTransitionHandler) {
        window.removeEventListener("transitionstart", this._globalTransitionHandler);
        window.removeEventListener("transitionrun", this._globalTransitionHandler);
        window.removeEventListener("transitionend", this._globalTransitionHandler);
        this._globalTransitionHandler = null;
      }
      if (this._mouseMoveHandler) {
        window.removeEventListener("mousemove", this._mouseMoveHandler);
        this._mouseMoveHandler = null;
      }
      if (this._windowResizeListener) {
        window.removeEventListener("resize", this._windowResizeListener);
        this._windowResizeListener = null;
      }
    }

    /**
     * Updates CSS variable and root container width for active app panel.
     * @param {number} px - Width dimension in pixels.
     */
    updateWidthVar(px) {
      if (this.#state.activeAppId && !this.#state.isExpanded) {
        const app = this.#state.apps.find(a => a.id === this.#state.activeAppId);
        if (app) app.width = px;
      }
      this.#state.panelWidthPx = px;
      if (this.#dom.root) this.#dom.root.style.width = Math.round(px) + "px";
    }

    /**
     * Recalculates and positions the floating app panel relative to sidebar bounds and top navigation bar.
     */
    positionPanel() {
      const root = this.#dom.root;
      if (!root || !gBrowser?.tabContainer) return;
      const tcRect = gBrowser.tabContainer.getBoundingClientRect();
      const gap = 12; // Fallback scrollbar width

      let sidebarRect = tcRect;
      const sidebarEl = document.getElementById("sidebar-box") || 
                        document.getElementById("sidebar-container") || 
                        document.getElementById("vertical-tabs");
      if (sidebarEl) {
        const sRect = sidebarEl.getBoundingClientRect();
        if (sRect.width > 0 && sRect.height > 0) {
          sidebarRect = sRect;
        }
      }

      const isCollapsed = this.isCollapsedSidebar() || (sidebarRect.width > 0 && sidebarRect.width <= Constants.Apps.COLLAPSED_WIDTH_THRESHOLD);
      const sideGap = isCollapsed ? 7 : gap;

      let top = 0;
      let targetLeft = gap;
      let targetRight = gap;

      const panelWidth = this.#state.panelWidthPx || 420;
      let panelLeft = 0;
      let panelRight = window.innerWidth;

      if (this.isPlacementVerticalBar()) {
        const isVbRight = this.isVerticalBarOnRight();
        const vbOffset = 44 + sideGap;

        if (isVbRight) {
          targetRight = vbOffset;
          panelRight = window.innerWidth - targetRight;
          panelLeft = panelRight - panelWidth;
        } else {
          targetLeft = vbOffset;
          panelLeft = targetLeft;
          panelRight = panelLeft + panelWidth;
        }
      } else {
        if (this.isPanelAttachedToRight()) {
          targetRight = Math.max(gap, Math.round(window.innerWidth - sidebarRect.left) + sideGap);
          panelRight = window.innerWidth - targetRight;
          panelLeft = panelRight - panelWidth;
        } else {
          targetLeft = Math.max(gap, Math.round(sidebarRect.right) + sideGap);
          panelLeft = targetLeft;
          panelRight = panelLeft + panelWidth;
        }
      }

      try {
        let maxBottom = 0;
        const contentBox = document.getElementById("tabbrowser-tabbox") || 
                           document.getElementById("tabbrowser-tabpanels") || 
                           gBrowser?.selectedBrowser || 
                           document.getElementById("appcontent");
        if (contentBox) {
          const cRect = contentBox.getBoundingClientRect();
          if (cRect.top > 0 && cRect.top < 200) {
            maxBottom = Math.max(maxBottom, cRect.top);
          }
        }

        const floatingNavbar = document.getElementById("zen-appcontent-navbar-wrapper");
        if (floatingNavbar) {
          const cs = window.getComputedStyle(floatingNavbar);
          if (cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.1) {
            const navRect = floatingNavbar.getBoundingClientRect();
            if (navRect.height > 0 && navRect.bottom > 0 && navRect.bottom < 200) {
              maxBottom = Math.max(maxBottom, navRect.bottom);
            }
          }
        }

        top = Math.max(gap, Math.round(maxBottom));
      } catch(e) {}

      root.style.top = top + "px";
      root.style.bottom = gap + "px";

      if (this.isPanelAttachedToRight()) {
        root.style.left = "auto";
        root.style.right = targetRight + "px";
        root.style.transform = "translateX(0)";
        root.setAttribute("data-panel-side", "right");
      } else {
        root.style.right = "auto";
        root.style.left = targetLeft + "px";
        root.style.transform = "translateX(0)";
        root.setAttribute("data-panel-side", "left");
      }
    }

    /**
     * Dynamically calculates and applies the top offset for the Vertical Bar
     * so it always starts under the top bar / toolbar / window controls,
     * sliding down seamlessly whenever the toolbar expands or moves.
     */
    updateVerticalBarBounds() {
      const vb = this.#dom.verticalBar;
      if (!vb || !this.isPlacementVerticalBar()) return;
      
      const gap = 12;
      let top = gap;

      try {
        let maxBottom = 0;
        const contentBox = document.getElementById("tabbrowser-tabbox") || 
                           document.getElementById("tabbrowser-tabpanels") || 
                           gBrowser?.selectedBrowser || 
                           document.getElementById("appcontent");
        if (contentBox) {
          const cRect = contentBox.getBoundingClientRect();
          if (cRect.top > 0 && cRect.top < 200) {
            maxBottom = Math.max(maxBottom, cRect.top);
          }
        }

        const floatingNavbar = document.getElementById("zen-appcontent-navbar-wrapper");
        if (floatingNavbar) {
          const cs = window.getComputedStyle(floatingNavbar);
          if (cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.1) {
            const navRect = floatingNavbar.getBoundingClientRect();
            if (navRect.height > 0 && navRect.bottom > 0 && navRect.bottom < 200) {
              maxBottom = Math.max(maxBottom, navRect.bottom);
            }
          }
        }

        top = Math.max(gap, Math.round(maxBottom));
      } catch(e) {}
      
      const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      if (isAutohide) {
        vb.style.top = top + "px";
        vb.style.bottom = gap + "px";
        vb.style.marginTop = "";
        vb.style.height = "";
        vb.style.maxHeight = "";
      } else {
        vb.style.top = "";
        vb.style.bottom = "";
        vb.style.marginTop = "";
        vb.style.height = "";
        vb.style.maxHeight = "";
      }
      if (this.#dom.verticalBarTrigger) {
        this.#dom.verticalBarTrigger.style.top = top + "px";
        this.#dom.verticalBarTrigger.style.bottom = gap + "px";
      }

      this.syncVerticalBarTheme();
      this.updateVerticalBarAddBtnPlacement();
    }

    /**
     * Checks if the Vertical Bar has reached its vertical capacity limit.
     * When capacity is reached, moves the Add App (+) button into the fixed footer container (#zentral-apps-vertical-bar-footer)
     * so that apps scroll cleanly underneath it.
     * When there is remaining space, places the Add App button back in the natural flow immediately below the apps.
     */
    updateVerticalBarAddBtnPlacement() {
      if (!this.isPlacementVerticalBar() || !this.#dom.verticalBar) return;
      const vb = this.#dom.verticalBar;
      const grid = this.#dom.grid;
      const scrollBox = this.#dom.scrollBox;
      const footer = document.getElementById("zentral-apps-vertical-bar-footer");
      const addBtn = document.querySelector("#zentral-apps-vertical-bar .zen-app-add-btn");
      if (!addBtn || !footer || !grid) return;

      const vbHeight = vb.clientHeight;
      const effectiveVbHeight = (vbHeight > 0) ? vbHeight : (window.innerHeight - 60);

      const activeAppsCount = scrollBox ? scrollBox.querySelectorAll(".zen-app-tile:not(.zen-app-add-btn):not(.zen-app-vb-footer-btn)").length : 0;
      const footerBaseHeight = 82; // Eye + Gear buttons + padding
      const itemHeight = 42; // 36px tile + 6px gap
      const requiredHeight = (activeAppsCount + 1) * itemHeight + footerBaseHeight + 16; // 16px padding

      const autohideBtn = footer.querySelector("#zentral-apps-vb-autohide-btn");

      if (requiredHeight > effectiveVbHeight) {
        // Reached limit: place addBtn inside the fixed footer right above autohideBtn
        if (addBtn.parentElement !== footer) {
          if (autohideBtn) {
            footer.insertBefore(addBtn, autohideBtn);
          } else {
            footer.prepend(addBtn);
          }
        }
      } else {
        // Under limit: place addBtn back inside grid / scrollBox naturally below the apps
        const targetContainer = scrollBox || grid;
        if (addBtn.parentElement !== targetContainer) {
          targetContainer.appendChild(addBtn);
        }
      }
    }

    /**
     * Synchronizes theme background gradient from the native background elements
     * to the Vertical Bar in autohide (compact) mode so it matches the Compact Sidebar.
     */
    syncVerticalBarTheme() {
      const vb = this.#dom.verticalBar;
      if (!vb) return;
      
      const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      let bgEl = vb.querySelector("#zentral-apps-vertical-bar-bg");
      if (!bgEl && isAutohide) {
        bgEl = document.createElement("div");
        bgEl.id = "zentral-apps-vertical-bar-bg";
        bgEl.className = "zen-toolbar-background zen-browser-generic-background";
        const grain = document.createElement("div");
        grain.className = "zen-browser-grain";
        bgEl.appendChild(grain);
        vb.insertBefore(bgEl, vb.firstChild);
      }

      if (!isAutohide) {
        if (bgEl) bgEl.style.display = "none";
        vb.style.removeProperty("--zen-theme-gradient-override");
        return;
      }
      if (bgEl) bgEl.style.display = "flex";

      const isRight = this.isVerticalBarOnRight();
      bgEl.style.setProperty("--zentral-vb-side", isRight ? "right" : "left");

      // 1. Mirror live properties from Zen's native toolbar & browser background elements
      const zenTb = document.getElementById("zen-toolbar-background");
      const zenBb = document.getElementById("zen-browser-background");

      let tbGrad = "";
      let grainOpacity = "";
      let bgOpacity = "";

      if (zenTb) {
        tbGrad = zenTb.style.getPropertyValue("--zen-main-browser-background-toolbar") || "";
        const tbOldGrad = zenTb.style.getPropertyValue("--zen-main-browser-background-toolbar-old") || "";
        grainOpacity = zenTb.style.getPropertyValue("--zen-grainy-background-opacity") || "";
        bgOpacity = zenTb.style.getPropertyValue("--zen-background-opacity") || "";

        if (tbGrad && tbGrad !== "none" && !tbGrad.startsWith("light-dark")) {
          bgEl.style.setProperty("--zen-main-browser-background-toolbar", tbGrad);
        }
        if (tbOldGrad && tbOldGrad !== "none" && !tbOldGrad.startsWith("light-dark")) {
          bgEl.style.setProperty("--zen-main-browser-background-toolbar-old", tbOldGrad);
        }
        if (grainOpacity) bgEl.style.setProperty("--zen-grainy-background-opacity", grainOpacity);
        if (bgOpacity) bgEl.style.setProperty("--zen-background-opacity", bgOpacity);

        const showGrain = zenTb.getAttribute("zen-show-grainy-background");
        if (showGrain) {
          bgEl.setAttribute("zen-show-grainy-background", showGrain);
        }
      }

      // 2. Check browser background if toolbar background is empty or fallback
      if ((!tbGrad || tbGrad === "none" || tbGrad.startsWith("light-dark")) && zenBb) {
        const bbGrad = zenBb.style.getPropertyValue("--zen-main-browser-background") || "";
        const bbOldGrad = zenBb.style.getPropertyValue("--zen-main-browser-background-old") || "";
        grainOpacity = grainOpacity || zenBb.style.getPropertyValue("--zen-grainy-background-opacity") || "";
        bgOpacity = bgOpacity || zenBb.style.getPropertyValue("--zen-background-opacity") || "";

        if (bbGrad && bbGrad !== "none" && !bbGrad.startsWith("light-dark")) {
          tbGrad = bbGrad;
          bgEl.style.setProperty("--zen-main-browser-background-toolbar", bbGrad);
        }
        if (bbOldGrad && bbOldGrad !== "none" && !bbOldGrad.startsWith("light-dark")) {
          bgEl.style.setProperty("--zen-main-browser-background-toolbar-old", bbOldGrad);
        }
        if (grainOpacity) bgEl.style.setProperty("--zen-grainy-background-opacity", grainOpacity);
        if (bgOpacity) bgEl.style.setProperty("--zen-background-opacity", bgOpacity);

        const showGrain = zenBb.getAttribute("zen-show-grainy-background");
        if (showGrain) {
          bgEl.setAttribute("zen-show-grainy-background", showGrain);
        }
      }

      // 3. Fallback: generate via gZenThemePicker if not yet populated on native elements
      if (!tbGrad || tbGrad === "none" || tbGrad.startsWith("light-dark")) {
        if (window.gZenThemePicker && typeof window.gZenThemePicker.getGradient === "function") {
          try {
            const ws = window.gZenWorkspaces?.getActiveWorkspace?.();
            const theme = ws?.theme;
            if (theme?.gradientColors?.length) {
              const grad = window.gZenThemePicker.getGradient(theme.gradientColors, true) ||
                           window.gZenThemePicker.getGradient(theme.gradientColors, false);
              if (grad) {
                tbGrad = grad;
                bgEl.style.setProperty("--zen-main-browser-background-toolbar", grad);
              }
              if (theme.texture !== undefined) {
                bgEl.style.setProperty("--zen-grainy-background-opacity", theme.texture);
                bgEl.setAttribute("zen-show-grainy-background", theme.texture > 0 ? "true" : "false");
              }
            }
          } catch (_) {}
        }
      }

      // 4. Ensure vb also clears old override to avoid conflict
      vb.style.removeProperty("--zen-theme-gradient-override");
    }

    /**
     * Toggles pinned state for floating app panel. Pinned panels remain visible when clicking outside.
     */
    togglePin() {
      this.#state.isPinned = !this.#state.isPinned;
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] togglePin - isPinned:", this.#state.isPinned);
      if(this.#dom.pinBtn) {
        this.#dom.pinBtn.setAttribute("data-pinned", this.#state.isPinned ? "true" : "false");
        this.#dom.pinBtn.title = this.#state.isPinned ? "Unpin panel" : "Pin panel";
      }
    }

    /**
     * Toggles expanded state for active floating app panel, maximizing width to fit viewport.
     */
    toggleExpand() {
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] toggleExpand - current isExpanded:", this.#state.isExpanded);
      if (!this.#state.isExpanded) {
        this.#state.preExpandWidth = this.#state.panelWidthPx || this.loadWidth();
        
        const gap = 12;
        let fullWidth = window.innerWidth - (gap * 2);
        if (this.isPlacementVerticalBar()) {
          const vb = this.#dom.verticalBar;
          const vbRect = vb ? vb.getBoundingClientRect() : null;
          const vbWidth = (vbRect && vbRect.width > 0) ? vbRect.width : 44;
          fullWidth = window.innerWidth - vbWidth - (gap * 2);
        } else if (gBrowser?.tabContainer) {
          const tcRect = gBrowser.tabContainer.getBoundingClientRect();
          if (this.isPanelAttachedToRight()) {
            const targetRight = Math.max(gap, Math.round(window.innerWidth - tcRect.left) + gap);
            fullWidth = window.innerWidth - targetRight - gap;
          } else {
            const targetLeft = Math.max(gap, Math.round(tcRect.right) + gap);
            fullWidth = window.innerWidth - targetLeft - gap;
          }
        }
        fullWidth = Math.max(Constants.Apps.MIN_WIDTH_PX, fullWidth);

        this.#state.isExpanded = true;
        this.updateWidthVar(fullWidth);

        if (this.#dom.expandBtn) {
          this.#dom.expandBtn.title = "Restore panel";
          this.#dom.expandBtn.replaceChildren(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4 6V2h2v4H4zm6 0V2h2v4h-2zm-6 4v4h2v-4H4zm6 0v4h2v-4h-2z"/></svg>`));
        }
      } else {
        const restoreW = this.#state.preExpandWidth || this.loadWidth();
        this.#state.isExpanded = false;
        this.updateWidthVar(restoreW);

        if (this.#dom.expandBtn) {
          this.#dom.expandBtn.title = "Expand panel";
          this.#dom.expandBtn.replaceChildren(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`));
        }
      }
    }

    /* --------------------------------------------------------------------------
     * 3.6 Drag & Drop / Grid Reordering
     * --------------------------------------------------------------------------
     */

    /**
     * Initiates manual panel width resize via mouse drag handler.
     * @param {MouseEvent} e - Mouse down event on resize strip or grabber.
     */
    startResize(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      this._startX = e.clientX;
      const app = this.#state.apps.find(a => a.id === this.#state.activeAppId);
      this._startW = app?.width || this.loadWidth();
      if (this.#dom.panel) this.#dom.panel.style.pointerEvents = "none";
      document.addEventListener("mousemove", this.onDrag);
      document.addEventListener("mouseup", this.onStopDrag);
    }

    /**
     * Mouse drag handler updating panel width dynamically during mousemove.
     * @param {MouseEvent} e - Mouse move event.
     */
    onDrag(e) {
      if (this.#state.isExpanded) {
        this.#state.isExpanded = false;
        if (this.#dom.expandBtn) {
          this.#dom.expandBtn.title = "Expand panel";
          this.#dom.expandBtn.replaceChildren(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`));
        }
      }
      const diff = e.clientX - this._startX;
      let newW = this.isPanelAttachedToRight() ? (this._startW - diff) : (this._startW + diff);
      newW = Math.max(Constants.Apps.MIN_WIDTH_PX, Math.min(newW, window.innerWidth * Constants.Apps.MAX_WIDTH_RATIO));
      this.updateWidthVar(newW);
    }

    /**
     * Concludes panel width resize drag operation and persists new width setting.
     */
    onStopDrag() {
      document.removeEventListener("mousemove", this.onDrag);
      document.removeEventListener("mouseup", this.onStopDrag);
      if (this.#dom.panel) this.#dom.panel.style.pointerEvents = "";
      this.saveWidth(this.#state.panelWidthPx);
    }

    /* --------------------------------------------------------------------------
     * 3.7 App Context Menus & Space Scoping
     * --------------------------------------------------------------------------
     */

    /**
     * Constructs and initializes context menu for app tiles (Space selection, Preload, Remove).
     */
    setupContextMenu() {
      let oldPopup = document.getElementById("zen-apps-sidebar-tile-context");
      if (oldPopup) oldPopup.remove();

      let popup = null;
      if (window.MozXULElement?.parseXULToFragment) {
        const frag = window.MozXULElement.parseXULToFragment(`<menupopup id="zen-apps-sidebar-tile-context">
          <menuitem id="zen-apps-sidebar-remove-item" label="Remove from Apps Section"/>
          <menuitem id="zen-apps-sidebar-preload-item" type="checkbox" label="Preload at Startup"/>
          <menuseparator id="zen-apps-sidebar-space-sep"/>
          <menuitem id="zen-apps-sidebar-space-current-item" type="checkbox" label="Current Space"/>
          <menuitem id="zen-apps-sidebar-space-all-item" type="checkbox" label="All Spaces"/>
          <menuseparator id="zen-apps-sidebar-settings-sep"/>
          <menuitem id="zen-apps-sidebar-autohide-item" type="checkbox" label="Autohide Apps Grid"/>
          <menuitem id="zen-apps-sidebar-settings-item" label="Zentral Settings"/>
        </menupopup>`);
        (document.getElementById("mainPopupSet") || document.body).appendChild(frag);
        popup = document.getElementById("zen-apps-sidebar-tile-context");
      } else {
        popup = document.createXULElement("menupopup"); popup.id = "zen-apps-sidebar-tile-context";
        const removeMenuItem = document.createXULElement("menuitem"); removeMenuItem.id = "zen-apps-sidebar-remove-item"; removeMenuItem.setAttribute("label", "Remove from Apps Section");
        const preloadItem = document.createXULElement("menuitem"); preloadItem.id = "zen-apps-sidebar-preload-item"; preloadItem.setAttribute("label", "Preload at Startup"); preloadItem.setAttribute("type", "checkbox");
        const spaceSep = document.createXULElement("menuseparator"); spaceSep.id = "zen-apps-sidebar-space-sep";
        const currentSpaceItem = document.createXULElement("menuitem"); currentSpaceItem.id = "zen-apps-sidebar-space-current-item"; currentSpaceItem.setAttribute("label", "Current Space"); currentSpaceItem.setAttribute("type", "checkbox");
        const allSpacesItem = document.createXULElement("menuitem"); allSpacesItem.id = "zen-apps-sidebar-space-all-item"; allSpacesItem.setAttribute("label", "All Spaces"); allSpacesItem.setAttribute("type", "checkbox");
        const settingsSep = document.createXULElement("menuseparator"); settingsSep.id = "zen-apps-sidebar-settings-sep";
        const autohideItem = document.createXULElement("menuitem"); autohideItem.id = "zen-apps-sidebar-autohide-item"; autohideItem.setAttribute("label", "Autohide Apps Grid"); autohideItem.setAttribute("type", "checkbox");
        const settingsItem = document.createXULElement("menuitem"); settingsItem.id = "zen-apps-sidebar-settings-item"; settingsItem.setAttribute("label", "Zentral Settings");
        popup.appendChild(removeMenuItem); popup.appendChild(preloadItem); popup.appendChild(spaceSep); popup.appendChild(currentSpaceItem); popup.appendChild(allSpacesItem); popup.appendChild(settingsSep); popup.appendChild(autohideItem); popup.appendChild(settingsItem);
        (document.getElementById("mainPopupSet") || document.body).appendChild(popup);
      }
      
      if (!popup) return;

      popup.addEventListener("popupshowing", () => {
        const hasApp = !!popup.dataset.activeAppId;
        const removeBtn = popup.querySelector("#zen-apps-sidebar-remove-item");
        const preloadBtn = popup.querySelector("#zen-apps-sidebar-preload-item");
        const currentSpaceBtn = popup.querySelector("#zen-apps-sidebar-space-current-item");
        const allSpacesBtn = popup.querySelector("#zen-apps-sidebar-space-all-item");
        const spaceSep = popup.querySelector("#zen-apps-sidebar-space-sep");
        const settingsSep = popup.querySelector("#zen-apps-sidebar-settings-sep");
        
        if (removeBtn) removeBtn.hidden = !hasApp;
        if (preloadBtn) preloadBtn.hidden = !hasApp;
        if (currentSpaceBtn) currentSpaceBtn.hidden = !hasApp;
        if (allSpacesBtn) allSpacesBtn.hidden = !hasApp;
        if (spaceSep) spaceSep.hidden = !hasApp;
        if (settingsSep) settingsSep.hidden = !hasApp;

        const autohideBtn = popup.querySelector("#zen-apps-sidebar-autohide-item");
        if (autohideBtn) {
          const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
          if (isAutohide) autohideBtn.setAttribute("checked", "true");
          else autohideBtn.removeAttribute("checked");
        }

        if (hasApp) {
          const app = this.#state.apps.find(a => a.id === popup.dataset.activeAppId);
          if (app) {
            if (preloadBtn) {
              if (app.preload) preloadBtn.setAttribute("checked", "true");
              else preloadBtn.removeAttribute("checked");
            }
            
            const isCurrentOnly = !!app.workspaceId && app.workspaceId !== "all";
            if (isCurrentOnly) {
              if (currentSpaceBtn) currentSpaceBtn.setAttribute("checked", "true");
              if (allSpacesBtn) allSpacesBtn.removeAttribute("checked");
            } else {
              if (allSpacesBtn) allSpacesBtn.setAttribute("checked", "true");
              if (currentSpaceBtn) currentSpaceBtn.removeAttribute("checked");
            }
          }
        }
      });

      popup.querySelector("#zen-apps-sidebar-remove-item")?.addEventListener("command", () => {
        if (popup.dataset.activeAppId) this.removeApp(popup.dataset.activeAppId);
      });

      popup.querySelector("#zen-apps-sidebar-preload-item")?.addEventListener("command", (e) => {
        if (popup.dataset.activeAppId) {
          const app = this.#state.apps.find(a => a.id === popup.dataset.activeAppId);
          if (app) {
            app.preload = !app.preload;
            this.saveApps();
            if (app.preload) {
              e.target.setAttribute("checked", "true");
            } else {
              e.target.removeAttribute("checked");
            }
          }
        }
      });

      popup.querySelector("#zen-apps-sidebar-space-current-item")?.addEventListener("command", () => {
        if (popup.dataset.activeAppId) {
          const app = this.#state.apps.find(a => a.id === popup.dataset.activeAppId);
          if (app) {
            const activeWs = window.gZenWorkspaces?.activeWorkspace || "default";
            app.workspaceId = activeWs;
            this.saveApps();
            this.renderGrid();
          }
        }
      });

      popup.querySelector("#zen-apps-sidebar-space-all-item")?.addEventListener("command", () => {
        if (popup.dataset.activeAppId) {
          const app = this.#state.apps.find(a => a.id === popup.dataset.activeAppId);
          if (app) {
            app.workspaceId = "all";
            this.saveApps();
            this.renderGrid();
          }
        }
      });

      popup.querySelector("#zen-apps-sidebar-autohide-item")?.addEventListener("command", (e) => {
        const cur = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
        const next = !cur;
        Core.setPref(Constants.Apps.PREF_AUTOHIDE, next);
        if (next) e.target.setAttribute("checked", "true");
        else e.target.removeAttribute("checked");
        this.updateAutohideState();
      });

      popup.querySelector("#zen-apps-sidebar-settings-item")?.addEventListener("command", () => {
        if (window.Zentral?.Settings) window.Zentral.Settings.open();
        else if (window.ZentralSettingsInstance) window.ZentralSettingsInstance.open();
      });
    }

    /**
     * Tab context menu handler to create a new app tile from the selected tab URL.
     */
    handleTabContextMenuCommand() {
      const tab = (typeof TabContextMenu !== "undefined" && TabContextMenu.contextTab) ? TabContextMenu.contextTab : gBrowser.selectedTab;
      if (!tab) return;
      const url = tab.linkedBrowser?.currentURI?.spec || "about:blank";
      const title = tab.label || url;
      const icon = (typeof gBrowser.getIcon === "function" ? gBrowser.getIcon(tab) : null) || tab.getAttribute("image") || tab.image || "";
      if (url !== "about:blank") this.addApp(url, title, icon);
    }

    /**
     * Global outside click event listener to auto-close unpinned app panels.
     * @param {MouseEvent} e - Global mouse click event.
     */
    handleOutsideClick(e) {
      if (!this.#state.activeAppId || this.#state.isPinned) {
        return;
      }
      
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some(el => el.id === "zen-app-panel-root" || el.id === "zen-apps-sidebar-grid" || el.id === "zentral-apps-vertical-bar" || (el.classList && el.classList.contains("zen-app-tile")))) return;
      if (path.some(el => el.id === "navigator-toolbox" || el.id === "sidebar-box" || el.id === "PersonalToolbar" || el.id === "nav-bar")) return;
      if (path.some(el => (el.id && el.id.includes("sine")) || (el.className && typeof el.className === "string" && el.className.includes("sine")))) return;
      if (e.target.closest && (e.target.closest("#zen-app-panel-root") || e.target.closest("#zen-apps-sidebar-grid") || e.target.closest("#zentral-apps-vertical-bar") || e.target.closest(".zen-app-tile"))) return;
      if (e.target.closest && (e.target.closest("#navigator-toolbox") || e.target.closest("#sidebar-box") || e.target.closest("#PersonalToolbar") || e.target.closest("#nav-bar"))) return;
      if (e.target.closest && (e.target.closest("[id*='sine']") || e.target.closest("[class*='sine']"))) return;
      
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] handleOutsideClick closing panel due to click target:", e.target?.tagName, e.target?.id, e.target?.className);
      this.closePanel();
    }

    /**
     * Debounces repositionGrid() calls — cancels any pending call and reschedules.
     * This prevents the 2–4× redundant DOM moves that fire when multiple observers
     * (MutationObserver + Services.prefs + ResizeObserver) all trigger simultaneously
     * during a single layout mode switch.
     * @param {number} [delay=120] - Debounce delay in milliseconds.
     */
    scheduleRepositionGrid(delay = 120) {
      if (this.#state.repositionTimer) clearTimeout(this.#state.repositionTimer);
      this.#state.repositionTimer = setTimeout(() => {
        this.#state.repositionTimer = null;
        this.repositionGrid();
      }, delay);
    }

    /**
     * Repositions app grid container between vertical sidebar, horizontal toolbar, or opposite vertical bar based on configuration.
     * Correctly handles:
     *   - Opposite Vertical Bar mode -> grid placed in dedicated vertical bar on screen edge opposite to sidebar
     *   - Normal Sidebar (expanded) -> grid in sidebar
     *   - Collapsed Sidebar layout mode -> grid in top toolbar
     *   - Compact Mode (sidebar-expanded=true but sidebar is visually icon-only) -> grid in top toolbar
     */
    repositionGrid() {
      const grid = this.#dom.grid;
      if (!grid) return;
      try {
        const placement = Core.getPref(Constants.Apps.PREF_PLACEMENT, "sidebar");
        const isVerticalBar = placement === "vertical-bar";
        const shouldUseToolbar = this.isPhysicallySidebarCollapsed();

        document.documentElement.setAttribute("zentral-apps-placement", placement);

        if (isVerticalBar) {
          grid.classList.remove("zen-apps-horizontal");
          grid.style.order = "initial";

          const vb = this.#dom.verticalBar;
          if (vb) {
            if (grid.parentNode !== vb) {
              if (this.#dom.vbFooter && this.#dom.vbFooter.parentNode === vb) {
                vb.insertBefore(grid, this.#dom.vbFooter);
              } else {
                vb.appendChild(grid);
              }
            }
            if (this.#dom.vbFooter && this.#dom.vbFooter.parentNode !== vb) {
              vb.appendChild(this.#dom.vbFooter);
            }

            const browserEl = document.getElementById("browser") || document.body || document.documentElement;
            const isRightSidebar = this.isSidebarRight();

            if (isRightSidebar) {
              // Sidebar is on right -> Vertical Bar on LEFT (first child of #browser)
              if (vb.parentNode !== browserEl || browserEl.firstChild !== vb) {
                browserEl.insertBefore(vb, browserEl.firstChild);
              }
            } else {
              // Sidebar is on left -> Vertical Bar on RIGHT (last child of #browser)
              if (vb.parentNode !== browserEl || vb.nextSibling !== null) {
                browserEl.appendChild(vb);
              }
            }
            vb.style.display = "flex";
            this.updateVerticalBarBounds();
          }
          if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] repositionGrid: Vertical Bar mode placed on opposite edge.");
        } else {
          if (this.#dom.verticalBar) {
            this.#dom.verticalBar.style.display = "none";
            this.#dom.verticalBar.removeAttribute("data-revealed");
          }
          if (this.#dom.verticalBarTrigger) {
            this.#dom.verticalBarTrigger.style.display = "none";
          }

          if (shouldUseToolbar) {
            const bookmarksContainer = document.getElementById("personal-bookmarks") || document.getElementById("PlacesToolbarItems");
            const topToolbar = document.getElementById("nav-bar-customization-target") || document.getElementById("nav-bar");

            grid.classList.add("zen-apps-horizontal");
            grid.style.order = "initial";
            if (this.#dom.utilitySection && this.#dom.utilitySection.parentNode === grid) {
              grid.appendChild(this.#dom.utilitySection);
            }
            if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] repositionGrid: Collapsed/Compact mode \u2192 grid placed in toolbar.");

            if (bookmarksContainer && bookmarksContainer.parentNode) {
              const targetParent = bookmarksContainer.parentNode;
              if (grid.parentNode !== targetParent || grid.previousSibling !== bookmarksContainer) {
                targetParent.insertBefore(grid, bookmarksContainer.nextSibling);
              }
            } else if (topToolbar) {
              const targetBtn = document.getElementById("unified-extensions-button") || document.getElementById("PanelUI-button");
              if (targetBtn && targetBtn.parentNode) {
                if (grid.nextSibling !== targetBtn) targetBtn.parentNode.insertBefore(grid, targetBtn);
              } else if (grid.parentNode !== topToolbar) {
                topToolbar.appendChild(grid);
              }
            }
          } else {
            grid.classList.remove("zen-apps-horizontal");
            if (this.#dom.utilitySection && this.#dom.utilitySection.parentNode === grid) {
              if (grid.firstChild !== this.#dom.utilitySection) {
                grid.insertBefore(this.#dom.utilitySection, grid.firstChild);
              }
            }
            const sidebarContainer = gBrowser?.tabContainer?.parentNode;
            if (sidebarContainer) {
              if (grid.parentNode !== sidebarContainer || grid.nextSibling !== gBrowser.tabContainer) {
                sidebarContainer.insertBefore(grid, gBrowser.tabContainer);
              }
              grid.style.order = "-1";
            }
            if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] repositionGrid: Expanded sidebar mode \u2192 grid placed in sidebar.");
          }
        }
        this.updateScrollMask();
      } catch (e) {
        console.warn("[ZentralApps] Failed to reposition grid", e);
      }
    }

    /**
     * Registers preference observers and event listeners for workspace and layout changes.
     */
    setupObservers() {
      // Tab Context Menu integration
      const menu = document.getElementById("tabContextMenu");
      if (menu && !document.getElementById("context_zenAppsSidebarAdd")) {
        let menuItem;
        if (window.MozXULElement?.parseXULToFragment) {
          const frag = window.MozXULElement.parseXULToFragment(`<menuseparator id="context_zenAppsSidebarAdd_sep"/><menuitem id="context_zenAppsSidebarAdd" label="Add to Apps Section"/>`);
          menu.appendChild(frag); menuItem = document.getElementById("context_zenAppsSidebarAdd");
        } else {
          const sep = document.createXULElement("menuseparator"); sep.id = "context_zenAppsSidebarAdd_sep";
          menuItem = document.createXULElement("menuitem"); menuItem.id = "context_zenAppsSidebarAdd"; menuItem.setAttribute("label", "Add to Apps Section");
          menu.appendChild(sep); menu.appendChild(menuItem);
        }
        if (menuItem) {
          menu.addEventListener("popupshowing", () => { menuItem.disabled = this.#state.apps.length >= Core.getPref(Constants.Apps.PREF_MAX_APPS); });
          menuItem.addEventListener("command", this.handleTabContextMenuCommand);
        }
      }

      window.addEventListener("mousedown", this.handleOutsideClick);

      this.#tabSelectListener = () => {
        const currentWs = window.gZenWorkspaces?.activeWorkspace;
        if (this.#state.lastWorkspaceId !== currentWs) {
          this.#state.lastWorkspaceId = currentWs;
          this.renderGrid();
        }
        this.syncVerticalBarTheme();
        setTimeout(() => this.syncVerticalBarTheme(), 100);
      };
      window.addEventListener("TabSelect", this.#tabSelectListener);

      // Workspace switch listener with staggered theme synchronizations to capture cross-fading workspace colors
      this.#workspaceSwitchListener = () => {
        const currentWs = window.gZenWorkspaces?.activeWorkspace;
        this.#state.lastWorkspaceId = currentWs;
        this.renderGrid();
        if (this.#dom.verticalBar) {
          this.#dom.verticalBar.style.removeProperty("--zen-theme-gradient-override");
        }
        this.syncVerticalBarTheme();
        [50, 120, 250, 400, 600].forEach(ms => setTimeout(() => this.syncVerticalBarTheme(), ms));
      };
      window.addEventListener("zen-workspace-switched", this.#workspaceSwitchListener);
      window.addEventListener("zen-workspace-changed", this.#workspaceSwitchListener);
      window.addEventListener("zen-workspaces-change", this.#workspaceSwitchListener);

      // Observer 1: DOM attribute changes (zen-right-side, zen-sidebar-collapsed, zen-compact-mode, style)
      this.#sideObserver = new window.MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === "zen-right-side") {
            this.repositionGrid();
            this.renderGrid();
            if (this.#state.activeAppId && this.#dom.root?.hasAttribute("open")) this.positionPanel();
          }
          if (m.attributeName === "zen-sidebar-collapsed" || m.attributeName === "zen-compact-mode" || m.attributeName === "zen-sidebar-expanded") {
            if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] layout attribute changed \u2192 triggering repositionGrid");
            // Debounced — collapses simultaneous observer firings into one call
            this.scheduleRepositionGrid(80);
          }
          if (m.attributeName === "style" || m.attributeName === "zen-compact-mode") {
            this.syncVerticalBarTheme();
            this.updateVerticalBarBounds();
          }
        }
      });
      this.#sideObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["zen-right-side", "zen-sidebar-collapsed", "zen-compact-mode", "zen-sidebar-expanded", "zen-sidebar-hidden", "style"]
      });

      // Observer 1b: Live theme changes on #navigator-toolbox
      const toolboxEl = document.getElementById("navigator-toolbox");
      if (toolboxEl) {
        this.#toolboxThemeObserver = new window.MutationObserver(() => {
          this.syncVerticalBarTheme();
        });
        this.#toolboxThemeObserver.observe(toolboxEl, {
          attributes: true,
          attributeFilter: ["style", "class"]
        });
      }

      // Observer 1c: Direct theme transition observer on #zen-toolbar-background and #zen-browser-background
      const zenToolbarBg = document.getElementById("zen-toolbar-background") || document.querySelector(".zen-toolbar-background");
      const zenBrowserBg = document.getElementById("zen-browser-background");
      const bgElements = [zenToolbarBg, zenBrowserBg].filter(Boolean);
      if (bgElements.length > 0) {
        this.#toolbarBgObserver = new window.MutationObserver(() => {
          this.syncVerticalBarTheme();
          setTimeout(() => this.syncVerticalBarTheme(), 80);
        });
        bgElements.forEach(el => {
          this.#toolbarBgObserver.observe(el, {
            attributes: true,
            attributeFilter: ["style", "class"],
            childList: true
          });
          el.addEventListener("transitionend", () => this.syncVerticalBarTheme(), { passive: true });
          el.addEventListener("animationend", () => this.syncVerticalBarTheme(), { passive: true });
        });
      }

      // Observer 2: Preference changes for toolbar/sidebar mode
      this.#layoutObserver = (subject, topic, data) => {
        if (data === "zen.view.use-single-toolbar" || data === "zen.view.sidebar-expanded") {
          // Debounced Ã¢â‚¬â€ longer delay for prefs since DOM width lags behind pref change
          this.scheduleRepositionGrid(150);
        }
      };
      Services.prefs.addObserver("zen.view.use-single-toolbar", this.#layoutObserver, false);
      Services.prefs.addObserver("zen.view.sidebar-expanded", this.#layoutObserver, false);

      // Observer 3: sidebar-box width changes via ResizeObserver (catches Compact Mode transitions)
      const sidebarBox = document.getElementById("tabbrowser-tabbox") ||
                         document.getElementById("sidebar-box") ||
                         document.getElementById("sidebar-container");
      if (sidebarBox && typeof ResizeObserver !== "undefined") {
        let lastWidth = sidebarBox.getBoundingClientRect().width;
        this.#resizeObs = new ResizeObserver(() => {
          const newWidth = sidebarBox.getBoundingClientRect().width;
          const crossedThreshold = (lastWidth >= Constants.Apps.COLLAPSED_WIDTH_THRESHOLD && newWidth < Constants.Apps.COLLAPSED_WIDTH_THRESHOLD) || (lastWidth < Constants.Apps.COLLAPSED_WIDTH_THRESHOLD && newWidth >= Constants.Apps.COLLAPSED_WIDTH_THRESHOLD);
          lastWidth = newWidth;
          if (crossedThreshold) {
            if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralApps] Sidebar width crossed threshold (", newWidth, "px) \u2192 repositionGrid");
            this.scheduleRepositionGrid(80);
          }
        });
        this.#resizeObs.observe(sidebarBox);
      }

      // Clean up pref observers when window closes to prevent ghost observers (H-03)
      window.addEventListener("unload", () => {
        try { Services.prefs.removeObserver("zen.view.use-single-toolbar", layoutObserver); } catch (_) {}
        try { Services.prefs.removeObserver("zen.view.sidebar-expanded", layoutObserver); } catch (_) {}
        this.stopPositionTracking();
      }, { once: true });

      this.scheduleRepositionGrid(200);
    }
  }
  /* ====
   * 4.0 TAB GROUPS MODULE (ZentralTabGroups)
   * ============================================================================
   */

  /**
   * Zentral Tab Groups Module
   * Enhances native tab groups with color pickers, folder integration, tooltips, and state persistence.
   */
  class ZentralTabGroups {
    /** @private Tabstrip MutationObserver */
    #tabStripObserver = null;
    /** @private Native popup suppression listener */
    #popupShowingListener = null;
    /** @private Global group context menu event listener */
    #groupContextMenuHandler = null;
    /** @private Global blocker for group toggle on right click */
    #groupRightClickBlocker = null;
    /** @private Global listener for submenu popups */
    _tabContextSubmenuListener = null;
    /** @private Cleanup function for tab drag selection guard */
    #dragGuardCleanup = null;
    /** @private Flag indicating if tab drag selection guard is active */
    #tabDragGuardInitialized = false;
    /** @private Latch indicating session restore settlement in progress */
    #isRestoring = false;
    /** @private SessionStore observer callback */
    #sessionRestoreObserver = null;
    /** @private Settlement fallback timer */
    #restoreSettleTimer = null;
    /** @private Workspace switch listener for multi-space reconstruction */
    #workspaceSwitchListener = null;
    /** @private TabOpen event listener for smart grouping */
    #tabOpenListener = null;

    /**
     * Safely retrieves Firefox SessionStore service for persistent tab metadata across restarts.
     * @private
     */
    #getSessionStore() {
      try {
        if (typeof SessionStore !== "undefined" && SessionStore) return SessionStore;
        if (window.SessionStore) return window.SessionStore;
        return ChromeUtils.importESModule("resource:///modules/sessionstore/SessionStore.sys.mjs").SessionStore;
      } catch (_) {
        try {
          return ChromeUtils.import("resource:///modules/sessionstore/SessionStore.jsm").SessionStore;
        } catch (_) {
          return null;
        }
      }
    }
    /** @private Root attribute MutationObserver */
    #rootAttrObs = null;
    /** @private Sidebar attr update listener for prefs */
    #updateSidebarAttr = null;

    /**
     * Determines the Zen workspace UUID for a DOM element (tab or tab-group).
     * Traverses direct attributes, parent/ancestor workspace sections, and child tabs.
     * @param {Element} el - Tab or tab-group element.
     * @returns {string} Workspace UUID string or active workspace fallback.
     */
    getWorkspaceForElement(el) {
      if (!el) return "";
      try {
        // 1. Direct workspace ID attribute
        let ws = el.getAttribute?.("zen-workspace-id") || el.getAttribute?.("data-zentral-group-ws");
        if (ws && ws !== "undefined" && ws !== "null") return ws;

        // 2. Ancestor <zen-workspace> container (Zen native element)
        const zenWs = el.closest?.("zen-workspace");
        if (zenWs?.id) return zenWs.id;

        // 3. Ancestor tabs section within a workspace element
        const section = el.closest?.(".zen-workspace-tabs-section, .zen-workspace-normal-tabs-section");
        if (section) {
          const wsBox = section.closest?.("[id]");
          if (wsBox?.id && window.gZenWorkspaces?.getWorkspaceFromId?.(wsBox.id)) {
            return wsBox.id;
          }
        }

        // 4. If this is a tab-group, check member tabs inside it
        if (el.tagName?.toLowerCase() === "tab-group") {
          const childTabs = el.querySelectorAll?.("tab, tabbrowser-tab, .tabbrowser-tab");
          if (childTabs) {
            for (const t of childTabs) {
              const tWs = this.getWorkspaceForElement(t);
              if (tWs) return tWs;
            }
          }
        }
      } catch (_) {}
      return window.gZenWorkspaces?.activeWorkspace || "";
    }

    /**
     * Creates an SVG element from an XML string.
     * @private
     * @param {string} xmlString - SVG XML markup string.
     * @returns {Element} Parsed SVG DOM element.
     */
    #createSVG(xmlString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "image/svg+xml");
      return doc.documentElement;
    }

    /**
     * Module tear down for Sine hot unloading
     */
    destroy() {
      try {
        if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralTabGroups] Destroying TabGroups module...");

        // 1. Clear timers
        if (this.#restoreSettleTimer) {
          clearTimeout(this.#restoreSettleTimer);
          this.#restoreSettleTimer = null;
        }
        if (this.#state && this.#state.saveStateTimer) {
          clearTimeout(this.#state.saveStateTimer);
          this.#state.saveStateTimer = null;
        }
        if (window.zentralTooltipHideTimer) {
          clearTimeout(window.zentralTooltipHideTimer);
          window.zentralTooltipHideTimer = null;
        }
        if (this.#sessionRestoreObserver && typeof Services !== "undefined" && Services.obs) {
          try {
            Services.obs.removeObserver(this.#sessionRestoreObserver, "sessionstore-windows-restored");
          } catch (_) {}
          this.#sessionRestoreObserver = null;
        }
        this.#isRestoring = false;

        // 2. Disconnect observers
        if (this.#tabStripObserver) {
          try { this.#tabStripObserver.disconnect(); } catch (_) {}
          this.#tabStripObserver = null;
        }
        if (this.#rootAttrObs) {
          try { this.#rootAttrObs.disconnect(); } catch (_) {}
          this.#rootAttrObs = null;
        }
        if (this.#updateSidebarAttr) {
          try { Services.prefs.removeObserver("zen.view.sidebar-expanded", this.#updateSidebarAttr); } catch (_) {}
          try { Services.prefs.removeObserver("zen.view.use-single-toolbar", this.#updateSidebarAttr); } catch (_) {}
          this.#updateSidebarAttr = null;
        }
        if (this.#popupShowingListener) {
          try { window.removeEventListener("popupshowing", this.#popupShowingListener, true); } catch (_) {}
          this.#popupShowingListener = null;
        }
        if (this.#tabOpenListener) {
          try {
            if (window.gBrowser?.tabContainer) {
              window.gBrowser.tabContainer.removeEventListener("TabOpen", this.#tabOpenListener);
            }
          } catch (_) {}
          this.#tabOpenListener = null;
        }
        if (this.#groupContextMenuHandler) {
          try { window.removeEventListener("contextmenu", this.#groupContextMenuHandler, true); } catch (_) {}
          this.#groupContextMenuHandler = null;
        }
        if (this.#groupRightClickBlocker) {
          try { window.removeEventListener("mousedown", this.#groupRightClickBlocker, true); } catch (_) {}
          try { window.removeEventListener("mouseup", this.#groupRightClickBlocker, true); } catch (_) {}
          try { window.removeEventListener("click", this.#groupRightClickBlocker, true); } catch (_) {}
          this.#groupRightClickBlocker = null;
        }
        if (this._tabContextSubmenuListener) {
          try { window.removeEventListener("popupshowing", this._tabContextSubmenuListener, true); } catch (_) {}
          this._tabContextSubmenuListener = null;
        }
        if (this.#dragGuardCleanup) {
          try { this.#dragGuardCleanup(); } catch (_) {}
          this.#dragGuardCleanup = null;
        }
        if (this.#workspaceSwitchListener) {
          try { window.removeEventListener("zen-workspace-switched", this.#workspaceSwitchListener); } catch (_) {}
          try { window.removeEventListener("zen-workspace-changed", this.#workspaceSwitchListener); } catch (_) {}
          try { window.removeEventListener("zen-workspaces-change", this.#workspaceSwitchListener); } catch (_) {}
          this.#workspaceSwitchListener = null;
        }

        // 3. Remove injected DOM elements
        const idsToRemove = [
          "zentral-tabgroups-styles",
          "zentral-tabgroup-tooltip",
          "zentral-tabgroup-tooltip-container",
          "zentral-tabgroup-context-menu",
          "advanced-tab-groups-context-menu",
          "zentral-color-picker-panel",
          "zentral-group-color-picker",
          "context_zenFolderUngroup_sep",
          "context_zenFolderUngroup"
        ];
        idsToRemove.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.remove();
        });

        // 4. Secure state persistence across restarts: capture full hierarchy and tab assignments across all workspaces
        const ss = this.#getSessionStore();
        const currentWs = window.gZenWorkspaces?.activeWorkspace;
        const allGroups = Array.from(document.querySelectorAll("tab-group:not([split-view-group])"));

        // Load existing state to preserve groups from other workspaces
        let existingGroups = {};
        let existingTabMapping = {};
        try {
          const stateStr = Core.getPref(Constants.TabGroups.PREF_STATE);
          if (stateStr && stateStr !== "{}") {
            const parsed = JSON.parse(stateStr);
            existingGroups = (parsed && parsed.groups) ? parsed.groups : (parsed || {});
            existingTabMapping = (parsed && parsed.tabMapping) ? parsed.tabMapping : {};
          }
        } catch (_) {}

        const mergedGroups = { ...existingGroups };
        const mergedTabMapping = { ...existingTabMapping };

        allGroups.forEach(group => {
          if (!group.id) group.id = "zentral-group-" + Math.random().toString(36).substr(2, 9);
          const parentGroup = group.parentElement?.closest("tab-group:not([split-view-group])");
          const parentId = parentGroup?.id || null;
          const label = group.label || group.getAttribute("label") || "Group";
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color") || "";
          const isCollapsed = group.hasAttribute("collapsed") && group.getAttribute("collapsed") === "true";
          const wsId = this.getWorkspaceForElement(group);
          if (wsId) group.setAttribute("zen-workspace-id", wsId);

          const posContainer = parentGroup || group.parentElement;
          const groupSiblings = posContainer
            ? Array.from(posContainer.children).filter(el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group"))
            : [];
          const index = groupSiblings.indexOf(group);

          mergedGroups[group.id] = {
            id: group.id,
            label,
            color,
            collapsed: isCollapsed,
            parentId,
            workspaceId: wsId,
            index: index >= 0 ? index : 0
          };

          // Collect direct tabs of this group
          let directTabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab")).filter(t => t.closest("tab-group") === group);
          if (directTabs.length === 0 && group.tabs) {
            directTabs = Array.from(group.tabs);
          }

          mergedTabMapping[group.id] = directTabs.map(t => ({
            zenTabId: t.getAttribute("zen-tab-id") || t.id,
            url: t.linkedBrowser?.currentURI?.spec || ""
          }));

          directTabs.forEach(tab => {
            if (!tab) return;
            tab.setAttribute("data-zentral-group-id", group.id);
            tab.setAttribute("data-zentral-group-label", label);
            if (color) tab.setAttribute("data-zentral-group-color", color);
            tab.setAttribute("data-zentral-group-collapsed", isCollapsed ? "true" : "false");
            if (wsId) {
              tab.setAttribute("data-zentral-group-ws", wsId);
              tab.setAttribute("zen-workspace-id", wsId);
            }
            if (parentId) tab.setAttribute("data-zentral-parent-id", parentId);

            // Persist into Firefox SessionStore so metadata survives browser restarts & cache clears
            if (ss && typeof ss.setCustomTabValue === "function") {
              try {
                ss.setCustomTabValue(tab, "zentral-group-id", group.id);
                ss.setCustomTabValue(tab, "zentral-group-label", label);
                if (color) ss.setCustomTabValue(tab, "zentral-group-color", color);
                if (parentId) ss.setCustomTabValue(tab, "zentral-parent-id", parentId);
                ss.setCustomTabValue(tab, "zentral-group-collapsed", isCollapsed ? "true" : "false");
                if (wsId) ss.setCustomTabValue(tab, "zentral-group-ws", wsId);
              } catch (_) {}
            }
          });
        });

        // Persist full merged state across all workspaces to preferences
        Core.setPref(Constants.TabGroups.PREF_STATE, JSON.stringify({
          groups: mergedGroups,
          tabMapping: mergedTabMapping
        }));

        // 5. Flatten groups cleanly into regular top-level tabs across their respective workspaces
        const rootTabContainer = (typeof gZenWorkspaces !== "undefined" && gZenWorkspaces.activeWorkspaceStrip) ||
                                 gBrowser?.tabContainer?.arrowscrollbox ||
                                 gBrowser?.tabContainer ||
                                 document.getElementById("tabbrowser-tabs");

        const sortedGroups = allGroups.slice().sort((a, b) => {
          let depthA = 0, currA = a;
          while ((currA = currA.parentElement?.closest("tab-group"))) depthA++;
          let depthB = 0, currB = b;
          while ((currB = currB.parentElement?.closest("tab-group"))) depthB++;
          return depthB - depthA;
        });

        sortedGroups.forEach(group => {
          try {
            const obs = this.#groupObservers.get(group);
            if (obs) {
              obs.disconnect();
              this.#groupObservers.delete(group);
            }

            if (group.shadowRoot) {
              group.shadowRoot.querySelectorAll('.zentral-shadow-style').forEach(s => s.remove());
            }

            const wsId = this.getWorkspaceForElement(group);
            const wsNormalSection = wsId && window.gZenWorkspaces?.workspaceElement(wsId)?.querySelector(".zen-workspace-normal-tabs-section");
            const parentContainer = (group.parentNode && group.parentNode.isConnected) ? group.parentNode : (wsNormalSection || rootTabContainer);

            const tabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab")).filter(t => t.closest("tab-group") === group);

            // Move tabs directly before the group container in its workspace
            tabs.forEach(tab => {
              if (group.parentNode && group.parentNode === parentContainer) {
                try {
                  parentContainer.insertBefore(tab, group);
                } catch (_) {
                  try { parentContainer.appendChild(tab); } catch (_) {}
                }
              } else if (parentContainer) {
                try { parentContainer.appendChild(tab); } catch (_) {}
              }

              // Clear native grouping pointers so tabs display as regular flat tabs without indentations
              try { if (typeof gBrowser?.addTabToGroup === "function") gBrowser.addTabToGroup(tab, null); } catch (_) {}
              try { tab.group = null; } catch (_) {}
              try { tab.removeAttribute("group"); tab.removeAttribute("zen-group"); } catch (_) {}
              // Retain data-zentral-group-id, data-zentral-group-ws, and SessionStore for seamless restore on re-enable
            });

            // Cleanly remove the tab-group element so there are no empty gaps in the strip
            try {
              group.remove();
            } catch (_) {}
          } catch (e) {
            console.error("[ZentralTabGroups] Error flattening group on destroy:", e);
          }
        });

        // 6. Clean up root attributes
        document.documentElement.removeAttribute("zentral-sidebar-collapsed");
        document.documentElement.removeAttribute("zentral-show-chevron");
        document.documentElement.removeAttribute("zentral-label-opacity-below-85");
        document.documentElement.removeAttribute("zen-renaming-group");
        document.documentElement.style.removeProperty("--zentral-tabgroup-label-opacity");
        document.getElementById("tabbrowser-tabs")?.removeAttribute("zentral-sidebar-collapsed");

        this.#processedGroups = new WeakSet();
        if (this.#state) {
          this.#state.sharedContextMenu = null;
          this.#state.colorPickerPanel = null;
          this.#state.contextMenuCurrentGroup = null;
        }
      } catch (err) {
        console.error("[ZentralTabGroups] Error during destroy:", err);
      }
    }

    /**
     * 4.1 Initialization & Internal Properties
     * @private
     */
    #state = {
      editingGroup: null,
      groupEdited: null,
      sharedContextMenu: null,
      contextMenuCurrentGroup: null,
      saveStateTimer: null,
      colorPickerPanel: null
    };

    /** @private Tracks which groups have been processed this session (replaces fragile DOM attribute) */
    #processedGroups = new WeakSet();

    /** @private Tracks per-group style MutationObserver instances for cleanup on group removal */
    #groupObservers = new WeakMap();

    /**
     * Constructs ZentralTabGroups instance and binds context methods.
     */
    constructor() {
      // Method bindings
      this.onTabGroupCreate = this.onTabGroupCreate.bind(this);
      this.renameGroupKeydown = this.renameGroupKeydown.bind(this);
      this.renameGroupHalt = this.renameGroupHalt.bind(this);
    }

    /**
     * Reconstructs tab-group containers from tabs tagged with data-zentral-group-* attributes, SessionStore values, or saved state.
     */
    reconstructSavedGroups() {
      try {
        const ss = this.#getSessionStore();
        let savedState = null;
        try {
          const stateStr = Core.getPref(Constants.TabGroups.PREF_STATE);
          if (stateStr && stateStr !== "{}") {
            savedState = JSON.parse(stateStr);
          }
        } catch (_) {}

        const savedGroupsMap = (savedState && savedState.groups) ? savedState.groups : (savedState || {});
        const savedTabMapping = (savedState && savedState.tabMapping) ? savedState.tabMapping : {};

        const getAllTabs = () => {
          const tabSet = new Set();
          if (window.gZenWorkspaces?.allStoredTabs) {
            try {
              for (const t of window.gZenWorkspaces.allStoredTabs) {
                if (t) tabSet.add(t);
              }
            } catch (_) {}
          }
          try {
            document.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab").forEach(t => tabSet.add(t));
          } catch (_) {}
          try {
            if (gBrowser?.tabs) {
              for (const t of gBrowser.tabs) {
                if (t) tabSet.add(t);
              }
            }
          } catch (_) {}
          return Array.from(tabSet);
        };

        const allTabs = getAllTabs();
        const groupsToReconstruct = new Map();

        // 1. Match tabs to groups using DOM attributes, SessionStore, or URL fallback
        allTabs.forEach(tab => {
          if (tab.hasAttribute?.("is-zen-split") || tab.hasAttribute?.("zen-split-view") || tab.closest?.("tab-group[split-view-group], tab-group[zen-split-view], tab-group[is-zen-split]")) {
            return;
          }

          let groupId = tab.getAttribute("data-zentral-group-id");
          if (!groupId && ss && typeof ss.getCustomTabValue === "function") {
            groupId = ss.getCustomTabValue(tab, "zentral-group-id");
          }

          // Fallback: match by zenTabId or URL from tabMapping
          if (!groupId && savedTabMapping) {
            const tabUrl = tab.linkedBrowser?.currentURI?.spec;
            const zenTabId = tab.getAttribute("zen-tab-id") || tab.id;
            for (const [gId, tabList] of Object.entries(savedTabMapping)) {
              if (Array.isArray(tabList) && tabList.some(item => (zenTabId && item.zenTabId === zenTabId) || (tabUrl && tabUrl !== "about:blank" && item.url === tabUrl))) {
                groupId = gId;
                break;
              }
            }
          }

          if (groupId) {
            if (!groupsToReconstruct.has(groupId)) {
              const savedMeta = savedGroupsMap[groupId] || {};
              const label = tab.getAttribute("data-zentral-group-label") ||
                            (ss?.getCustomTabValue?.(tab, "zentral-group-label")) ||
                            savedMeta.label ||
                            "Group";
              const color = tab.getAttribute("data-zentral-group-color") ||
                            (ss?.getCustomTabValue?.(tab, "zentral-group-color")) ||
                            savedMeta.color ||
                            "";
              const parentId = tab.getAttribute("data-zentral-parent-id") ||
                               (ss?.getCustomTabValue?.(tab, "zentral-parent-id")) ||
                               savedMeta.parentId ||
                               null;
              const collapsed = tab.getAttribute("data-zentral-group-collapsed") === "true" ||
                                (ss?.getCustomTabValue?.(tab, "zentral-group-collapsed") === "true") ||
                                savedMeta.collapsed === true;
              const wsId = tab.getAttribute("data-zentral-group-ws") ||
                           (ss?.getCustomTabValue?.(tab, "zentral-group-ws")) ||
                           savedMeta.workspaceId ||
                           "";
              const index = savedMeta.index ?? 0;

              groupsToReconstruct.set(groupId, {
                id: groupId,
                label,
                color,
                parentId,
                collapsed,
                workspaceId: wsId,
                index,
                tabs: []
              });
            }
            groupsToReconstruct.get(groupId).tabs.push(tab);
          }
        });

        // Also add missing parent groups and any groups from savedGroupsMap
        if (savedGroupsMap) {
          for (const [gId, meta] of Object.entries(savedGroupsMap)) {
            if (meta && !groupsToReconstruct.has(gId)) {
              groupsToReconstruct.set(gId, {
                id: meta.id || gId,
                label: meta.label || "Group",
                color: meta.color || "",
                parentId: meta.parentId || null,
                collapsed: meta.collapsed === true,
                workspaceId: meta.workspaceId || "",
                index: meta.index ?? 0,
                tabs: []
              });
            }
          }

          let addedParent = true;
          while (addedParent) {
            addedParent = false;
            const currentGroups = Array.from(groupsToReconstruct.values());
            for (const g of currentGroups) {
              if (g.parentId && !groupsToReconstruct.has(g.parentId) && savedGroupsMap[g.parentId]) {
                const meta = savedGroupsMap[g.parentId];
                groupsToReconstruct.set(g.parentId, {
                  id: meta.id,
                  label: meta.label || "Group",
                  color: meta.color || "",
                  parentId: meta.parentId || null,
                  collapsed: meta.collapsed === true,
                  workspaceId: meta.workspaceId || "",
                  index: meta.index ?? 0,
                  tabs: []
                });
                addedParent = true;
              }
            }
          }
        }

        // Ensure all groups in groupsToReconstruct have their matching tabs populated
        for (const [gId, info] of groupsToReconstruct.entries()) {
          if (info.tabs.length === 0) {
            const memberTabs = allTabs.filter(t => {
              const tabGId = t.getAttribute("data-zentral-group-id") || (ss?.getCustomTabValue?.(t, "zentral-group-id"));
              if (tabGId === gId) return true;
              if (savedTabMapping && Array.isArray(savedTabMapping[gId])) {
                const zenTabId = t.getAttribute("zen-tab-id") || t.id;
                const tabUrl = t.linkedBrowser?.currentURI?.spec;
                return savedTabMapping[gId].some(item => (zenTabId && item.zenTabId === zenTabId) || (tabUrl && tabUrl !== "about:blank" && item.url === tabUrl));
              }
              return false;
            });
            info.tabs.push(...memberTabs);
          }
        }

        if (groupsToReconstruct.size === 0) return;

        if (Core.getPref(Constants.DEBUG_PREF)) {
          console.log(`[ZentralTabGroups] Reconstructing ${groupsToReconstruct.size} groups...`);
        }

        const rootTabContainer = (typeof gZenWorkspaces !== "undefined" && gZenWorkspaces.activeWorkspaceStrip) ||
                                 gBrowser?.tabContainer?.arrowscrollbox ||
                                 gBrowser?.tabContainer ||
                                 document.getElementById("tabbrowser-tabs");

        // 2. Sort groups in topological order (parents first, then nested child groups by depth)
        const getGroupDepth = (id, visited = new Set()) => {
          if (visited.has(id)) return 0;
          visited.add(id);
          const pId = groupsToReconstruct.get(id)?.parentId;
          if (!pId || !groupsToReconstruct.has(pId)) return 0;
          return 1 + getGroupDepth(pId, visited);
        };

        const sortedGroupIds = Array.from(groupsToReconstruct.keys()).sort((a, b) => {
          const depthA = getGroupDepth(a);
          const depthB = getGroupDepth(b);
          if (depthA !== depthB) return depthA - depthB;
          const idxA = groupsToReconstruct.get(a).index ?? 0;
          const idxB = groupsToReconstruct.get(b).index ?? 0;
          return idxA - idxB;
        });

        // Helper to instantiate a fully-structured tab-group DOM element
        const createGroupElement = (info) => {
          let group = document.getElementById(info.id);
          if (group) {
            // If this group already exists in the DOM as a native Zen split view, skip it entirely.
            if (group.hasAttribute("split-view-group") || group.hasAttribute("zen-split-view") || group.hasAttribute("is-zen-split")) {
              return null;
            }
          } else {
            group = document.createXULElement ? document.createXULElement("tab-group") : document.createElement("tab-group");
            group.id = info.id;
          }
          group.setAttribute("label", info.label || "Group");
          group.label = info.label || "Group";
          if (info.workspaceId) group.setAttribute("zen-workspace-id", info.workspaceId);

          // Guarantee full internal structure exists
          let labelContainer = group.querySelector(".tab-group-label-container");
          if (!labelContainer) {
            labelContainer = document.createElement("div");
            labelContainer.className = "tab-group-label-container";
            group.insertBefore(labelContainer, group.firstChild);
          }
          let innerLabel = labelContainer.querySelector(".tab-group-label");
          if (!innerLabel) {
            innerLabel = document.createElement("label");
            innerLabel.className = "tab-group-label";
            labelContainer.appendChild(innerLabel);
          }
          innerLabel.textContent = info.label || "Group";

          let groupTabContainer = group.querySelector(".tab-group-container");
          if (!groupTabContainer) {
            groupTabContainer = document.createElement("div");
            groupTabContainer.className = "tab-group-container";
            group.appendChild(groupTabContainer);
          }

          return group;
        };

        // 3. Create and place each group in DOM, preserving parent-child nesting
        sortedGroupIds.forEach(gId => {
          try {
            const info = groupsToReconstruct.get(gId);
            const group = createGroupElement(info);
            if (!group) return; // Skipped — native split view group

            // Determine correct insertion parent: nested inside parentGroup or at rootTabContainer
            let parentEl = null;
            if (info.parentId && groupsToReconstruct.has(info.parentId)) {
              const parentGroup = document.getElementById(info.parentId);
              if (parentGroup && !group.contains(parentGroup)) {
                parentEl = parentGroup.querySelector(".tab-group-container") || parentGroup;
              }
            }

            if (!parentEl) {
              // 1. If group has an explicit workspaceId, find that workspace's normal tabs container
              const wsId = info.workspaceId;
              if (wsId && window.gZenWorkspaces) {
                const wsEl = window.gZenWorkspaces.workspaceElement(wsId);
                const normalSection = wsEl?.querySelector(".zen-workspace-normal-tabs-section") || wsEl;
                if (normalSection) {
                  parentEl = normalSection;
                }
              }
            }

            if (!parentEl) {
              if (info.tabs.length > 0 && info.tabs[0].parentNode) {
                const candidateParent = info.tabs[0].parentNode;
                // Guard: if the candidate parent is inside the group itself (e.g. .tab-group-container),
                // using it as parentEl would cause HierarchyRequestError on insertBefore.
                if (candidateParent && candidateParent !== group && !group.contains(candidateParent)) {
                  parentEl = candidateParent;
                } else {
                  parentEl = rootTabContainer;
                }
              } else {
                parentEl = rootTabContainer;
              }
            }

            // Only move the group if it's completely disconnected or in the wrong parent.
            // This preserves native session restore absolute positioning for root groups.
            const currentParent = group.parentNode;
            const isInCorrectParent = currentParent === parentEl || currentParent === parentEl.parentNode;
            
            if (!group.isConnected || !isInCorrectParent) {
              let targetNode = null;
              
              if (info.tabs.length > 0 && info.tabs[0].parentNode === parentEl) {
                targetNode = info.tabs[0];
              } else if (typeof info.index === "number" && info.index >= 0 && info.index < parentEl.children.length) {
                targetNode = parentEl.children[info.index];
              }

              if (targetNode && targetNode !== group) {
                parentEl.insertBefore(group, targetNode);
              } else {
                parentEl.appendChild(group);
              }
            }

            // Move member tabs into this group container
            const targetTabContainer = group.querySelector(".tab-group-container") || group;
            info.tabs.forEach(tab => {
              if (tab.parentNode !== targetTabContainer) {
                try {
                  targetTabContainer.appendChild(tab);
                } catch (_) {}
              }
              try { tab.group = group; } catch (_) {}
              try { tab.setAttribute("group", group.id); } catch (_) {}
              try { tab.setAttribute("zen-group", group.id); } catch (_) {}
              try { if (typeof gBrowser?.addTabToGroup === "function") gBrowser.addTabToGroup(tab, group); } catch (_) {}

              // Preserve tracking attributes on tabs for resilience
              tab.setAttribute("data-zentral-group-id", group.id);
              if (info.label) tab.setAttribute("data-zentral-group-label", info.label);
              if (info.color) tab.setAttribute("data-zentral-group-color", info.color);
              if (info.workspaceId) {
                tab.setAttribute("data-zentral-group-ws", info.workspaceId);
                tab.setAttribute("zen-workspace-id", info.workspaceId);
              }
            });

            // Restore colors
            let savedColorsMap = {};
            try {
              const rawColors = Core.getPref(Constants.TabGroups.PREF_COLORS);
              if (rawColors && rawColors !== "{}") savedColorsMap = JSON.parse(rawColors) || {};
            } catch (_) {}
            const savedColor = info.color || savedColorsMap[gId] || (savedGroupsMap[gId]?.color);
            if (savedColor) {
              group.style.setProperty("--tab-group-color", savedColor);
              group.style.setProperty("--tab-group-color-invert", savedColor);
              group.style.setProperty("--zentral-custom-color", savedColor);
              group.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(savedColor));
            }

            // Restore collapsed state
            if (info.collapsed) {
              group.setAttribute("collapsed", "true");
              group.collapsed = true;
            } else {
              group.removeAttribute("collapsed");
              group.collapsed = false;
            }

            this.processGroup(group);
          } catch (err) {
            console.error(`[ZentralTabGroups] Error reconstructing group ${gId}:`, err);
          }
        });
      } catch (e) {
        console.error("[ZentralTabGroups] Error in reconstructSavedGroups:", e);
      }
    }

    /* --------------------------------------------------------------------------
     * 4.2 Custom CSS & Visual Enhancements
     * --------------------------------------------------------------------------
     */

    /**
     * Updates the collapsed sidebar marquee label with clean text, clone, and overflow duration.
     * @param {Element} labelContainer - Group label container element.
     * @param {string} title - Group title text.
     */
    updateCollapsedLabel(labelContainer, title) {
      if (!labelContainer) return;
      let initialsEl = labelContainer.querySelector(".zentral-group-initials");
      if (!initialsEl) {
        initialsEl = document.createElement("div");
        initialsEl.className = "zentral-group-initials";
        const wrapper = labelContainer.querySelector(".zentral-tab-title-wrapper");
        if (wrapper) wrapper.appendChild(initialsEl);
        else labelContainer.appendChild(initialsEl);
      }

      const cleanTitle = (title || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
      initialsEl.setAttribute("data-title", cleanTitle);
      
      const charCount = cleanTitle.length;
      const isOverflowing = charCount > 3;
      if (isOverflowing) {
        initialsEl.setAttribute("data-overflows", "true");
        // Calculate adaptive scroll duration (~30px/s)
        const durationSec = Math.max(2.5, Math.min(8.0, (charCount * 8 + 24) / 30)).toFixed(1);
        initialsEl.style.setProperty("--zentral-marquee-duration", `${durationSec}s`);
      } else {
        initialsEl.removeAttribute("data-overflows");
        initialsEl.style.removeProperty("--zentral-marquee-duration");
      }

      initialsEl.replaceChildren();

      const track = document.createElement("span");
      track.className = "zentral-marquee-track";

      const item1 = document.createElement("span");
      item1.className = "zentral-marquee-item";
      const text1 = document.createElement("span");
      text1.className = "zentral-marquee-text";
      text1.textContent = cleanTitle;
      const spacer1 = document.createElement("span");
      spacer1.className = "zentral-marquee-spacer";
      spacer1.textContent = " • ";
      item1.appendChild(text1);
      item1.appendChild(spacer1);
      track.appendChild(item1);

      if (isOverflowing) {
        const item2 = document.createElement("span");
        item2.className = "zentral-marquee-item";
        item2.setAttribute("aria-hidden", "true");
        const text2 = document.createElement("span");
        text2.className = "zentral-marquee-text";
        text2.textContent = cleanTitle;
        const spacer2 = document.createElement("span");
        spacer2.className = "zentral-marquee-spacer";
        spacer2.textContent = " • ";
        item2.appendChild(text2);
        item2.appendChild(spacer2);
        track.appendChild(item2);
      }

      initialsEl.appendChild(track);
    }

    /**
     * Safely schedules or executes hiding of the tab group tooltip panel,
     * ensuring it does NOT close if the user is currently hovering over the popup or label.
     * @param {number} [delayMs=350] - Delay before hide check in milliseconds.
     */
    safeHideTooltip(delayMs = 350) {
      if (window.zentralTooltipHideTimer) {
        clearTimeout(window.zentralTooltipHideTimer);
        window.zentralTooltipHideTimer = null;
      }
      window.zentralTooltipHideTimer = setTimeout(() => {
        const panel = document.getElementById("zentral-tabgroup-tooltip");
        const container = document.getElementById("zentral-tabgroup-tooltip-container");
        if (!panel || typeof panel.hidePopup !== "function") return;

        // Check if mouse is currently hovering over panel, container, or active label
        const isHovered =
          (panel.matches && panel.matches(":hover")) ||
          (container && container.matches && container.matches(":hover")) ||
          !!document.querySelector('[zentral-hover="true"]:hover');

        if (isHovered) {
          // User is hovering the popup or label ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keep it open!
          return;
        }

        panel.hidePopup();
      }, delayMs);
    }

    /**
     * Retrieves only the direct tabs belonging to a group, excluding tabs inside nested child groups.
     * @param {Element} group - Tab group DOM element.
     * @returns {Array<Element>} Array of direct tab elements.
     */
    getDirectTabs(group) {
      if (!group) return [];
      
      const domTabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab, [is='tabbrowser-tab']"));
      const nativeTabs = group.tabs ? Array.from(group.tabs) : [];
      const combined = Array.from(new Set([...domTabs, ...nativeTabs]));
      
      let directTabs = combined.filter(t => {
        if (!t) return false;
        
        // Exclude if physically located inside a nested child tab-group
        const closest = t.closest ? t.closest("tab-group") : null;
        if (closest && closest !== group) return false;
        
        // Exclude if tab references a different group
        if (t.group && t.group !== group) return false;
        const tGId = t.getAttribute?.("group") || t.getAttribute?.("zen-group") || t.getAttribute?.("data-zentral-group-id");
        if (tGId && group.id && tGId !== group.id) return false;
        
        return true;
      });

      if (directTabs.length === 0 && window.gBrowser?.tabs) {
        directTabs = Array.from(gBrowser.tabs).filter(t => {
          if (!t) return false;
          const closest = t.closest ? t.closest("tab-group") : null;
          if (closest && closest !== group) return false;
          if (t.group && t.group !== group) return false;
          const tGId = t.getAttribute?.("group") || t.getAttribute?.("zen-group") || t.getAttribute?.("data-zentral-group-id");
          if (tGId && group.id && tGId !== group.id) return false;
          return t.group === group || (group.id && tGId === group.id) || (closest === group);
        });
      }

      return directTabs;
    }

    /**
     * Initializes Tab Groups module observers, styles, color palettes, and tooltip containers.
     */
    init() {
      if (!Core.getPref(Constants.TabGroups.PREF_ENABLED)) {
        if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralTabGroups] Tab Groups feature is disabled.");
        return;
      }
      this.#isRestoring = true;
      this.clearStoredColorData();
      this.loadSavedColors();
      this.reconstructSavedGroups();
      this.injectStyles();
      this.setupObserver();
      this.setupPopupSuppression();
      this.addFolderContextMenuItems();
      this.removeBuiltinTabGroupMenu();
      this.enhanceTabContextMenu();
      this.initTabDragSelectionGuard();
      this.processExistingGroups();
      this.setupTabOpenHandler();

      // SessionStore Settlement Guard:
      // When the browser launches or caches are cleared, SessionStore injects tabs/groups asynchronously.
      // We block saves while #isRestoring is true, and re-nest/re-construct once SessionStore is finished.
      const settleRestore = () => {
        if (!this.#isRestoring) return;
        if (this.#restoreSettleTimer) {
          clearTimeout(this.#restoreSettleTimer);
          this.#restoreSettleTimer = null;
        }
        if (this.#sessionRestoreObserver && typeof Services !== "undefined" && Services.obs) {
          try {
            Services.obs.removeObserver(this.#sessionRestoreObserver, "sessionstore-windows-restored");
          } catch (_) {}
          this.#sessionRestoreObserver = null;
        }

        try {
          this.reconstructSavedGroups();
          this.loadTabGroupState();
          document.querySelectorAll("tab-group:not([split-view-group])").forEach(g => this.processGroup(g));
        } catch (err) {
          console.error("[ZentralTabGroups] Error settling session restore state:", err);
        } finally {
          this.#isRestoring = false;
          this.scheduleStateSave();
        }
      };

      if (typeof Services !== "undefined" && Services.obs) {
        this.#sessionRestoreObserver = (subject, topic) => {
          if (topic === "sessionstore-windows-restored") {
            settleRestore();
          }
        };
        try {
          Services.obs.addObserver(this.#sessionRestoreObserver, "sessionstore-windows-restored", false);
        } catch (_) {}
      }

      // Safety fallback timer in case sessionstore-windows-restored already fired or does not fire
      this.#restoreSettleTimer = setTimeout(settleRestore, 2500);

      // Workspace switch listener to ensure tab groups in newly focused Space are rendered & restored
      this.#workspaceSwitchListener = () => {
        try {
          this.reconstructSavedGroups();
          this.loadTabGroupState();
          document.querySelectorAll("tab-group:not([split-view-group])").forEach(g => this.processGroup(g));
        } catch (_) {}
      };
      window.addEventListener("zen-workspace-switched", this.#workspaceSwitchListener);
      window.addEventListener("zen-workspace-changed", this.#workspaceSwitchListener);
      window.addEventListener("zen-workspaces-change", this.#workspaceSwitchListener);

      // Collapsed Sidebar observer for Tab Groups
      const updateSidebarAttr = () => {
        try {
          const sidebarExpanded = Core.getNativePref("zen.view.sidebar-expanded", true);
          const singleToolbar = Core.getNativePref("zen.view.use-single-toolbar", true);
          const isCollapsed = !sidebarExpanded || 
                              document.documentElement.getAttribute("zen-sidebar-collapsed") === "true" ||
                              (document.getElementById("sidebar-box")?.getAttribute("collapsed") === "true");
          const tabContainer = document.getElementById("tabbrowser-tabs");
          if (tabContainer) {
            tabContainer.setAttribute("zentral-sidebar-collapsed", isCollapsed ? "true" : "false");
          }
          document.documentElement.setAttribute("zentral-sidebar-collapsed", isCollapsed ? "true" : "false");
        } catch (e) {}
      };
      updateSidebarAttr();
      this.#updateSidebarAttr = updateSidebarAttr;
      Services.prefs.addObserver("zen.view.sidebar-expanded", updateSidebarAttr, false);
      Services.prefs.addObserver("zen.view.use-single-toolbar", updateSidebarAttr, false);
      
      this.#rootAttrObs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === "zen-sidebar-collapsed" || m.attributeName === "zen-right-side") {
            updateSidebarAttr();
          }
        }
      });
      this.#rootAttrObs.observe(document.documentElement, { attributes: true, attributeFilter: ["zen-sidebar-collapsed", "zen-right-side"] });

      // Clean up pref observer on window close to prevent ghost observers (H-03)
      window.addEventListener("unload", () => {
        try { 
          Services.prefs.removeObserver("zen.view.sidebar-expanded", updateSidebarAttr);
          Services.prefs.removeObserver("zen.view.use-single-toolbar", updateSidebarAttr);
          rootAttrObs.disconnect();
        } catch (_) {}
      }, { once: true });

      // Tooltip injection (XUL panel with noautohide=true to avoid stealing click events)
      if (!document.getElementById("zentral-tabgroup-tooltip")) {
        const panel = document.createXULElement("panel");
        panel.id = "zentral-tabgroup-tooltip";
        panel.setAttribute("noautofocus", "true");
        panel.setAttribute("noautohide", "true");
        panel.setAttribute("type", "arrow");
        panel.setAttribute("role", "tooltip");

        const cancelHideTimer = () => {
          if (window.zentralTooltipHideTimer) {
            clearTimeout(window.zentralTooltipHideTimer);
            window.zentralTooltipHideTimer = null;
          }
        };

        panel.addEventListener("mouseenter", cancelHideTimer);
        panel.addEventListener("mouseleave", () => this.safeHideTooltip(350));
        panel.addEventListener("mouseover", cancelHideTimer);

        const container = document.createElement("div");
        container.id = "zentral-tabgroup-tooltip-container";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.overflowY = "auto";
        container.addEventListener("mouseenter", cancelHideTimer);
        container.addEventListener("mouseleave", () => this.safeHideTooltip(350));
        container.addEventListener("mouseover", cancelHideTimer);
        panel.appendChild(container);

        const popupset = document.getElementById("mainPopupSet") || document.documentElement;
        popupset.appendChild(panel);
      }
      
      this.applyChevronPref();
      this.applyIndicatorTypePref();
      this.applyLabelOpacityPref();
      Core.emit("tabGroupsInitComplete", this);
    }

    /**
     * Reads show_chevron preference and sets zentral-show-chevron attribute on root.
     */
    applyChevronPref() {
      const showChevron = Core.getPref(Constants.TabGroups.PREF_SHOW_CHEVRON);
      document.documentElement.setAttribute("zentral-show-chevron", showChevron !== false ? "true" : "false");
    }

    /**
     * Reads indicator_type preference ("circle"|"chevron") and sets zentral-indicator-type attribute on root.
     */
    applyIndicatorTypePref() {
      const indicatorType = Core.getPref(Constants.TabGroups.PREF_INDICATOR_TYPE, "circle");
      document.documentElement.setAttribute("zentral-indicator-type", indicatorType === "chevron" ? "chevron" : "circle");
    }

    /**
     * Reads label_opacity preference (0-100) and sets --zentral-tabgroup-label-opacity CSS variable and state attribute on root.
     */
    applyLabelOpacityPref() {
      const opacityPct = Core.getPref(Constants.TabGroups.PREF_LABEL_OPACITY);
      const val = typeof opacityPct === "number" ? Math.max(0, Math.min(100, opacityPct)) : 85;
      document.documentElement.style.setProperty("--zentral-tabgroup-label-opacity", (val / 100).toFixed(2));
      document.documentElement.setAttribute("zentral-label-opacity-below-85", val < 85 ? "true" : "false");
    }

    /**
     * Injects CSS styles for customized tab group pills, initial badges, and color pickers.
     */
    injectStyles() {
      const css = `

        /* Suppress Native Firefox/Zen Tab Group Editor Popups */
        #tab-group-editor,
        #tabgroup-editor-panel,
        #tabGroupEditor,
        tabgroup-editor-panel,
        .tab-group-editor,
        #tabGroupContextMenu,
        tabgroup-meu,
        panel[id*="tab-group-editor"],
        panel[id*="tabgroup-editor"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
        }

        /* Zentral Tooltip Styling (Matched to native Zen tab previews) */
        #zentral-tabgroup-tooltip {
          --panel-background: transparent !important;
          --panel-border-color: transparent !important;
          background: transparent !important;
          border: none !important;
        }
        #zentral-tabgroup-tooltip::part(content) {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        #zentral-tabgroup-tooltip-container {
          background: var(--zen-colors-tertiary, var(--arrowpanel-background, var(--tabpanels-background-color, #1e1e22))) !important;
          color: var(--zen-colors-text, var(--arrowpanel-color, var(--in-content-page-color, #fbfbfe))) !important;
          border: 1px solid var(--zen-colors-border, var(--arrowpanel-border-color, color-mix(in srgb, currentColor 12%, rgba(255, 255, 255, 0.08)))) !important;
          border-radius: 12px !important;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px color-mix(in srgb, currentColor 8%, transparent) !important;
          padding: 6px !important;
          gap: 2px !important;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          max-height: 320px !important;
          backdrop-filter: blur(20px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
        }
        .zentral-tooltip-row {
          position: relative !important;
          padding: 6px 10px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          border: 1px solid transparent !important;
          box-sizing: border-box !important;
          transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          max-width: 320px !important;
        }
        #tab-label-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid color-mix(in srgb, currentColor 40%, transparent) !important;
          border-radius: 6px !important;
          color: var(--zentral-tabgroup-contrast-color, #ffffff) !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          font-family: inherit !important;
          text-align: center !important;
          padding: 2px 6px !important;
          margin: 0 !important;
          outline: none !important;
          width: 100% !important;
          max-width: 180px !important;
          box-sizing: border-box !important;
          order: 2 !important;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3) !important;
        }
        .zentral-tooltip-row:hover {
          background-color: color-mix(in srgb, currentColor 10%, transparent) !important;
        }
        .zentral-tooltip-row[data-active="true"] {
          background-color: color-mix(in srgb, var(--zen-primary-color, #707ac2) 24%, rgba(255, 255, 255, 0.12)) !important;
          border: 1px solid color-mix(in srgb, var(--zen-primary-color, #707ac2) 45%, transparent) !important;
          opacity: 1 !important;
        }
        .zentral-tooltip-row[data-active="true"] .zentral-tooltip-title {
          color: var(--zen-primary-color, currentColor) !important;
          font-weight: 600 !important;
        }
        .zentral-tooltip-row[data-unloaded="true"]:not([data-active="true"]) {
          opacity: 0.55 !important;
        }
        .zentral-tooltip-row[data-unloaded="true"]:not([data-active="true"]):hover {
          opacity: 0.88 !important;
        }
        .zentral-tooltip-close-btn {
          appearance: none !important;
          background: transparent !important;
          border: none !important;
          border-radius: 6px !important;
          color: inherit !important;
          padding: 3px !important;
          width: 22px !important;
          height: 22px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease !important;
          flex-shrink: 0 !important;
          margin-left: auto !important;
        }
        .zentral-tooltip-row:hover .zentral-tooltip-close-btn {
          opacity: 0.65 !important;
          pointer-events: auto !important;
        }
        .zentral-tooltip-close-btn:hover {
          opacity: 1 !important;
          background-color: rgba(255, 77, 77, 0.22) !important;
          color: #ff5555 !important;
        }
        .zentral-tooltip-close-btn svg {
          width: 12px !important;
          height: 12px !important;
          fill: none !important;
          stroke: currentColor !important;
          stroke-width: 2 !important;
          stroke-linecap: round !important;
          stroke-linejoin: round !important;
          display: block !important;
        }
        .zentral-tooltip-text-col {
          display: flex !important;
          flex-direction: column !important;
          min-width: 0 !important;
          flex: 1 !important;
        }
        .zentral-tooltip-title {
          font-size: 12.5px !important;
          font-weight: 500 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          color: inherit !important;
        }
        .zentral-tooltip-domain {
          font-size: 10.5px !important;
          opacity: 0.65 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          margin-top: 1px !important;
          color: inherit !important;
        }

        /* Zentral Color Picker Panel Styling */
        #zentral-group-color-picker,
        #zentral-group-color-picker::part(content),
        #zentral-group-color-picker::part(arrow),
        panel#zentral-group-color-picker,
        #zentral-group-color-picker .panel-arrowcontent,
        #zentral-group-color-picker .panel-subview-body {
          --panel-background: transparent !important;
          --panel-border-color: transparent !important;
          --panel-box-shadow: none !important;
          --panel-padding: 0 !important;
          --arrowpanel-background: transparent !important;
          --arrowpanel-border-color: transparent !important;
          --arrowpanel-border-radius: 0px !important;
          --arrowpanel-borderRadius: 0px !important;
          --arrowpanel-box-shadow: none !important;
          --arrowpanel-padding: 0 !important;
          --arrowpanel-margin: 0 !important;
          border: none !important;
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .zentral-tg-cp-box {
          padding: 12px 14px 14px 14px !important;
          gap: 10px !important;
          background: #1e1e24 !important;
          color: var(--in-content-page-color, #fbfbfe) !important;
          border: 1px solid color-mix(in srgb, currentColor 14%, rgba(255, 255, 255, 0.12)) !important;
          border-radius: 18px !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75) !important;
          backdrop-filter: blur(20px) !important;
          width: 184px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          overflow: visible !important;
        }

        .zentral-color-swatch {
          width: 24px !important;
          height: 24px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          border: 1px solid color-mix(in srgb, currentColor 15%, transparent) !important;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15) !important;
          transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.15s ease !important;
        }

        .zentral-color-swatch:hover {
          transform: scale(1.15) !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35) !important;
          z-index: 2 !important;
        }

        .zentral-tg-btn {
          flex: 1 !important;
          padding: 6px 8px !important;
          border: 1px solid color-mix(in srgb, currentColor 14%, transparent) !important;
          background: color-mix(in srgb, currentColor 8%, transparent) !important;
          color: inherit !important;
          cursor: pointer !important;
          border-radius: 8px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          transition: all 0.15s ease !important;
          outline: none !important;
        }

        .zentral-tg-btn:hover {
          background: color-mix(in srgb, currentColor 14%, transparent) !important;
          border-color: color-mix(in srgb, currentColor 22%, transparent) !important;
        }

        .zentral-tg-btn:active {
          transform: scale(0.97) !important;
        }

        .zentral-tg-input {
          font-size: 11px !important;
          font-weight: 500 !important;
          padding: 5px 6px !important;
          border-radius: 8px !important;
          background: color-mix(in srgb, currentColor 8%, transparent) !important;
          color: inherit !important;
          border: 1px solid color-mix(in srgb, currentColor 14%, transparent) !important;
          text-align: center !important;
          outline: none !important;
          transition: all 0.15s ease !important;
        }

        .zentral-tg-input:focus {
          border-color: var(--zen-primary-color, #70a0ff) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--zen-primary-color, #70a0ff) 25%, transparent) !important;
        }

        .zentral-tg-drag-handle {
          width: 100% !important;
          height: 18px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: grab !important;
          margin-top: -2px !important;
          margin-bottom: 2px !important;
          user-select: none !important;
          -moz-user-select: none !important;
        }

        .zentral-tg-drag-handle:active {
          cursor: grabbing !important;
        }

        .zentral-tg-drag-pill {
          width: 32px !important;
          height: 4px !important;
          border-radius: 2px !important;
          background: color-mix(in srgb, currentColor 22%, transparent) !important;
          transition: background 0.15s ease, width 0.15s ease !important;
          pointer-events: none !important;
        }

        .zentral-tg-drag-handle:hover .zentral-tg-drag-pill {
          background: color-mix(in srgb, currentColor 45%, transparent) !important;
          width: 40px !important;
        }
      `;
      try {
        const styleEl = document.createElement("style");
        styleEl.id = "zentral-tabgroups-styles";
        styleEl.textContent = css;
        (document.head || document.documentElement).appendChild(styleEl);
      } catch (e) {
        console.error("[Zentral] Error injecting tabgroups styles:", e);
      }
    }

    /* --------------------------------------------------------------------------
     * 4.1 Initialization & Observers
     * --------------------------------------------------------------------------
     */

    /**
     * Registers a TabOpen event listener on the tabstrip to ensure new tabs opened from within
     * a grouped tab (via link click or middle-click) are placed directly below the originating tab
     * inside the same group. Tabs opened from an App Panel are kept outside of any group.
     */
    setupTabOpenHandler() {
      if (this.#tabOpenListener) return;
      this.#tabOpenListener = (e) => {
        const tab = e.target;
        if (!tab || tab.tagName?.toLowerCase() !== "tab") return;

        // 1. App Panel Isolation: If link was opened while an App panel is open, keep outside any group
        const isAppPanelOpen = document.documentElement.getAttribute("zentral-app-panel-open") === "true" ||
                               document.getElementById("zen-app-panel-root")?.hasAttribute("open") ||
                               !!document.activeElement?.closest?.("#zen-app-panel-root, #zen-app-panel-slider, .zen-app-panel-wrapper");
        if (isAppPanelOpen) {
          const currentGroup = tab.closest?.("tab-group:not([split-view-group]):not([zen-split-view]):not([is-zen-split])") || tab.group;
          if (currentGroup) {
            try {
              // Move tab out of the group, placing it immediately after the group in the tab strip
              currentGroup.after(tab);
            } catch (_) {
              try {
                currentGroup.parentElement?.insertBefore(tab, currentGroup.nextSibling);
              } catch (_) {}
            }
            tab.removeAttribute("group");
            ["data-zentral-group-id", "data-zentral-group-label", "data-zentral-group-color", "data-zentral-group-collapsed", "data-zentral-group-ws"].forEach(attr => tab.removeAttribute(attr));
            
            const ss = this.#getSessionStore();
            if (ss) {
              try {
                ss.deleteCustomTabValue?.(tab, "zentral-group-id");
                ss.deleteCustomTabValue?.(tab, "zentral-group-label");
                ss.deleteCustomTabValue?.(tab, "zentral-group-color");
                ss.deleteCustomTabValue?.(tab, "zentral-group-collapsed");
                ss.deleteCustomTabValue?.(tab, "zentral-group-ws");
              } catch (_) {}
            }
            try {
              window.gBrowser?.tabContainer?._invalidateCachedTabs?.();
            } catch (_) {}
            this.scheduleStateSave();
          }
          return;
        }

        // 2. Resolve origin tab: check ownerTab first (standard Firefox link-click property), fallback to selectedTab
        const originTab = tab.ownerTab || window.gBrowser?.selectedTab;
        if (!originTab || originTab === tab) return;

        // 3. Check if originTab is inside a tab group
        const originGroup = originTab.closest?.("tab-group:not([split-view-group]):not([zen-split-view]):not([is-zen-split])") ||
                            (originTab.group && !originTab.group.hasAttribute?.("split-view-group") && !originTab.group.hasAttribute?.("zen-split-view") && !originTab.group.hasAttribute?.("is-zen-split") ? originTab.group : null);
        if (!originGroup) return;

        // 4. Place new tab inside the same container directly below the original tab
        const targetContainer = originTab.parentNode;
        if (!targetContainer) return;

        try {
          if (tab.parentNode !== targetContainer || tab.previousElementSibling !== originTab) {
            targetContainer.insertBefore(tab, originTab.nextSibling);
          }
        } catch (_) {
          try { targetContainer.appendChild(tab); } catch (_) {}
        }

        // 5. Associate tab with group
        // NOTE: tab.group is a getter-only property on MozTabbrowserTab. We do NOT assign to tab.group.
        // Being inside targetContainer (.tab-group-container), tab.group automatically returns originGroup.
        try { tab.setAttribute("group", originGroup.id); } catch (_) {}
        if (originGroup.tabs && typeof originGroup.tabs.add === "function") {
          try { originGroup.tabs.add(tab); } catch (_) {}
        }
        try {
          if (typeof window.gBrowser?.addTabToGroup === "function") {
            window.gBrowser.addTabToGroup(tab, originGroup);
          }
        } catch (_) {}

        const label = originGroup.label || originGroup.getAttribute?.("label") || "Group";
        const color = originGroup.style.getPropertyValue("--tab-group-color") || originGroup.style.getPropertyValue("--zentral-custom-color") || "";
        tab.setAttribute("data-zentral-group-id", originGroup.id);
        tab.setAttribute("data-zentral-group-label", label);
        if (color) tab.setAttribute("data-zentral-group-color", color);
        tab.setAttribute("data-zentral-group-collapsed", originGroup.hasAttribute("collapsed") ? "true" : "false");

        // 6. Context-Aware Expansion:
        // If the new tab is selected/focused in foreground, ensure the group expands so it's visible.
        // If opened in background, maintain the group's current collapsed state.
        if (tab.selected && originGroup.hasAttribute("collapsed")) {
          originGroup.removeAttribute("collapsed");
          originGroup.collapsed = false;
        }

        try {
          window.gBrowser?.tabContainer?._invalidateCachedTabs?.();
        } catch (_) {}

        this.scheduleStateSave();
      };

      if (window.gBrowser?.tabContainer) {
        window.gBrowser.tabContainer.addEventListener("TabOpen", this.#tabOpenListener);
      }
    }

    /**
     * Registers a MutationObserver on the tab strip to track added, removed, or collapsed tab groups.
     */
    setupObserver() {
      const observer = new MutationObserver((mutations) => {
        let needsSave = false;
        for (const mutation of mutations) {
          if (mutation.type === "attributes") {
            const attr = mutation.attributeName;
            if (attr === "split-view-group" || attr === "zen-split-view" || attr === "is-zen-split") {
              const g = mutation.target;
              if (g && g.tagName?.toUpperCase() === "TAB-GROUP") {
                const lc = g.querySelector(":scope > .tab-group-label-container");
                if (lc) lc.remove();
              }
            }
            if (attr === "collapsed") {
              const g = mutation.target;
              const isSplit = g.hasAttribute?.("split-view-group") || g.hasAttribute?.("zen-split-view") || g.hasAttribute?.("is-zen-split");
              if (g.tagName?.toUpperCase() === "TAB-GROUP" && !isSplit) needsSave = true;
            }
            if (attr === "label") {
              const g = mutation.target;
              if (g && g.tagName?.toUpperCase() === "TAB-GROUP") {
                const lc = g.querySelector(":scope > .tab-group-label-container");
                if (lc) this.updateCollapsedLabel(lc, g.label || g.getAttribute("label"));
              }
            }
            continue;
          }
          
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType !== Node.ELEMENT_NODE) continue;
              
              const tag = node.tagName?.toUpperCase();
              
              if (node.id === "tab-group-editor" || tag === "TABGROUP-MEU" || node.querySelector?.("#tab-group-editor, tabgroup-meu")) {
                this.removeBuiltinTabGroupMenu(node);
              }
              
              if (tag === "TAB-GROUP") {
                window.requestAnimationFrame(() => {
                  if (node.isConnected) {
                    const isSplit = node.hasAttribute?.("split-view-group") || 
                                    node.hasAttribute?.("zen-split-view") || 
                                    node.hasAttribute?.("is-zen-split") || 
                                    node.hasAttribute?.("splitview") || 
                                    node.classList?.contains?.("zen-split-view");
                    if (!isSplit) {
                      this.processGroup(node);
                      this.scheduleStateSave();
                    } else {
                      const lc = node.querySelector(":scope > .tab-group-label-container");
                      if (lc) lc.remove();
                    }
                  }
                });
              }
              
              const childGroups = node.querySelectorAll?.("tab-group") || [];
              if (childGroups.length > 0) {
                childGroups.forEach((group) => {
                  window.requestAnimationFrame(() => {
                    if (group.isConnected) {
                      const gSplit = group.hasAttribute?.("split-view-group") || 
                                     group.hasAttribute?.("zen-split-view") || 
                                     group.hasAttribute?.("is-zen-split") || 
                                     group.hasAttribute?.("splitview") || 
                                     group.classList?.contains?.("zen-split-view");
                      if (!gSplit) {
                        this.processGroup(group);
                        this.scheduleStateSave();
                      } else {
                        const lc = group.querySelector(":scope > .tab-group-label-container");
                        if (lc) lc.remove();
                      }
                    }
                  });
                });
              }
            }
            
            for (const node of mutation.removedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && node.tagName?.toUpperCase() === "TAB-GROUP") {
                needsSave = true;
                const obs = this.#groupObservers.get(node);
                if (obs) { obs.disconnect(); this.#groupObservers.delete(node); }
                this.#processedGroups.delete(node);
              }
            }
          }
        }
        
        if (needsSave) this.scheduleStateSave();
      });
      const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;
      observer.observe(tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["collapsed", "split-view-group", "zen-split-view", "is-zen-split", "label"] });
      this.#tabStripObserver = observer;

      if (!this.#groupRightClickBlocker) {
        this.#groupRightClickBlocker = (event) => {
          if (event.button !== 2) return;
          const target = event.target;
          if (target.closest("#tab-label-input")) return;
          const group = target.closest("tab-group:not([split-view-group])");
          if (!group) return;
          const isHeader = target.closest(".tab-group-label-container") ||
                           target.closest(".zentral-tab-title-wrapper") ||
                           target.classList.contains("tab-group-label") ||
                           target.classList.contains("zentral-group-initials") ||
                           target.classList.contains("tab-group-icon") ||
                           target.tagName?.toLowerCase() === "tab-group";
          if (target.closest("tab, tabbrowser-tab, .tabbrowser-tab") && !isHeader) return;

          if (isHeader) {
            event.stopPropagation();
          }
        };
        window.addEventListener("mousedown", this.#groupRightClickBlocker, true);
        window.addEventListener("mouseup", this.#groupRightClickBlocker, true);
        window.addEventListener("click", this.#groupRightClickBlocker, true);
      }

      // Global capture-phase contextmenu listener to guarantee right-click triggers custom menu on any group header
      if (!this.#groupContextMenuHandler) {
        this.#groupContextMenuHandler = (event) => {
          const target = event.target;
          if (target.closest("#tab-label-input")) return;
          // Check if right click was on a tab-group header / pill
          const group = target.closest("tab-group:not([split-view-group])");
          if (!group) return;

          const isHeader = target.closest(".tab-group-label-container") ||
                           target.closest(".zentral-tab-title-wrapper") ||
                           target.classList.contains("tab-group-label") ||
                           target.classList.contains("zentral-group-initials") ||
                           target.classList.contains("tab-group-icon") ||
                           target.tagName?.toLowerCase() === "tab-group";

          // If clicked directly on a tab inside the group, let native tab context menu handle it
          if (target.closest("tab, tabbrowser-tab, .tabbrowser-tab") && !isHeader) return;

          if (isHeader) {
            event.preventDefault();
            event.stopPropagation();
            const menu = this.ensureSharedContextMenu();
            if (menu) {
              this.#state.contextMenuCurrentGroup = group;
              this.#state.lastContextMenuX = event.screenX;
              this.#state.lastContextMenuY = event.screenY;
              try {
                menu.openPopupAtScreen(event.screenX, event.screenY, true);
              } catch (_) {
                try {
                  menu.openPopup(target, "after_start", 0, 0, true, false, event);
                } catch (_) {}
              }
            }
          }
        };
        window.addEventListener("contextmenu", this.#groupContextMenuHandler, true);
      }
    }

    /* --------------------------------------------------------------------------
     * 4.5 Custom Tooltips & Context Menus
     * --------------------------------------------------------------------------
     */

    /**
     * Removes builtin native tab group context menus to prevent UI redundancy.
     * @param {Element|Document} [root=document] - Container scope to scan.
     */
    /**
     * Installs capture-phase listener on window to block native Firefox tab group editor panels.
     */
    setupPopupSuppression() {
      if (this.#popupShowingListener) return;
      this.#popupShowingListener = (e) => {
        const target = e.target;
        const id = target?.id || "";
        const tag = target?.tagName?.toLowerCase() || "";
        if (
          id.includes("tab-group-editor") ||
          id.includes("tabgroup-editor") ||
          id === "tabGroupEditor" ||
          id === "tabGroupContextMenu" ||
          tag === "tabgroup-editor-panel" ||
          target?.classList?.contains("tab-group-editor")
        ) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof target.hidePopup === "function") {
            try { target.hidePopup(); } catch (_) {}
          }
          try { target.remove(); } catch (_) {}
        }
      };
      window.addEventListener("popupshowing", this.#popupShowingListener, true);
      this.removeBuiltinTabGroupMenu();
    }

    /**
     * Removes builtin native tab group context menus and editor panels to prevent UI redundancy.
     * @param {Element|Document} [root=document] - Container scope to scan.
     */
    removeBuiltinTabGroupMenu(root = document) {
      try {
        const selectors = [
          "#tab-group-editor",
          "#tabgroup-editor-panel",
          "#tabGroupEditor",
          "tabgroup-editor-panel",
          ".tab-group-editor",
          "#tabGroupContextMenu",
          "tabgroup-meu",
          'panel[id*="tab-group-editor"]',
          'panel[id*="tabgroup-editor"]'
        ];
        selectors.forEach(sel => {
          try {
            const list = root.querySelectorAll ? root.querySelectorAll(sel) : [];
            list.forEach(el => {
              if (typeof el.hidePopup === "function") el.hidePopup();
              try { el.remove(); } catch (_) {}
            });
            const el = document.getElementById(sel.replace("#", ""));
            if (el) {
              if (typeof el.hidePopup === "function") el.hidePopup();
              try { el.remove(); } catch (_) {}
            }
          } catch (_) {}
        });
      } catch (e) {
        console.error("[ZentralTabGroups] Error removing built-in menu:", e);
      }
    }


    /**
     * Scans and processes all existing tab group DOM elements in the workspace.
     */
    processExistingGroups() {
      const groups = document.querySelectorAll("tab-group:not([split-view-group])");
      groups.forEach(group => this.processGroup(group));
      this.loadTabGroupState();
    }

    /**
     * Handles keyboard events when editing tab group titles (Enter to confirm, Escape to cancel).
     * @param {KeyboardEvent} event - Keydown event object.
     */
    renameGroupKeydown(event) {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        const label = this.#state.groupEdited;
        const input = document.getElementById('tab-label-input');
        if (!input || !label) return;

        const newName = input.value.trim();
        const group = label.closest('tab-group');

        document.documentElement.removeAttribute('zen-renaming-group');
        input.remove();
        label.classList.remove('tab-group-label-editing');
        label.style.display = '';

        if (group && newName) {
          group.label = newName;
          try { group.setAttribute('label', newName); } catch (_) {}
          label.textContent = newName;
          const labelContainer = group.querySelector('.tab-group-label-container');
          if (labelContainer) {
            this.updateCollapsedLabel(labelContainer, newName);
          }
          this.scheduleStateSave();
        }
        this.#state.groupEdited = null;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.renameGroupHalt(event, true);
      }
    }

    /**
     * Replaces tab group text label with an inline text input to begin group renaming.
     * @param {Element} group - Tab group DOM element.
     * @param {boolean} [selectAll=true] - Whether to select full text in input.
     */
    renameGroupStart(group, selectAll = true) {
      if (!group || this.#state.groupEdited) return;
      const labelElement = group.querySelector('.tab-group-label');
      if (!labelElement) return;

      this.#state.groupEdited = labelElement;
      this.#state.isStartingRename = true;
      setTimeout(() => { this.#state.isStartingRename = false; }, 350);

      document.documentElement.setAttribute('zen-renaming-group', 'true');
      labelElement.classList.add('tab-group-label-editing');
      labelElement.style.display = 'none';

      const input = document.createElement('input');
      input.id = 'tab-label-input';
      input.className = 'tab-group-label-input';
      input.type = 'text';
      input.value = group.label || labelElement.textContent || '';
      input.setAttribute('autocomplete', 'off');

      labelElement.after(input);
      setTimeout(() => {
        try {
          input.focus();
          if (selectAll) input.select();
          else {
            const len = input.value.length;
            input.setSelectionRange(len, len);
          }
        } catch (_) {}
      }, 50);

      input.addEventListener('keydown', (e) => this.renameGroupKeydown(e));
      input.addEventListener('blur', (e) => this.renameGroupHalt(e));
    }

    /**
     * Halts tab group title rename operation and restores original text label.
     * @param {FocusEvent} event - Blur event on text input.
     * @param {boolean} [force=false] - Force halt regardless of active state.
     */
    renameGroupHalt(event, force = false) {
      if (this.#state.isStartingRename && !force) return;
      if (!this.#state.groupEdited) return;

      const input = document.getElementById('tab-label-input');
      if (input && document.activeElement === input && !force) return;

      document.documentElement.removeAttribute('zen-renaming-group');
      if (input) input.remove();
      if (this.#state.groupEdited) {
        this.#state.groupEdited.classList.remove('tab-group-label-editing');
        this.#state.groupEdited.style.display = '';
        this.#state.groupEdited = null;
      }
    }

    /**
     * Enhances a tab group DOM node with custom icons, close buttons, tooltips, and context menus.
     * @param {Element} group - Tab group DOM element.
     */
    processGroup(group) {
      // Use a WeakSet instead of a DOM attribute to avoid persisting across restarts
      // and to prevent guard bypasses when native code resets group attributes.
      if (!group || 
          this.#processedGroups.has(group) || 
          group.classList?.contains("zen-folder") || 
          group.hasAttribute?.("zen-folder") || 
          group.hasAttribute?.("split-view-group") || 
          group.hasAttribute?.("zen-split-view") || 
          group.hasAttribute?.("is-zen-split") || 
          group.hasAttribute?.("splitview") || 
          group.classList?.contains("zen-split-view")) {
        return;
      }
      group.classList.add("zentral-standard");
      group.setAttribute("zentral-group", "true");
      group.style.setProperty("border-radius", "6px", "important");

      // Ensure full internal structure exists
      let labelContainer = group.querySelector(".tab-group-label-container");
      if (!labelContainer) {
        labelContainer = document.createElement("div");
        labelContainer.className = "tab-group-label-container";
        group.insertBefore(labelContainer, group.firstChild);
      }
      let innerLabel = labelContainer.querySelector(".tab-group-label");
      if (!innerLabel) {
        innerLabel = document.createElement("label");
        innerLabel.className = "tab-group-label";
        labelContainer.appendChild(innerLabel);
      }
      const groupTitle = group.label || group.getAttribute("label") || innerLabel.textContent || "Group";
      innerLabel.textContent = groupTitle;

      let groupTabContainer = group.querySelector(".tab-group-container");
      if (!groupTabContainer) {
        groupTabContainer = document.createElement("div");
        groupTabContainer.className = "tab-group-container";
        group.appendChild(groupTabContainer);
      }

      // Bind click collapse toggle to ensure all groups (top-level and nested) collapse/expand on click
      if (!labelContainer._zentralToggleBound) {
        labelContainer._zentralToggleBound = true;
        labelContainer.addEventListener("click", (e) => {
          if (e.target.closest(".tab-close-button") || e.target.closest("#tab-label-input") || e.target.closest(".zentral-tg-drag-handle")) return;
          e.preventDefault();
          e.stopPropagation();

          if (typeof group.toggleCollapse === "function") {
            group.toggleCollapse();
          } else {
            const isColl = group.hasAttribute("collapsed") && group.getAttribute("collapsed") === "true";
            if (isColl) {
              group.removeAttribute("collapsed");
              group.collapsed = false;
            } else {
              group.setAttribute("collapsed", "true");
              group.collapsed = true;
            }
          }
          this.scheduleStateSave();
        });
      }

      if (group.shadowRoot && !group.shadowRoot.querySelector('.zentral-shadow-style')) {
        const style = document.createElement('style');
        style.className = 'zentral-shadow-style';
        style.textContent = `
          * { border-radius: 6px !important; outline: none !important; }
          .group-marker, .group-marker *, .tab-group-icon > image, .tab-group-icon > img, .tab-group-icon > svg:not(.zentral-chevron) {
            display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; opacity: 0 !important; list-style-image: none !important; background: none !important;
          }
          .tab-group-icon, .tab-group-icon * { border: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; }
          .tab-group-icon::before { display: none !important; content: none !important; }
          :host([collapsed]) .tab-group-icon,
          :host([collapsed]) .tab-group-icon * { border: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; }
          :host([collapsed]) .tab-group-icon::before { display: none !important; content: none !important; }
          :host([collapsed]) .tab-group-container::after,
          :host([collapsed]) .tab-group-container::before { display: none !important; content: none !important; }
        `;
        group.shadowRoot.appendChild(style);
      }
      // Clear and hide any native children (like image.group-marker) inside .tab-group-icon
      const iconEl = group.querySelector('.tab-group-icon');
      if (iconEl) {
        Array.from(iconEl.children).forEach(child => {
          if (!child.classList.contains('zentral-chevron')) {
            child.style.setProperty('display', 'none', 'important');
            child.style.setProperty('visibility', 'hidden', 'important');
            child.style.setProperty('width', '0', 'important');
            child.style.setProperty('height', '0', 'important');
            child.style.setProperty('min-width', '0', 'important');
            child.style.setProperty('min-height', '0', 'important');
            child.style.setProperty('opacity', '0', 'important');
            child.style.setProperty('list-style-image', 'none', 'important');
            child.style.setProperty('background', 'none', 'important');
            child.setAttribute('hidden', 'true');
          }
        });
        iconEl.style.setProperty('border', 'none', 'important');
        iconEl.style.setProperty('outline', 'none', 'important');
        iconEl.style.setProperty('box-shadow', 'none', 'important');
        iconEl.style.setProperty('background', 'transparent', 'important');
        iconEl.style.setProperty('background-image', 'none', 'important');
      }
      if (labelContainer) {
        // Track hover state so we don't collapse during a hover
        let _isHovered = false;

        /**
         * Enforces our inline layout styles on the labelContainer.
         * Called initially and re-called by the style MutationObserver
         * whenever Zen's own JS rewrites the element's style attribute.
         */
        const enforceRestingStyles = () => {
          labelContainer.style.setProperty("border-radius", "8px", "important");
          labelContainer.style.setProperty("aspect-ratio", "auto", "important");
          labelContainer.style.setProperty("align-self", "stretch", "important");
          labelContainer.style.setProperty("width", "100%", "important");
          labelContainer.style.setProperty("min-width", "100%", "important");
          labelContainer.style.setProperty("max-width", "100%", "important");
          labelContainer.style.setProperty("height", "26px", "important");
          labelContainer.style.setProperty("min-height", "26px", "important");
          labelContainer.style.setProperty("max-height", "26px", "important");
          labelContainer.style.setProperty("box-sizing", "border-box", "important");
          labelContainer.style.setProperty("display", "flex", "important");
          labelContainer.style.setProperty("flex-direction", "row", "important");
          labelContainer.style.setProperty("align-items", "center", "important");
          labelContainer.style.setProperty("padding", "0", "important");
          // Sync chevron icon visibility with the pref to prevent CSS vs inline-style conflict (H-05)
          const iconEl = labelContainer.querySelector(".tab-group-icon");
          if (iconEl) {
            const showChevron = Core.getPref(Constants.TabGroups.PREF_SHOW_CHEVRON) !== false;
            iconEl.style.setProperty("display", showChevron ? "inline-flex" : "none", "important");
          }
        };

        // Apply immediately
        enforceRestingStyles();

        const innerLabel = labelContainer.querySelector(".tab-group-label");
        if (innerLabel) {
          innerLabel.style.setProperty("border-radius", "12px", "important");
          innerLabel.style.setProperty("width", "auto", "important");
          innerLabel.style.setProperty("flex", "0 1 auto", "important");
          innerLabel.style.setProperty("overflow", "hidden", "important");
          innerLabel.style.setProperty("text-overflow", "ellipsis", "important");
        }

        // Guard against MutationObserver re-entrancy
        let _styleGuard = false;
        const styleWatcher = new MutationObserver(() => {
          if (_styleGuard || _isHovered) return;
          _styleGuard = true;
          enforceRestingStyles();
          _styleGuard = false;
        });
        styleWatcher.observe(labelContainer, { attributes: true, attributeFilter: ["style"] });
        // Track for cleanup when this group is removed from the DOM (M-02)
        this.#groupObservers.set(group, styleWatcher);

        // Labels are always full-width ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no hover expand/collapse needed.
        
        let hoverTimer = null;
        labelContainer.addEventListener("mouseenter", () => {
          if (!Core.getPref(Constants.TabGroups.PREF_THUMBNAILS)) return;
          labelContainer.setAttribute("zentral-hover", "true");
          hoverTimer = setTimeout(() => {
            const panel = document.getElementById("zentral-tabgroup-tooltip");
            const container = document.getElementById("zentral-tabgroup-tooltip-container");
            if (panel && container && group) {
              let tabs = this.getDirectTabs(group);
              container.replaceChildren();
              if (tabs.length === 0) {
                const div = document.createElement("div");
                div.textContent = "No tabs";
                div.style.color = "var(--text-color, inherit)";
                container.appendChild(div);
              } else {
                tabs.forEach(tab => {
                  const row = document.createElement("div");
                  row.className = "zentral-tooltip-row";

                  // Active Tab State
                  const isActive = tab.selected || (window.gBrowser && window.gBrowser.selectedTab === tab);
                  if (isActive) {
                    row.setAttribute("data-active", "true");
                  }

                  // Loaded vs. Unloaded (dormant/pending/discarded) State
                  const isUnloaded = tab.hasAttribute("pending") || tab.getAttribute("pending") === "true" || tab.discarded;
                  if (isUnloaded) {
                    row.setAttribute("data-unloaded", "true");
                  }
                  
                  row.addEventListener("click", (e) => {
                    if (e.target.closest(".zentral-tooltip-close-btn")) return;
                    e.preventDefault();
                    if (window.gBrowser && tab) window.gBrowser.selectedTab = tab;
                    if (panel.hidePopup) panel.hidePopup();
                  });
                  
                  const icon = document.createElement("img");
                  const imgSrc = tab.getAttribute("image") || tab.image || "chrome://global/skin/icons/defaultFavicon.svg";
                  icon.src = imgSrc;
                  icon.style.width = "16px";
                  icon.style.height = "16px";
                  icon.style.borderRadius = "3px";
                  icon.style.flexShrink = "0";
                  
                  let cleanTitle = tab.label || "New Tab";
                  let prev;
                  do {
                    prev = cleanTitle;
                    cleanTitle = cleanTitle.replace(/^\s*[\(\[]\d+[\)\]]\s*/g, "");
                    cleanTitle = cleanTitle.replace(/^[\p{Extended_Pictographic}\s\u200d\u2600-\u27BF]+/gu, "");
                  } while (cleanTitle !== prev);
                  cleanTitle = cleanTitle.trim() || (tab.label || "New Tab");

                  let domain = "";
                  try {
                    const uri = tab.linkedBrowser?.currentURI;
                    if (uri && uri.host) {
                      domain = uri.host.replace(/^www\./, "");
                    }
                  } catch (_) {}

                  const textCol = document.createElement("div");
                  textCol.className = "zentral-tooltip-text-col";

                  const titleEl = document.createElement("div");
                  titleEl.className = "zentral-tooltip-title";
                  titleEl.textContent = cleanTitle;
                  textCol.appendChild(titleEl);

                  if (domain) {
                    const domainEl = document.createElement("div");
                    domainEl.className = "zentral-tooltip-domain";
                    domainEl.textContent = domain;
                    textCol.appendChild(domainEl);
                  }

                  // In-Thumbnail Tab Close ("X") Button
                  const closeBtn = document.createElement("button");
                  closeBtn.className = "zentral-tooltip-close-btn";
                  closeBtn.title = "Close tab";
                  closeBtn.type = "button";
                  closeBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`));
                  closeBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.gBrowser && tab) {
                      try {
                        window.gBrowser.removeTab(tab);
                      } catch (err) {
                        console.warn("[ZentralTabGroups] Failed to close tab:", err);
                      }
                    }
                    // Smoothly animate removal of row
                    row.style.height = row.offsetHeight + "px";
                    row.style.overflow = "hidden";
                    row.style.boxSizing = "border-box";
                    row.style.transition = "height 0.18s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.15s ease, padding 0.18s ease, margin 0.18s ease";
                    requestAnimationFrame(() => {
                      row.style.height = "0";
                      row.style.opacity = "0";
                      row.style.paddingTop = "0";
                      row.style.paddingBottom = "0";
                      row.style.marginTop = "0";
                      row.style.marginBottom = "0";
                    });
                    setTimeout(() => {
                      row.remove();
                      if (container.querySelectorAll(".zentral-tooltip-row").length === 0) {
                        const div = document.createElement("div");
                        div.textContent = "No tabs";
                        div.style.color = "var(--text-color, inherit)";
                        container.appendChild(div);
                      }
                    }, 190);
                  });
                  
                  row.appendChild(icon);
                  row.appendChild(textCol);
                  row.appendChild(closeBtn);
                  container.appendChild(row);
                });
              }
              if (panel.openPopup) panel.openPopup(labelContainer, "end_before", -4, 0, false, false);
            }
          }, 350);
        });
        labelContainer.addEventListener("mouseleave", () => {
          labelContainer.removeAttribute("zentral-hover");
          if (hoverTimer) clearTimeout(hoverTimer);
          this.safeHideTooltip(350);
        });
        labelContainer.addEventListener("mousedown", () => {
          if (hoverTimer) clearTimeout(hoverTimer);
          const panel = document.getElementById("zentral-tabgroup-tooltip");
          if (panel && panel.hidePopup) panel.hidePopup();
        });
        labelContainer.addEventListener("dblclick", (e) => {
          if (e.target.closest(".tab-close-button") || e.target.closest(".tab-group-icon")) return;
          e.preventDefault();
          e.stopPropagation();
          this.renameGroupStart(group, true);
        });

        const labelValue = group.label || (innerLabel ? innerLabel.textContent : '');
        this.updateCollapsedLabel(labelContainer, labelValue);
      }
      if (!labelContainer) return;
      // Safe DOM injection
      if (!labelContainer.querySelector(".tab-close-button") && window.MozXULElement?.parseXULToFragment) {
        const frag = window.MozXULElement.parseXULToFragment(`
          <div class="tab-group-icon-container"><div class="tab-group-icon"><image class="group-marker" role="button" keyNav="false" tooltiptext="Toggle Group"/></div></div>
          <image class="tab-close-button close-icon" role="button" keyNav="false" tooltiptext="Close Group"/>
        `);
        const iconContainer = frag.querySelector(".tab-group-icon-container") || frag.children[0];
        const closeButton = frag.querySelector(".tab-close-button") || frag.children[1];

        labelContainer.insertBefore(iconContainer, labelContainer.firstChild);
        labelContainer.appendChild(closeButton);

        closeButton.addEventListener("click", (event) => {
          event.stopPropagation();
          event.preventDefault();
          try {
            this.removeSavedColor(group.id);
            if (typeof gBrowser?.removeTabGroup === "function") {
              try { gBrowser.removeTabGroup(group); } catch (_) {}
            }
          } catch (error) {
            console.error("[ZentralTabGroups] Error removing tab group:", error);
          }
          try { group.remove(); } catch (_) {}
          this.scheduleStateSave();
        });
      }

      // Wrap title elements in .zentral-tab-title-wrapper for physical Folder Tab contour
      let wrapper = labelContainer.querySelector(".zentral-tab-title-wrapper");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "zentral-tab-title-wrapper";
        const closeBtn = labelContainer.querySelector(".tab-close-button");
        labelContainer.insertBefore(wrapper, closeBtn || labelContainer.firstChild);
      }

      const iconContainer = labelContainer.querySelector(".tab-group-icon-container");
      const currentInnerLabel = labelContainer.querySelector(".tab-group-label");
      const initialsEl = labelContainer.querySelector(".zentral-group-initials");

      if (iconContainer && iconContainer.parentNode !== wrapper) wrapper.appendChild(iconContainer);
      if (currentInnerLabel && currentInnerLabel.parentNode !== wrapper) wrapper.appendChild(currentInnerLabel);
      if (initialsEl && initialsEl.parentNode !== wrapper) wrapper.appendChild(initialsEl);

      group.classList.remove('tab-group-editor-mode-create');
      this.#processedGroups.add(group);
      group.setAttribute("data-close-button-added", "true"); // Kept for external compatibility

      this.addContextMenu(group);

      if (!group.label || group.label === '' || ("defaultGroupName" in group && group.label === group.defaultGroupName)) {
        this.renameGroupStart(group, false);
      }
    }

    /**
     * Constructs or returns the shared context menu popup for tab groups.
     * @returns {Element} XUL menupopup element.
     */
    ensureSharedContextMenu() {
      const popupSet = document.getElementById("mainPopupSet") || document.documentElement || document.body;
      let contextMenu = document.getElementById("zentral-tabgroup-context-menu");
      
      if (!contextMenu || !contextMenu.isConnected) {
        if (contextMenu) contextMenu.remove();
        
        if (window.MozXULElement?.parseXULToFragment) {
          const frag = window.MozXULElement.parseXULToFragment(`
            <menupopup id="zentral-tabgroup-context-menu">
              <menu id="zentral-tg-menu-color" label="Change Group Color">
                <menupopup id="zentral-tg-menu-color-popup">
                  <menuitem id="zentral-tg-item-set-color" label="Set Custom Color"/>
                  <menuitem id="zentral-tg-item-auto-color" label="Average Group's Color"/>
                </menupopup>
              </menu>
              <menuitem id="zentral-tg-item-rename" label="Rename Group"/>
              <menuseparator/>
              <menuitem id="zentral-tg-item-ungroup" label="Ungroup Tabs"/>
              <menuitem id="zentral-tg-item-close" label="Close Group"/>
            </menupopup>
          `);
          popupSet.appendChild(frag);
          contextMenu = document.getElementById("zentral-tabgroup-context-menu");
        } else {
          contextMenu = document.createXULElement("menupopup");
          contextMenu.id = "zentral-tabgroup-context-menu";

          const colorMenu = document.createXULElement("menu");
          colorMenu.id = "zentral-tg-menu-color";
          colorMenu.setAttribute("label", "Change Group Color");
          const colorPopup = document.createXULElement("menupopup");
          colorPopup.id = "zentral-tg-menu-color-popup";

          const setColorItem = document.createXULElement("menuitem");
          setColorItem.id = "zentral-tg-item-set-color";
          setColorItem.setAttribute("label", "Set Custom Color");

          const autoColorItem = document.createXULElement("menuitem");
          autoColorItem.id = "zentral-tg-item-auto-color";
          autoColorItem.setAttribute("label", "Average Group's Color");

          colorPopup.appendChild(setColorItem);
          colorPopup.appendChild(autoColorItem);
          colorMenu.appendChild(colorPopup);
          contextMenu.appendChild(colorMenu);

          const renameItem = document.createXULElement("menuitem");
          renameItem.id = "zentral-tg-item-rename";
          renameItem.setAttribute("label", "Rename Group");
          contextMenu.appendChild(renameItem);

          const sep = document.createXULElement("menuseparator");
          contextMenu.appendChild(sep);

          const ungroupItem = document.createXULElement("menuitem");
          ungroupItem.id = "zentral-tg-item-ungroup";
          ungroupItem.setAttribute("label", "Ungroup Tabs");
          contextMenu.appendChild(ungroupItem);

          const closeItem = document.createXULElement("menuitem");
          closeItem.id = "zentral-tg-item-close";
          closeItem.setAttribute("label", "Close Group");
          contextMenu.appendChild(closeItem);

          popupSet.appendChild(contextMenu);
        }

        if (contextMenu) {
          contextMenu.addEventListener("popupshowing", (e) => {
            const trigger = contextMenu.triggerNode;
            const grp = trigger?.closest?.("tab-group:not([split-view-group])") || this.#state.contextMenuCurrentGroup;
            if (grp) this.#state.contextMenuCurrentGroup = grp;
          });

          const openColorPicker = () => {
            const grp = this.#state.contextMenuCurrentGroup;
            if (!grp) return;
            const picker = this.ensureColorPickerPanel();
            if (picker) {
              picker._currentGroup = grp;
              const currentColor = grp.style.getPropertyValue("--tab-group-color").trim() || "#2b2b2b";
              const hex = currentColor.startsWith("#") && currentColor.length >= 7 ? currentColor.substring(0, 7) : "#2b2b2b";
              const hexInput = picker.querySelector("#zentral-tg-input-hex");
              if (hexInput) hexInput.value = hex;
              const bigint = parseInt(hex.slice(1), 16);
              const rgbInput = picker.querySelector("#zentral-tg-input-rgb");
              if (rgbInput && !isNaN(bigint)) rgbInput.value = `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
              const nativeColorInput = picker.querySelector("#zentral-tg-native-color");
              if (nativeColorInput) nativeColorInput.value = hex;
              
              if (typeof picker.openPopupAtScreen === "function") {
                picker.openPopupAtScreen(this.#state.lastContextMenuX || 0, this.#state.lastContextMenuY || 0, false);
              } else if (typeof picker.openPopup === "function") {
                picker.openPopup(grp, "after_start", 0, 0, false, false);
              }
            }
          };

          contextMenu.querySelector("#zentral-tg-item-set-color")?.addEventListener("command", (e) => {
            e.stopPropagation();
            openColorPicker();
          });

          contextMenu.querySelector("#zentral-tg-item-auto-color")?.addEventListener("command", (e) => {
            e.stopPropagation();
            if (this.#state.contextMenuCurrentGroup?._useFaviconColor) {
              this.#state.contextMenuCurrentGroup._useFaviconColor();
            }
          });

          contextMenu.querySelector("#zentral-tg-item-rename")?.addEventListener("command", (e) => {
            e.stopPropagation();
            if (this.#state.contextMenuCurrentGroup) {
              this.renameGroupStart(this.#state.contextMenuCurrentGroup, true);
            }
          });

          contextMenu.querySelector("#zentral-tg-item-ungroup")?.addEventListener("command", (e) => {
            e.stopPropagation();
            const grp = this.#state.contextMenuCurrentGroup;
            if (grp) {
              if (typeof grp.ungroupTabs === "function") {
                try { grp.ungroupTabs(); } catch (_) {}
              }
              try { grp.remove(); } catch (_) {}
              this.scheduleStateSave();
            }
          });

          contextMenu.querySelector("#zentral-tg-item-close")?.addEventListener("command", (e) => {
            e.stopPropagation();
            const grp = this.#state.contextMenuCurrentGroup;
            if (grp) {
              try {
                this.removeSavedColor(grp.id);
                if (typeof gBrowser?.removeTabGroup === "function") {
                  try { gBrowser.removeTabGroup(grp); } catch (_) {}
                }
              } catch (_) {}
              try { grp.remove(); } catch (_) {}
              this.scheduleStateSave();
            }
          });
        }
      }

      this.#state.sharedContextMenu = contextMenu;
      return contextMenu;
    }
    /* --------------------------------------------------------------------------
     * 4.4 Color Picker & Theme Processing
     * --------------------------------------------------------------------------
     */

    /**
     * Constructs and initializes the interactive popup color picker panel with spectrum wheel and eyedropper.
     * @returns {Element} XUL panel element for color selection.
     */
    ensureColorPickerPanel() {
      if (this.#state.colorPickerPanel && this.#state.colorPickerPanel.isConnected) {
        return this.#state.colorPickerPanel;
      }

      const popupSet = document.getElementById("mainPopupSet") || document.documentElement || document.body;
      let existing = document.getElementById("zentral-group-color-picker");
      if (existing && existing.isConnected) {
        this.#state.colorPickerPanel = existing;
        return existing;
      }

      if (!window.MozXULElement?.parseXULToFragment) return null;

      const palette = [
        "#ff4b4b", "#ff8f3d", "#f2c94c", "#2196f3", "#9b51e0",
        "#eb5757", "#f2994a", "#6fcf97", "#2d9cdb", "#bb6bd9",
        "#e53935", "#fb8c00", "#43a047", "#1e88e5", "#8e24aa",
        "#d32f2f", "#f57c00", "#388e3c", "#1976d2", "#7b1fa2",
        "#c62828", "#ef6c00", "#2e7d32", "#1565c0", "#6a1b9a"
      ];

      const htmlPalette = palette.map(c => `<div class="zentral-color-swatch" data-color="${c}" style="background-color: ${c};"></div>`).join("");

      const frag = window.MozXULElement.parseXULToFragment(`
        <panel id="zentral-group-color-picker" type="arrow" rolluponmousewheel="true" noautofocus="true" consumeoutsideclicks="false">
          <vbox class="zentral-tg-cp-box">
            <html:div id="zentral-tg-drag-handle" class="zentral-tg-drag-handle" title="Drag to move">
              <html:div class="zentral-tg-drag-pill"></html:div>
            </html:div>
            <html:div id="zentral-tg-palette-container" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: 156px; height: 144px;">
              ${htmlPalette}
            </html:div>
            <html:div id="zentral-tg-wheel-container" style="display: none; flex-direction: column; gap: 6px; align-items: center; width: 156px; height: 144px;">
              <html:canvas id="zentral-tg-satval-canvas" width="156" height="124" style="border-radius: 8px; cursor: crosshair; border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"></html:canvas>
              <html:canvas id="zentral-tg-hue-canvas" width="156" height="14" style="border-radius: 8px; cursor: pointer; border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"></html:canvas>
            </html:div>
            <hbox style="align-items: center; justify-content: space-between; gap: 4px; width: 156px;">
              <html:button id="zentral-tg-btn-auto" class="zentral-tg-btn" title="Average Group's Color">Auto</html:button>
              <html:button id="zentral-tg-btn-wheel" class="zentral-tg-btn">Wheel</html:button>
              <html:button id="zentral-tg-btn-pick" class="zentral-tg-btn">Pick</html:button>
            </hbox>
            <hbox style="align-items: center; justify-content: space-between; gap: 6px; width: 156px;">
              <html:input id="zentral-tg-input-hex" type="text" placeholder="#HEX" class="zentral-tg-input" style="width: 70px;"/>
              <html:input id="zentral-tg-input-rgb" type="text" placeholder="R, G, B" class="zentral-tg-input" style="width: 80px;"/>
            </hbox>
          </vbox>
        </panel>
      `);

      popupSet.appendChild(frag);
      const panel = document.getElementById("zentral-group-color-picker");

      const applyColor = (color) => {
        if (panel._currentGroup) {
          panel._currentGroup.style.setProperty("--tab-group-color", color);
          panel._currentGroup.style.setProperty("--tab-group-color-invert", color);
          panel._currentGroup.style.setProperty("--zentral-custom-color", color);
          panel._currentGroup.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(color));
          this.saveTabGroupColors();
          this.scheduleStateSave();
        }
      };

      // Palette swatches
      panel.querySelectorAll(".zentral-color-swatch").forEach(swatch => {
        swatch.addEventListener("click", () => applyColor(swatch.dataset.color));
      });

      // Wheel/Palette toggle
      const paletteContainer = panel.querySelector("#zentral-tg-palette-container");
      const wheelContainer = panel.querySelector("#zentral-tg-wheel-container");
      const btnWheel = panel.querySelector("#zentral-tg-btn-wheel");
      btnWheel.addEventListener("click", () => {
        if (wheelContainer.style.display === "none") {
          wheelContainer.style.display = "flex";
          paletteContainer.style.display = "none";
          btnWheel.textContent = "Palette";
          drawSatVal();
          drawHue();
        } else {
          wheelContainer.style.display = "none";
          paletteContainer.style.display = "grid";
          btnWheel.textContent = "Wheel";
        }
      });

      // Canvas Color Wheel Logic
      let currentHue = 0;
      const satValCanvas = panel.querySelector("#zentral-tg-satval-canvas");
      const hueCanvas = panel.querySelector("#zentral-tg-hue-canvas");

      const drawHue = () => {
        const ctx = hueCanvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, hueCanvas.width, 0);
        for (let i = 0; i <= 360; i += 60) grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
      };

      const drawSatVal = () => {
        const ctx = satValCanvas.getContext("2d");
        ctx.fillStyle = `hsl(${currentHue}, 100%, 50%)`;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);

        const whiteGrad = ctx.createLinearGradient(0, 0, satValCanvas.width, 0);
        whiteGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
        whiteGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = whiteGrad;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);

        const blackGrad = ctx.createLinearGradient(0, 0, 0, satValCanvas.height);
        blackGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
        blackGrad.addColorStop(1, "rgba(0, 0, 0, 1)");
        ctx.fillStyle = blackGrad;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);
      };

      hueCanvas.addEventListener("click", (e) => {
        const rect = hueCanvas.getBoundingClientRect();
        currentHue = Math.min(360, Math.max(0, ((e.clientX - rect.left) / rect.width) * 360));
        drawSatVal();
      });

      satValCanvas.addEventListener("click", (e) => {
        const rect = satValCanvas.getBoundingClientRect();
        const x = Math.min(satValCanvas.width - 1, Math.max(0, e.clientX - rect.left));
        const y = Math.min(satValCanvas.height - 1, Math.max(0, e.clientY - rect.top));
        const ctx = satValCanvas.getContext("2d");
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, "0")).join("");
        applyColor(hex);
        panel.querySelector("#zentral-tg-input-hex").value = hex;
        panel.querySelector("#zentral-tg-input-rgb").value = `${pixel[0]}, ${pixel[1]}, ${pixel[2]}`;
      });

      // Eyedropper API
      const btnPick = panel.querySelector("#zentral-tg-btn-pick");
      if (window.EyeDropper) {
        btnPick.addEventListener("click", async () => {
          try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            if (result && result.sRGBHex) applyColor(result.sRGBHex);
          } catch (_) {}
        });
      } else {
        btnPick.style.display = "none";
      }

      // Auto Average Favicon Color
      panel.querySelector("#zentral-tg-btn-auto").addEventListener("click", () => {
        if (panel._currentGroup && panel._currentGroup._useFaviconColor) {
          panel._currentGroup._useFaviconColor();
        }
      });

      // Draggable Color Picker Logic
      const handle = panel.querySelector("#zentral-tg-drag-handle");
      let isDragging = false;
      let startX, startY;

      handle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
        handle.classList.add("dragging");
        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const deltaX = e.screenX - startX;
        const deltaY = e.screenY - startY;
        startX = e.screenX;
        startY = e.screenY;

        const currentX = parseInt(panel.getAttribute("left")) || panel.screenX || 0;
        const currentY = parseInt(panel.getAttribute("top")) || panel.screenY || 0;
        panel.moveTo(currentX + deltaX, currentY + deltaY);
      });

      window.addEventListener("mouseup", (e) => {
        if (isDragging && e.button === 0) {
          isDragging = false;
          handle.classList.remove("dragging");
        }
      });

      panel.querySelector("#zentral-tg-input-hex").addEventListener("input", (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) applyColor(val);
      });
      panel.querySelector("#zentral-tg-input-rgb").addEventListener("change", (e) => {
        const parts = e.target.value.split(',').map(s => parseInt(s.trim()));
        if (parts.length === 3 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
           applyColor("#" + parts.map(n => n.toString(16).padStart(2, '0')).join(''));
        }
      });

      this.#state.colorPickerPanel = panel;
      return panel;
    }
    /**
     * Attaches custom context menu actions to native Zen folder menus.
     */
    addFolderContextMenuItems() {
      setTimeout(() => {
        const folderMenu = document.getElementById("zenFolderActions");
        if (!folderMenu || folderMenu.querySelector("#zentral-tabgroup-convert-folder-to-group")) return;
        
        if (window.MozXULElement?.parseXULToFragment) {
          const frag = window.MozXULElement.parseXULToFragment(`<menuseparator id="zentral-tabgroup-folder-separator"/><menuitem id="zentral-tabgroup-convert-folder-to-group" label="Convert Folder to Group"/>`);
          const convertToSpaceItem = folderMenu.querySelector("#context_zenFolderToSpace");
          if (convertToSpaceItem) { convertToSpaceItem.after(frag); } else { folderMenu.appendChild(frag); }
          
          folderMenu.addEventListener('command', (event) => {
            if (event.target.id === 'zentral-tabgroup-convert-folder-to-group') {
              const triggerNode = folderMenu.triggerNode;
              const folder = triggerNode?.closest('zen-folder');
              if (folder) this.convertFolderToGroup(folder);
            }
          });
        }
      }, 1500);
    }



    /**
     * Enhances native tab context menu (#tabContextMenu) to ensure all existing
     * tab groups are populated and selectable when right-clicking tabs to add/move to group.
     */
    enhanceTabContextMenu() {
      const tabContextMenu = document.getElementById("tabContextMenu");
      if (!tabContextMenu || tabContextMenu._zentralEnhanced) return;
      tabContextMenu._zentralEnhanced = true;

      // Ensure groups order matches tabstrip top-to-bottom and group colors match
      // Note: We do NOT remove separators or Closed Groups via DOM .remove() because Zen's native
      // popup builder relies on them as anchor nodes to clear & rebuild items on subsequent openings.
      // They are cleanly hidden via chrome.css instead.
      const handleGroupSubmenu = (popup) => {
        if (!popup) return;

        // 1. Query active tab groups in DOM order (top to bottom on tabstrip)
        const activeGroups = Array.from(document.querySelectorAll("tab-group:not([split-view-group])"));
        
        // 2. Find all group items in the submenu
        const menuItems = Array.from(popup.querySelectorAll(".tab-group-icon, menuitem[class*='tab-group']"));
        if (menuItems.length === 0) return;

        // 3. Sort menu items to match tabstrip order (top to bottom)
        menuItems.sort((a, b) => {
          const labelA = (a.getAttribute("label") || a.label || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          const labelB = (b.getAttribute("label") || b.label || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          const idxA = activeGroups.findIndex(g => (g.label || g.getAttribute("label") || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim() === labelA);
          const idxB = activeGroups.findIndex(g => (g.label || g.getAttribute("label") || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim() === labelB);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });

        // 4. Re-insert sorted items sequentially after upper separator
        const upperSep = popup.querySelector("#open-tab-groups-separator-upper");
        let refNode = upperSep || popup.querySelector("#context_moveTabToGroupNewGroup")?.nextElementSibling;
        
        menuItems.forEach(item => {
          if (refNode && refNode.nextSibling) {
            refNode.parentNode.insertBefore(item, refNode.nextSibling);
            refNode = item;
          } else {
            popup.appendChild(item);
            refNode = item;
          }

          // 5. Apply matching group color to the item and its icon squircle
          const cleanLabel = (item.getAttribute("label") || item.label || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          const groupEl = activeGroups.find(g => (g.label || g.getAttribute("label") || "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim() === cleanLabel);
          if (groupEl) {
            const color = groupEl.style.getPropertyValue("--zentral-custom-color") ||
                          groupEl.style.getPropertyValue("--tab-group-color") ||
                          groupEl.getAttribute("data-tab-group-color") ||
                          "";
            if (color) {
              item.style.setProperty("--tab-group-color", color, "important");
              item.style.setProperty("--tab-group-color-undefined", color, "important");
              item.style.setProperty("--menu-icon-color", color, "important");
              const img = item.querySelector("img, image, .menu-iconic-icon, html\\:img");
              if (img) {
                img.style.setProperty("background-color", color, "important");
                img.style.setProperty("fill", color, "important");
                img.style.setProperty("color", color, "important");
              }
            }
          }
        });
      };

      if (!this._tabContextSubmenuListener) {
        this._tabContextSubmenuListener = (e) => {
          const popup = e.target;
          if (popup && (popup.id === "context_moveTabToGroupPopupMenu" || popup.id?.includes("TabToGroup") || popup.parentNode?.id === "context_moveTabToGroup")) {
            handleGroupSubmenu(popup);
            setTimeout(() => handleGroupSubmenu(popup), 0);
          }
        };
        window.addEventListener("popupshowing", this._tabContextSubmenuListener, true);
        window.addEventListener("popupshown", this._tabContextSubmenuListener, true);
      }
    }

    onTabGroupCreate(event) {
      try {
        const target = event.target;
        const group = target?.closest ? (target.closest('tab-group') || (target.tagName === 'tab-group' ? target : null)) : null;
        if (!group || group.hasAttribute("split-view-group")) return;

        this.removeBuiltinTabGroupMenu();
        if (!group.hasAttribute("data-close-button-added")) this.processGroup(group);

        if (!group.label || group.label === '' || ("defaultGroupName" in group && group.label === group.defaultGroupName)) {
          if (!this.#state.groupEdited) this.renameGroupStart(group, false);
          if (typeof group._useFaviconColor === 'function' && !group.style.getPropertyValue("--tab-group-color")) {
            setTimeout(() => group._useFaviconColor(), 300);
          }
        }
      } catch (e) {
        console.error('[ZentralTabGroups] Error handling TabGroupCreate:', e);
      }
    }

    /**
     * Binds right-click context menu event listener and helper methods to a specific tab group.
     * @param {Element} group - Tab group DOM element.
     */
    addContextMenu(group) {
      const sharedMenu = this.ensureSharedContextMenu();
      const labelContainer = group.querySelector(".tab-group-label-container");
      if (labelContainer) {
        labelContainer.setAttribute("context", "zentral-tabgroup-context-menu");
        if (!labelContainer._zentralContextMenuBound) {
          labelContainer._zentralContextMenuBound = true;
          labelContainer.addEventListener("contextmenu", (event) => {
            if (event.target.closest("#tab-label-input")) return;
            event.preventDefault();
            event.stopPropagation();
            this.#state.contextMenuCurrentGroup = group;
            this.#state.lastContextMenuX = event.screenX;
            this.#state.lastContextMenuY = event.screenY;
            if (sharedMenu) {
              if (typeof sharedMenu.openPopupAtScreen === "function") {
                sharedMenu.openPopupAtScreen(event.screenX, event.screenY, true);
              } else if (typeof sharedMenu.openPopup === "function") {
                sharedMenu.openPopup(labelContainer, "after_start", 0, 0, true, false, event);
              }
            }
          });
        }
      }
      group.setAttribute("context", "zentral-tabgroup-context-menu");

      // Bind group specific actions for external callers
      // Color picking is now handled natively via ensureColorPickerPanel
      group._useFaviconColor = () => {
        let favicons = Array.from(group.querySelectorAll(".tab-icon-image"));
        if (favicons.length === 0) {
          const tabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab"));
          favicons = [];
          tabs.forEach(t => {
            const icon = t.querySelector(".tab-icon-image");
            if (icon) favicons.push(icon);
          });
        }
        if (favicons.length === 0) return;
        const colors = [];
        
        favicons.forEach((favicon) => {
          if (favicon && (favicon.src || favicon.currentSrc)) {
            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const w = favicon.naturalWidth || favicon.width || 16;
              const h = favicon.naturalHeight || favicon.height || 16;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(favicon, 0, 0, w, h);
              const data = ctx.getImageData(0, 0, w, h).data;
              let r = 0, g = 0, b = 0, count = 0;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 128 && data[i] + data[i + 1] + data[i + 2] > 30) {
                  r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
                }
              }
              if (count > 0) colors.push([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
            } catch (e) {}
          }
        });

        if (colors.length > 0) {
          const finalColor = this.calculateAverageColor(colors);
          const colorString = `rgb(${finalColor[0]}, ${finalColor[1]}, ${finalColor[2]})`;
          group.style.setProperty("--tab-group-color", colorString);
          group.style.setProperty("--tab-group-color-invert", colorString);
          group.style.setProperty("--zentral-custom-color", colorString);
          group.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(colorString));
          this.saveTabGroupColors();
        }
      };

      group.ungroupTabs = () => {
        try {
          const ss = this.#getSessionStore();
          this.removeSavedColor(group.id);

          const parentContainer = group.parentNode || document.getElementById("tabbrowser-tabs");

          // 1. Gather all tab DOM elements physically contained within this group
          let tabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab"));
          
          if (tabs.length === 0 && group.tabs) {
            tabs = Array.from(group.tabs);
          }
          if (tabs.length === 0 && window.gBrowser?.tabs) {
            tabs = Array.from(gBrowser.tabs).filter(
              t => t.group === group || 
                   t.getAttribute("group") === group.id || 
                   t.getAttribute("zen-group") === group.id ||
                   t.closest("tab-group") === group
            );
          }

          // 2. Physically re-parent every tab element outside of the group element before removing the group
          if (parentContainer) {
            tabs.forEach(tab => {
              try {
                parentContainer.insertBefore(tab, group);
              } catch (e) {
                try {
                  parentContainer.appendChild(tab);
                } catch (err) {}
              }

              // Disassociate tab from group in JS APIs and attributes
              try {
                if (typeof gBrowser?.addTabToGroup === "function") {
                  gBrowser.addTabToGroup(tab, null);
                }
              } catch (e) {}
              try {
                if (tab.group !== undefined) {
                  tab.group = null;
                }
              } catch (e) {}
              try {
                tab.removeAttribute("group");
                tab.removeAttribute("zen-group");
              } catch (e) {}

              // Clean all Zentral custom data attributes and SessionStore metadata
              ["data-zentral-group-id", "data-zentral-group-label", "data-zentral-group-color", "data-zentral-group-collapsed", "data-zentral-group-ws", "data-zentral-parent-id"].forEach(attr => tab.removeAttribute(attr));
              if (ss) {
                ["zentral-group-id", "zentral-group-label", "zentral-group-color", "zentral-parent-id", "zentral-group-collapsed", "zentral-group-ws"].forEach(key => {
                  try {
                    if (typeof ss.deleteCustomTabValue === "function") ss.deleteCustomTabValue(tab, key);
                    else if (typeof ss.setCustomTabValue === "function") ss.setCustomTabValue(tab, key, "");
                  } catch (_) {}
                });
              }
            });
          }

          // 3. Remove the group via the native API so Zen's internal registry stays consistent.
          try {
            if (typeof gBrowser?.removeTabGroup === "function") {
              gBrowser.removeTabGroup(group);
            } else {
              group.remove();
            }
          } catch (e) {
            try { group.remove(); } catch (_) {}
          }

          // 4. Immediately synchronize and persist clean state so deleted group never resurrects
          this.saveTabGroupState();

        } catch (e) {
          console.error("[ZentralTabGroups] Error ungrouping tabs:", e);
        }
      };
    }

    _checkFaviconColorsDone(processedCount, total, colors, group) {
      if (processedCount === total && colors.length > 0) {
        const finalColor = this.calculateAverageColor(colors);
        const colorString = `rgb(${finalColor[0]}, ${finalColor[1]}, ${finalColor[2]})`;
        group.style.setProperty("--tab-group-color", colorString);
        group.style.setProperty("--tab-group-color-invert", colorString);
        group.style.setProperty("--zentral-custom-color", colorString);
        this.saveTabGroupColors();
      }
    }

    /**
     * Prevents dormant tabs and split views from being selected and loaded while being dragged or reordered.
     * Defers mousedown tab selection until mouseup (for clicks) and isolates the drag payload during startTabDrag (for drags).
     */
    initTabDragSelectionGuard() {
      const tabContainer = gBrowser?.tabContainer || document.getElementById("tabbrowser-tabs");
      if (!tabContainer || this.#tabDragGuardInitialized) return;
      this.#tabDragGuardInitialized = true;

      let isGuardingTab = false;
      let dragCandidateTab = null;
      let startX = 0;
      let startY = 0;

      // Helper: resolve tab or split view primary tab
      const resolveTab = (target) => {
        if (!target || typeof target.closest !== "function") return null;
        const tab = target.closest("tab, tabbrowser-tab, .tabbrowser-tab");
        if (tab) return tab;
        const splitGroup = target.closest("tab-group[split-view-group], tab-group[zen-split-view], tab-group[is-zen-split]");
        if (splitGroup) {
          return splitGroup.tabs?.[0] || splitGroup.querySelector("tab, tabbrowser-tab, .tabbrowser-tab");
        }
        return null;
      };

      // 1. Intercept mousedown on tabContainer to prevent Firefox tab.on_mousedown
      //    from immediately selecting the tab before we know if it's a click or a drag.
      const onMouseDown = (e) => {
        if (e.button !== 0) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target?.closest?.(".tab-close-button, .tab-icon-sound, .tab-audio-button, .tab-pin-icon, .tab-reset-button")) return;

        const tab = resolveTab(e.target);
        if (!tab) return;

        const currentActive = window.gBrowser?.selectedTab;
        if (tab !== currentActive && !tab.multiselected) {
          dragCandidateTab = tab;
          isGuardingTab = true;
          startX = e.clientX;
          startY = e.clientY;

          // Temporarily lock gBrowser.selectedTab and tabContainer.selectedItem
          // so tab.on_mousedown does NOT switch the active tab on mousedown.
          if (window.gBrowser) {
            Object.defineProperty(window.gBrowser, "selectedTab", {
              get: () => currentActive,
              set: () => {},
              configurable: true
            });
          }

          if (tabContainer) {
            Object.defineProperty(tabContainer, "selectedItem", {
              get: () => currentActive,
              set: () => {},
              configurable: true
            });
          }
        }
      };

      // 2. On mouseup: if distance < 6px (click), activate the candidate tab.
      const onMouseUp = (e) => {
        if (isGuardingTab) {
          // Release temporary locks immediately
          if (window.gBrowser) delete window.gBrowser.selectedTab;
          if (tabContainer) delete tabContainer.selectedItem;
          isGuardingTab = false;

          if (dragCandidateTab && dragCandidateTab.isConnected) {
            const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (moveDist < 6 && dragCandidateTab !== window.gBrowser?.selectedTab) {
              const targetTab = dragCandidateTab;
              dragCandidateTab = null;
              try {
                window.gBrowser.selectedTab = targetTab;
              } catch (_) {}
            }
          }
        }
        dragCandidateTab = null;
      };

      const clearGuard = () => {
        if (isGuardingTab) {
          if (window.gBrowser) delete window.gBrowser.selectedTab;
          if (tabContainer) delete tabContainer.selectedItem;
          isGuardingTab = false;
        }
        dragCandidateTab = null;
      };

      // 3. Prevent native HTML Drag & Drop from intercepting split-view splitter resizing
      const onSplitterDragStart = (e) => {
        if (e.target?.closest?.(".zen-split-view-splitter, #zen-splitview-overlay, .zen-view-splitter-header-container:not(:has(toolbarbutton.zen-tab-rearrange-button))")) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const onSplitterMouseDown = (e) => {
        if (e.button === 0 && e.target?.closest?.(".zen-split-view-splitter")) {
          e.preventDefault();
        }
      };

      tabContainer.addEventListener("mousedown", onMouseDown, { capture: true });
      window.addEventListener("mouseup", onMouseUp, { capture: true });
      window.addEventListener("dragend", clearGuard, { capture: true });
      window.addEventListener("drop", clearGuard, { capture: true });
      window.addEventListener("dragstart", onSplitterDragStart, { capture: true });
      window.addEventListener("mousedown", onSplitterMouseDown, { capture: true });

      // 4. Hook _getDragTarget across ZenDragAndDrop and TabDragAndDrop so split views drag as native tabs
      const dndTargets = [
        window.ZenDragAndDrop?.prototype,
        tabContainer.tabDragAndDrop,
        window.TabDragAndDrop?.prototype
      ].filter(t => t && typeof t._getDragTarget === "function");

      const origDragTargetMap = new Map();

      dndTargets.forEach(target => {
        if (!origDragTargetMap.has(target)) {
          const orig = target._getDragTarget;
          origDragTargetMap.set(target, orig);
          target._getDragTarget = function(event, options) {
            const res = orig.call(this, event, options);
            if (res) {
              const splitGroup = res.closest?.("tab-group[split-view-group], tab-group[zen-split-view], tab-group[is-zen-split]") || res.group;
              if (splitGroup && (splitGroup.hasAttribute?.("split-view-group") || splitGroup.hasAttribute?.("zen-split-view"))) {
                const primaryTab = splitGroup.tabs?.[0] || splitGroup.querySelector?.("tab, tabbrowser-tab, .tabbrowser-tab");
                if (primaryTab) {
                  return primaryTab;
                }
              }
            }
            return res;
          };
        }
      });

      // 5. Hook startTabDrag across ZenDragAndDrop and TabDragAndDrop
      const targets = [
        window.ZenDragAndDrop?.prototype,
        tabContainer.tabDragAndDrop,
        window.TabDragAndDrop?.prototype
      ].filter(t => t && typeof t.startTabDrag === "function");

      const origStartMap = new Map();

      targets.forEach(target => {
        if (!origStartMap.has(target)) {
          const orig = target.startTabDrag;
          origStartMap.set(target, orig);
          target.startTabDrag = function(event, tab, options = {}) {
            // Release mousedown lock so startTabDrag can run cleanly
            if (isGuardingTab) {
              if (window.gBrowser) delete window.gBrowser.selectedTab;
              if (tabContainer) delete tabContainer.selectedItem;
              isGuardingTab = false;
            }

            const currentActiveTab = window.gBrowser?.selectedTab;
            // A tab or split view is dormant if it is not the currently active tab
            const isDormant = tab && tab !== currentActiveTab && !tab.multiselected;

            if (isDormant && window.gBrowser) {
              // Temporarily isolate selectedElements so Firefox only bundles the dragged tab/split view
              Object.defineProperty(window.gBrowser, "selectedElements", {
                get: () => [tab],
                configurable: true
              });

              // Temporarily suppress selectedTab and selectedItem setters during startTabDrag
              Object.defineProperty(window.gBrowser, "selectedTab", {
                get: () => currentActiveTab,
                set: () => {},
                configurable: true
              });

              if (tabContainer) {
                Object.defineProperty(tabContainer, "selectedItem", {
                  get: () => currentActiveTab,
                  set: () => {},
                  configurable: true
                });
              }

              try {
                return orig.call(this, event, tab, options);
              } catch (e) {
                if (Core.getPref(Constants.DEBUG_PREF)) console.warn("[Zentral] startTabDrag snapshot notice:", e);
                return true;
              } finally {
                // Restore native prototype getters and setters immediately
                delete window.gBrowser.selectedElements;
                delete window.gBrowser.selectedTab;
                if (tabContainer) {
                  delete tabContainer.selectedItem;
                }
              }
            }

            try {
              return orig.call(this, event, tab, options);
            } catch (e) {
              if (Core.getPref(Constants.DEBUG_PREF)) console.warn("[Zentral] startTabDrag fallback:", e);
              return true;
            }
          };
        }
      });

      // 6. Implement Same-Window Tab Group & Split View Reordering in gBrowser.adoptTabGroup
      let origAdoptTabGroup = null;
      if (window.gBrowser && typeof window.gBrowser.adoptTabGroup === "function") {
        origAdoptTabGroup = window.gBrowser.adoptTabGroup;
        window.gBrowser.adoptTabGroup = function(group, options = {}) {
          if (group && group.ownerDocument === document) {
            let target = options.insertBefore;
            if (!target && options.elementIndex !== undefined && tabContainer?.ariaFocusableItems) {
              target = tabContainer.ariaFocusableItems.at(options.elementIndex) || null;
            }
            if (target && target !== group && target !== group.labelContainerElement && !group.contains(target)) {
              target.before(group);
            } else if (!target && tabContainer?.arrowScrollbox) {
              tabContainer.arrowScrollbox.appendChild(group);
            }
            return group;
          }
          return origAdoptTabGroup.call(this, group, options);
        };
      }

      // 7. Intercept gZenViewSplitter.splitTabs to maintain dormant tab state during split creation
      let origSplitTabs = null;
      if (window.gZenViewSplitter && typeof window.gZenViewSplitter.splitTabs === "function") {
        origSplitTabs = window.gZenViewSplitter.splitTabs;
        window.gZenViewSplitter.splitTabs = function(tabs, gridType, initialIndex = 0, options = {}) {
          const currentActiveTab = window.gBrowser?.selectedTab;
          const hasActiveTab = Array.isArray(tabs) && currentActiveTab && tabs.includes(currentActiveTab);
          let targetIndex = initialIndex;
          if (!hasActiveTab && targetIndex >= 0) {
            targetIndex = -1;
          }
          return origSplitTabs.call(this, tabs, gridType, targetIndex, options);
        };
      }

      // 8. Filter split-view groups from gBrowser.getAllTabGroups so they never appear as "Unnamed group" in "Add Tab to Group" context menus
      let origGetAllTabGroups = null;
      if (window.gBrowser && typeof window.gBrowser.getAllTabGroups === "function") {
        origGetAllTabGroups = window.gBrowser.getAllTabGroups;
        window.gBrowser.getAllTabGroups = function(options) {
          const groups = origGetAllTabGroups.call(this, options);
          return groups.filter(g => g && !g.hasAttribute?.("split-view-group") && !g.hasAttribute?.("zen-split-view") && !g.hasAttribute?.("is-zen-split"));
        };
      }

      this.#dragGuardCleanup = () => {
        tabContainer.removeEventListener("mousedown", onMouseDown, { capture: true });
        window.removeEventListener("mouseup", onMouseUp, { capture: true });
        window.removeEventListener("dragend", clearGuard, { capture: true });
        window.removeEventListener("drop", clearGuard, { capture: true });
        window.removeEventListener("dragstart", onSplitterDragStart, { capture: true });
        window.removeEventListener("mousedown", onSplitterMouseDown, { capture: true });
        clearGuard();
        origDragTargetMap.forEach((orig, target) => {
          target._getDragTarget = orig;
        });
        origDragTargetMap.clear();
        origStartMap.forEach((orig, target) => {
          target.startTabDrag = orig;
        });
        origStartMap.clear();
        if (origAdoptTabGroup && window.gBrowser) {
          window.gBrowser.adoptTabGroup = origAdoptTabGroup;
        }
        if (origSplitTabs && window.gZenViewSplitter) {
          window.gZenViewSplitter.splitTabs = origSplitTabs;
        }
        if (origGetAllTabGroups && window.gBrowser) {
          window.gBrowser.getAllTabGroups = origGetAllTabGroups;
        }
        this.#tabDragGuardInitialized = false;
      };
    }


    /* --------------------------------------------------------------------------
     * 4.3 Group Hierarchy & Storage Serialization
     * --------------------------------------------------------------------------
     */

    /**
     * Converts a tab group into a native Zen tab folder.
     * @param {Element} group - Tab group DOM element.
     */
    convertGroupToFolder(group) {
      if (!window.gZenFolders) return;
      const tabs = Array.from(group.tabs);
      if (tabs.length === 0) return;
      
      const newFolder = window.gZenFolders.createFolder(tabs, {
        label: group.label || "New Folder",
        renameFolder: false,
        workspaceId: group.getAttribute("zen-workspace-id") || window.gZenWorkspaces?.activeWorkspace,
      });

      if (newFolder) {
        try { gBrowser.removeTabGroup(group); this.removeSavedColor(group.id); } catch(e) {}
      }
    }

    /**
     * Converts a native Zen tab folder into a Zentral tab group.
     * @param {Element} folder - Zen folder DOM element.
     */
    convertFolderToGroup(folder) {
      const tabsToGroup = folder.allItemsRecursive.filter(item => gBrowser.isTab(item) && !item.hasAttribute('zen-empty-tab'));
      if (tabsToGroup.length === 0) {
        if (folder?.isConnected && typeof folder.delete === 'function') folder.delete();
        return;
      }
      
      tabsToGroup.forEach(tab => { if (tab.pinned) gBrowser.unpinTab(tab); });
      setTimeout(() => {
        const newGroup = document.createXULElement('tab-group');
        newGroup.id = `${Date.now()}-${Math.round(Math.random() * 100)}`;
        newGroup.label = folder.label || "New Group";
        
        const container = gZenWorkspaces.activeWorkspaceStrip || gBrowser.tabContainer.querySelector('tabs');
        container.prepend(newGroup);
        newGroup.addTabs(tabsToGroup);
        
        if (folder?.isConnected && typeof folder.delete === 'function') folder.delete();
        this.processGroup(newGroup);
      }, 200);
    }

    /**
     * Computes the average RGB color from an array of RGB color tuples.
     * @param {Array<Array<number>>} colors - Array of [r, g, b] tuples.
     * @returns {Array<number>} Average [r, g, b] color tuple.
     */
    calculateAverageColor(colors) {
      if (colors.length === 0) return [0, 0, 0];
      const total = colors.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
      return [Math.round(total[0] / colors.length), Math.round(total[1] / colors.length), Math.round(total[2] / colors.length)];
    }

    /**
     * Determines contrasting text color ('black' or 'white') for a given background color string.
     * @param {string} colorStr - Hex or RGB color string.
     * @returns {string} 'black' or 'white'.
     */
    getContrastColor(colorStr) {
      if (!colorStr) return "#ffffff";
      let r, g, b;
      const str = colorStr.trim();
      if (str.startsWith("rgb")) {
        const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) { r = parseInt(match[1]); g = parseInt(match[2]); b = parseInt(match[3]); }
      } else if (str.startsWith("#")) {
        const hex = str.replace("#", "");
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length >= 6) {
          r = parseInt(hex.substr(0, 2), 16); g = parseInt(hex.substr(2, 2), 16); b = parseInt(hex.substr(4, 2), 16);
        }
      }
      if (r !== undefined && g !== undefined && b !== undefined) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.55 ? "#111111" : "#ffffff";
      }
      return "#ffffff";
    }

    /**
     * Clears cached color picker reference objects from window global scope.
     */
    clearStoredColorData() {
      if (window.gZenThemePicker) {
        delete window.gZenThemePicker._currentTabGroup;
        delete window.gZenThemePicker._tabGroupForColorPicker;
      }
    }

    /**
     * Saves tab group custom colors map to user preferences.
     */
    async saveTabGroupColors() {
      let colors = {};
      try {
        const raw = Core.getPref(Constants.TabGroups.PREF_COLORS);
        if (raw && raw !== "{}") colors = JSON.parse(raw) || {};
      } catch (_) {}
      document.querySelectorAll("tab-group:not([split-view-group])").forEach(group => {
        if (group.id) {
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color");
          if (color) colors[group.id] = color;
        }
      });
      Core.setPref(Constants.TabGroups.PREF_COLORS, JSON.stringify(colors));
      this.scheduleStateSave();
    }

    /**
     * Loads and applies saved custom tab group colors from user preferences.
     */
    async loadSavedColors() {
      try {
        const colors = JSON.parse(Core.getPref(Constants.TabGroups.PREF_COLORS));
        if (Object.keys(colors).length > 0) {
          setTimeout(() => {
            Object.entries(colors).forEach(([id, color]) => {
              const group = document.getElementById(id);
              if (group && !group.hasAttribute("split-view-group")) {
                group.style.setProperty("--tab-group-color", color);
                group.style.setProperty("--tab-group-color-invert", color);
                group.style.setProperty("--zentral-custom-color", color);
                group.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(color));
              }
            });
          }, 500);
        }
      } catch (e) {}
    }

    /**
     * Removes a stored color entry for a deleted tab group.
     * @param {string} groupId - Unique tab group ID string.
     */
    async removeSavedColor(groupId) {
      try {
        const colors = JSON.parse(Core.getPref(Constants.TabGroups.PREF_COLORS));
        if (colors[groupId]) {
          delete colors[groupId];
          Core.setPref(Constants.TabGroups.PREF_COLORS, JSON.stringify(colors));
          this.scheduleStateSave();
        }
      } catch (e) {}
    }

    /**
     * Schedules debounced state save for tab groups to prevent excessive disk writes.
     */
    scheduleStateSave() {
      if (this.#isRestoring) return;
      if (this.#state.saveStateTimer) clearTimeout(this.#state.saveStateTimer);
      this.#state.saveStateTimer = setTimeout(() => this.saveTabGroupState(), 1000);
    }

    /**
     * Serializes tab group hierarchy, parent relationships, and collapsed states to user preferences.
     */
    saveTabGroupState() {
      try {
        const ss = this.#getSessionStore();
        const currentWs = window.gZenWorkspaces?.activeWorkspace;

        // Clean any tabs that are no longer part of any tab group (guarding other workspaces)
        const allBrowserTabs = Array.from(gBrowser?.tabs || document.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab"));
        allBrowserTabs.forEach(tab => {
          // Guard: Never strip attributes or SessionStore from tabs belonging to other workspaces
          const tabWs = this.getWorkspaceForElement(tab);
          if (currentWs && tabWs && tabWs !== currentWs) return;
          if (tab.hidden && currentWs && tabWs && tabWs !== currentWs) return;

          const isSplit = tab.hasAttribute?.("is-zen-split") || tab.hasAttribute?.("zen-split-view") || tab.closest?.("tab-group[split-view-group], tab-group[zen-split-view], tab-group[is-zen-split]");
          const tabGroup = !isSplit ? (tab.closest("tab-group:not([split-view-group]):not([zen-split-view]):not([is-zen-split])") || (tab.group && !tab.group.hasAttribute?.("split-view-group") && !tab.group.hasAttribute?.("zen-split-view") && !tab.group.hasAttribute?.("is-zen-split") ? tab.group : null)) : null;
          if (!tabGroup) {
            ["data-zentral-group-id", "data-zentral-group-label", "data-zentral-group-color", "data-zentral-group-collapsed", "data-zentral-group-ws", "data-zentral-parent-id"].forEach(attr => tab.removeAttribute(attr));
            if (ss) {
              ["zentral-group-id", "zentral-group-label", "zentral-group-color", "zentral-parent-id", "zentral-group-collapsed", "zentral-group-ws"].forEach(key => {
                try {
                  if (typeof ss.deleteCustomTabValue === "function") ss.deleteCustomTabValue(tab, key);
                  else if (typeof ss.setCustomTabValue === "function") ss.setCustomTabValue(tab, key, "");
                } catch (_) {}
              });
            }
          }
        });

        // Load existing state to preserve groups and tab mappings from other workspaces
        let existingGroups = {};
        let existingTabMapping = {};
        try {
          const stateStr = Core.getPref(Constants.TabGroups.PREF_STATE);
          if (stateStr && stateStr !== "{}") {
            const parsed = JSON.parse(stateStr);
            existingGroups = (parsed && parsed.groups) ? parsed.groups : (parsed || {});
            existingTabMapping = (parsed && parsed.tabMapping) ? parsed.tabMapping : {};
          }
        } catch (_) {}

        const mergedGroups = { ...existingGroups };
        const mergedTabMapping = { ...existingTabMapping };

        document.querySelectorAll("tab-group:not([split-view-group]):not([zen-split-view]):not([is-zen-split])").forEach(group => {
          if (!group.id) return;
          if (group.hasAttribute("split-view-group") || group.hasAttribute("zen-split-view") || group.hasAttribute("is-zen-split")) return;

          const parent = group.parentElement?.closest("tab-group, zen-folder") ?? null;
          const posContainer = parent || group.parentElement;
          const groupSiblings = posContainer
            ? Array.from(posContainer.children).filter(
                el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group") && !el.hasAttribute("zen-split-view") && !el.hasAttribute("is-zen-split")
              )
            : [];
          const index = groupSiblings.indexOf(group);

          const label = group.label || group.getAttribute("label") || "Group";
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color") || (existingGroups[group.id]?.color) || "";
          const wsId = this.getWorkspaceForElement(group);
          if (wsId) group.setAttribute("zen-workspace-id", wsId);

          mergedGroups[group.id] = {
            id: group.id,
            label,
            color,
            collapsed: group.hasAttribute("collapsed"),
            parentId: parent?.id ?? null,
            workspaceId: wsId,
            index,
          };

          let directTabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab")).filter(t => t.closest("tab-group") === group);
          if (directTabs.length === 0 && group.tabs) {
            directTabs = Array.from(group.tabs);
          }

          mergedTabMapping[group.id] = directTabs.map(t => ({
            zenTabId: t.getAttribute("zen-tab-id") || t.id,
            url: t.linkedBrowser?.currentURI?.spec || ""
          }));

          // Synchronize DOM attributes and SessionStore with live state
          directTabs.forEach(tab => {
            tab.setAttribute("data-zentral-group-id", group.id);
            tab.setAttribute("data-zentral-group-label", label);
            if (color) tab.setAttribute("data-zentral-group-color", color);
            else tab.removeAttribute("data-zentral-group-color");
            
            tab.setAttribute("data-zentral-group-collapsed", group.hasAttribute("collapsed") ? "true" : "false");
            
            if (wsId) {
              tab.setAttribute("data-zentral-group-ws", wsId);
              tab.setAttribute("zen-workspace-id", wsId);
            } else {
              tab.removeAttribute("data-zentral-group-ws");
            }
            
            if (parent?.id) tab.setAttribute("data-zentral-parent-id", parent.id);
            else tab.removeAttribute("data-zentral-parent-id");

            if (ss && typeof ss.setCustomTabValue === "function") {
              try {
                ss.setCustomTabValue(tab, "zentral-group-id", group.id);
                ss.setCustomTabValue(tab, "zentral-group-label", label);
                
                if (color) ss.setCustomTabValue(tab, "zentral-group-color", color);
                else if (typeof ss.deleteCustomTabValue === "function") ss.deleteCustomTabValue(tab, "zentral-group-color");
                
                if (parent?.id) ss.setCustomTabValue(tab, "zentral-parent-id", parent.id);
                else if (typeof ss.deleteCustomTabValue === "function") ss.deleteCustomTabValue(tab, "zentral-parent-id");
                
                ss.setCustomTabValue(tab, "zentral-group-collapsed", group.hasAttribute("collapsed") ? "true" : "false");
                
                if (wsId) ss.setCustomTabValue(tab, "zentral-group-ws", wsId);
                else if (typeof ss.deleteCustomTabValue === "function") ss.deleteCustomTabValue(tab, "zentral-group-ws");
              } catch (_) {}
            }
          });
        });

        Core.setPref(Constants.TabGroups.PREF_STATE, JSON.stringify({
          groups: mergedGroups,
          tabMapping: mergedTabMapping
        }));
      } catch (e) {
        console.warn("[ZentralTabGroups] Error saving state", e);
      }
    }

    /**
     * Restores saved tab group DOM hierarchy, nestings, and collapsed states from user preferences.
     */
    loadTabGroupState() {
      try {
        const stateStr = Core.getPref(Constants.TabGroups.PREF_STATE);
        const forceCollapse = Core.getPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH);
        if (!stateStr || stateStr === "{}") return;
        const parsed = JSON.parse(stateStr);
        const state = parsed.groups || parsed;

        // Sort ascending by saved index
        const groupsToProcess = Array.from(
          document.querySelectorAll("tab-group:not([split-view-group])")
        ).sort((a, b) => {
          const aIdx = state[a.id]?.index ?? Infinity;
          const bIdx = state[b.id]?.index ?? Infinity;
          return aIdx - bIdx;
        });

        // Pass 1: Reconstruct the DOM nesting for groups that have a saved parentId.
        groupsToProcess
          .filter(g => state[g.id]?.parentId)
          .forEach(group => {
            const groupState = state[group.id];
            const parent = document.getElementById(groupState.parentId);
            if (!parent || group.contains(parent)) return; // Guard: avoid circular nesting

            const targetParentContainer = parent.querySelector(".tab-group-container") || parent;

            const freshGroupChildren = Array.from(targetParentContainer.children).filter(
              el =>
                el.tagName?.toLowerCase() === "tab-group" &&
                !el.hasAttribute("split-view-group") &&
                el !== group
            );

            const targetIndex = groupState.index ?? freshGroupChildren.length;

            const alreadyInParent = group.parentElement === targetParentContainer || group.parentElement === parent;
            if (alreadyInParent) {
              const currentIdx = Array.from(targetParentContainer.children)
                .filter(
                  el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group")
                )
                .indexOf(group);
              if (currentIdx === targetIndex) return;
            }

            const refSibling = freshGroupChildren[targetIndex] ?? null;
            if (refSibling) {
              targetParentContainer.insertBefore(group, refSibling);
            } else {
              targetParentContainer.appendChild(group);
            }
          });

        // Pass 2: Restore collapsed states.
        groupsToProcess.forEach(group => {
          if (!group.id) return;
          const isCollapsed = forceCollapse || state[group.id]?.collapsed === true;
          if (isCollapsed) {
            group.setAttribute("collapsed", "true");
          } else {
            group.removeAttribute("collapsed");
          }
          group.collapsed = isCollapsed;
        });
      } catch (e) {
        console.warn("[ZentralTabGroups] Failed to load state", e);
      }
    }
  }
  /* ============================================================================
   * 5.0 SETTINGS MODULE (ZentralSettings)
   * ============================================================================
   */

  /**
   * Zentral Settings Module
   * Manages the preferences modal dialog UI, form controls, and options persistence.
   */
  class ZentralSettings {
    /**
     * Constructs ZentralSettings instance.
     */
    constructor() {
      /** @type {Element|null} Reference to modal dialog overlay container */
      this.modal = null;
    }
    
    /**
     * Module initialization hook.
     */
    init() { }
    
    /**
     * Module tear down for Sine hot unloading
     */
    destroy() {
      try {
        if (Core.getPref(Constants.DEBUG_PREF)) console.log("[ZentralSettings] Destroying Settings module...");
        if (this.modal) {
          if (this.close) this.close();
          if (this.modal.parentNode) this.modal.remove();
          this.modal = null;
        }
        const modalEl = document.getElementById("zentral-settings-modal");
        if (modalEl) modalEl.remove();
        const stylesEl = document.getElementById("zentral-settings-styles");
        if (stylesEl) stylesEl.remove();
        this._stylesInjected = false;
        delete window.ZentralSettingsInstance;
        document.documentElement.removeAttribute("zentral-app-panel-open");
      } catch (e) {
        console.error("[Zentral] Settings destroy error:", e);
      }
    }

    /**
     * Dynamically positions the modal dialog to fit the content area, excluding the sidebar.
     */
    updatePosition() {
      if (!this.modal) return;
      try {
        const sidebar = document.getElementById("sidebar-box") || 
                        document.getElementById("sidebar-container") || 
                        document.getElementById("vertical-tabs") ||
                        document.getElementById("tabbrowser-tabs")?.closest("#sidebar-box, #sidebar-container, #vertical-tabs, .zen-sidebar") ||
                        document.getElementById("tabbrowser-tabs");
        
        const isSidebarCollapsed = document.documentElement.getAttribute("zen-sidebar-collapsed") === "true" ||
                                   document.documentElement.getAttribute("zentral-sidebar-collapsed") === "true";

        if (sidebar && !isSidebarCollapsed) {
          const sRect = sidebar.getBoundingClientRect();
          const isRight = document.documentElement.getAttribute("zen-sidebar-right") === "true" || 
                          document.documentElement.getAttribute("zen-right-side") === "true" ||
                          (sRect.left > window.innerWidth / 2);

          if (sRect.width > 20 && sRect.width < window.innerWidth) {
            if (isRight) {
              this.modal.style.left = "0px";
              this.modal.style.top = "0px";
              this.modal.style.bottom = "0px";
              this.modal.style.right = (window.innerWidth - Math.round(sRect.left)) + "px";
              this.modal.style.width = Math.round(sRect.left) + "px";
            } else {
              this.modal.style.left = Math.round(sRect.right) + "px";
              this.modal.style.top = "0px";
              this.modal.style.bottom = "0px";
              this.modal.style.right = "0px";
              this.modal.style.width = (window.innerWidth - Math.round(sRect.right)) + "px";
            }
            this.modal.style.height = "100vh";
            return;
          }
        }
      } catch (_) {}

      this.modal.style.left = "0px";
      this.modal.style.top = "0px";
      this.modal.style.right = "0px";
      this.modal.style.bottom = "0px";
      this.modal.style.width = "100vw";
      this.modal.style.height = "100vh";
    }

    /**
     * Opens the settings modal dialog.
     */
    open() {
      if (!this.modal) {
        this.createModal();
      }
      this.modal.setAttribute("data-open", "true");
      this.modal.style.setProperty("display", "flex", "important");
      this.populate();
      this.updatePosition();

      if (!this._resizeHandler) {
        this._resizeHandler = () => this.updatePosition();
        window.addEventListener("resize", this._resizeHandler, { passive: true });
      }
    }

    /**
     * Closes the settings modal dialog.
     */
    close() {
      if (this.modal) {
        this.modal.setAttribute("data-open", "false");
        this.modal.style.setProperty("display", "none", "important");
      }
      if (this._resizeHandler) {
        window.removeEventListener("resize", this._resizeHandler);
        this._resizeHandler = null;
      }
    }

    /**
     * Opens the native OS directory picker dialog to select an export folder.
     * @returns {Promise<string|null>} Selected directory path or null if cancelled.
     */
    async pickExportFolder() {
      return new Promise((resolve) => {
        try {
          const nsIFilePicker = Ci?.nsIFilePicker || Components.interfaces.nsIFilePicker;
          const fp = (Cc?.["@mozilla.org/filepicker;1"] || Components.classes["@mozilla.org/filepicker;1"]).createInstance(nsIFilePicker);
          
          const parentWin = window.browsingContext || window;
          fp.init(parentWin, "Select Diagnostic Log Export Directory", nsIFilePicker.modeGetFolder);
          
          let resolved = false;
          const onDone = (result) => {
            if (resolved) return;
            resolved = true;
            if (result === nsIFilePicker.returnOK && fp.file) {
              resolve(fp.file.path);
            } else {
              resolve(null);
            }
          };

          if (typeof fp.open === "function") {
            try {
              const res = fp.open({
                done(val) {
                  onDone(val);
                }
              });
              if (res && typeof res.then === "function") {
                res.then(result => onDone(result)).catch(() => onDone(null));
              }
            } catch (_) {
              try {
                const res2 = fp.open(val => onDone(val));
                if (res2 && typeof res2.then === "function") {
                  res2.then(result => onDone(result)).catch(() => onDone(null));
                }
              } catch (e2) {
                onDone(null);
              }
            }
          } else if (typeof fp.show === "function") {
            const res = fp.show();
            onDone(res);
          } else {
            onDone(null);
          }
        } catch (err) {
          console.error("[ZentralSettings] Error opening folder picker:", err);
          resolve(null);
        }
      });
    }

    /**
     * Updates the folder button label and description based on current export path.
     * @param {string} path - Directory path.
     */
    updatePathUI(path) {
      if (!this.modal) return;
      const label = this.modal.querySelector("#zs-btn-choose-path-label");
      const btn = this.modal.querySelector("#zs-btn-choose-path");
      const clearBtn = this.modal.querySelector("#zs-btn-clear-path");
      const desc = this.modal.querySelector("#zs-pref-logger-path-desc");
      if (!label || !btn) return;

      if (path && path.trim() !== "") {
        const cleanPath = path.trim();
        const parts = cleanPath.split(/[\\/]/).filter(Boolean);
        const folderName = parts.pop() || cleanPath;
        label.textContent = folderName;
        btn.title = cleanPath;
        if (clearBtn) clearBtn.style.display = "flex";
        if (desc) desc.textContent = `Saving to: ${cleanPath}`;
      } else {
        label.textContent = "Default Folder";
        btn.title = "Logs will be saved in profile chrome/logs directory. Click to change folder.";
        if (clearBtn) clearBtn.style.display = "none";
        if (desc) desc.textContent = "Directory where diagnostic logs are saved";
      }
    }

    /**
     * Reads preferences from ZentralCore and populates modal input fields and switches.
     */
    populate() {
      if (!this.modal) return;
      const get = (id) => this.modal.querySelector("#" + id);
      if (!get("zs-anim-speed")) return;
      
      const appsEnabled = Core.getPref(Constants.Apps.PREF_ENABLED, true) !== false;
      if (get("zs-ag-enabled")) {
        get("zs-ag-enabled").checked = appsEnabled;
        if (get("zs-ag-status")) {
          get("zs-ag-status").textContent = appsEnabled ? "Enabled" : "Disabled";
          get("zs-ag-status").setAttribute("data-enabled", appsEnabled ? "true" : "false");
        }
        if (get("zs-ag-content")) {
          get("zs-ag-content").setAttribute("data-disabled", !appsEnabled ? "true" : "false");
        }
      }

      const placement = Core.getPref(Constants.Apps.PREF_PLACEMENT, "sidebar") || "sidebar";
      if (get("zs-ag-placement")) get("zs-ag-placement").value = placement;
      if (get("zs-ag-col")) get("zs-ag-col").setAttribute("data-placement", placement);
      this.modal.querySelectorAll(".zs-placement-btn").forEach(btn => {
        btn.setAttribute("data-active", btn.dataset.placement === placement ? "true" : "false");
      });

      // Show/hide Apps Box Matrix with smooth slide animation based on placement
      const matrixWrapper = get("zs-matrix-wrapper");
      if (matrixWrapper) {
        if (placement === "sidebar") {
          matrixWrapper.removeAttribute("data-hidden");
        } else {
          matrixWrapper.setAttribute("data-hidden", "true");
        }
      }

      const cols = Core.getPref(Constants.Apps.PREF_APPS_PER_ROW, 7) || 7;
      const rows = Core.getPref(Constants.Apps.PREF_MAX_ROWS, 3) || 3;
      this.updateMatrixUI(cols, rows);

      const animType = Core.getPref(Constants.Apps.PREF_ANIMATION_TYPE, "slide") || "slide";
      const animSpeed = Core.getPref(Constants.Apps.PREF_ANIMATION_SPEED, 450) || 450;
      const maxApps = Core.getPref(Constants.Apps.PREF_MAX_APPS, 21) || 21;

      const animDropdown = this.modal.querySelector("#zs-anim-type-dropdown");
      if (animDropdown && animDropdown.syncValue) {
        animDropdown.syncValue(animType);
      } else if (get("zs-anim-type")) {
        get("zs-anim-type").value = animType;
      }

      get("zs-anim-speed").value = animSpeed;
      if (get("zs-anim-speed-slider")) get("zs-anim-speed-slider").value = animSpeed;
      if (get("zs-anim-speed-badge")) get("zs-anim-speed-badge").textContent = `${animSpeed} ms`;
      get("zs-max-apps").value = maxApps;

      this.updatePreviewDemo(animType, animSpeed);

      const tgEnabled = Core.getPref(Constants.TabGroups.PREF_ENABLED, true) !== false;
      if (get("zs-tg-enabled")) {
        get("zs-tg-enabled").checked = tgEnabled;
        if (get("zs-tg-status")) {
          get("zs-tg-status").textContent = tgEnabled ? "Enabled" : "Disabled";
          get("zs-tg-status").setAttribute("data-enabled", tgEnabled ? "true" : "false");
        }
        if (get("zs-tg-content")) {
          get("zs-tg-content").setAttribute("data-disabled", !tgEnabled ? "true" : "false");
        }
      }

      get("zs-tg-collapse").checked = Core.getPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH, false) === true;
      get("zs-tg-thumbnails").checked = Core.getPref(Constants.TabGroups.PREF_THUMBNAILS, true) !== false;
      
      const showIndicator = Core.getPref(Constants.TabGroups.PREF_SHOW_CHEVRON, true) !== false;
      get("zs-tg-chevron").checked = showIndicator;
      const indicatorTypeRow = get("zs-tg-indicator-type-row");
      if (indicatorTypeRow) {
        if (showIndicator) {
          indicatorTypeRow.removeAttribute("data-hidden");
        } else {
          indicatorTypeRow.setAttribute("data-hidden", "true");
        }
      }
      
      const indicatorType = Core.getPref(Constants.TabGroups.PREF_INDICATOR_TYPE, "circle") || "circle";
      const tgDropdown = this.modal.querySelector("#zs-tg-indicator-type-dropdown");
      if (tgDropdown && tgDropdown.syncValue) {
        tgDropdown.syncValue(indicatorType);
      } else if (get("zs-tg-indicator-type")) {
        get("zs-tg-indicator-type").value = indicatorType;
      }
      
      const opacity = Core.getPref(Constants.TabGroups.PREF_LABEL_OPACITY, 85) || 85;
      if (get("zs-tg-opacity")) {
        get("zs-tg-opacity").value = opacity;
        if (get("zs-tg-opacity-badge")) get("zs-tg-opacity-badge").textContent = opacity + "%";
      }
      
      if (get("zs-pref-logger-enabled")) {
        get("zs-pref-logger-enabled").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, false);
      }
      if (get("zs-pref-logger-full")) {
        get("zs-pref-logger-full").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_FULL, true);
      }
      if (get("zs-pref-logger-core")) {
        get("zs-pref-logger-core").checked = true; // Always on
      }
      if (get("zs-pref-logger-tabs")) {
        get("zs-pref-logger-tabs").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_TABS, false);
      }
      if (get("zs-pref-logger-apps")) {
        get("zs-pref-logger-apps").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_APPS, false);
      }
      if (get("zs-pref-logger-menus")) {
        get("zs-pref-logger-menus").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_MENUS, false);
      }
      if (get("zs-pref-logger-layout")) {
        get("zs-pref-logger-layout").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_LAYOUT, false);
      }
      if (get("zs-pref-logger-path")) {
        const savedPath = Core.getPref(Constants.Diagnostics.PREF_LOGGER_PATH, "");
        get("zs-pref-logger-path").value = savedPath;
        this.updatePathUI(savedPath);
      }

      this.updateLoggerUIState();
    }

    /**
     * Synchronizes dynamic visibility and interactivity across Diagnostic Logging toggles.
     */
    updateLoggerUIState() {
      if (!this.modal) return;
      const get = (id) => this.modal.querySelector("#" + id);
      const masterToggle = get("zs-pref-logger-enabled");
      const fullToggle = get("zs-pref-logger-full");
      const optionsSection = get("zs-logger-options-section");
      const modulesContainer = get("zs-logger-modules-container");

      const isMasterOn = masterToggle ? masterToggle.checked : false;
      if (optionsSection) {
        if (isMasterOn) {
          optionsSection.classList.remove("zs-section-disabled");
        } else {
          optionsSection.classList.add("zs-section-disabled");
        }
      }

      const isFull = fullToggle ? fullToggle.checked : true;
      if (modulesContainer) {
        modulesContainer.setAttribute("data-hidden", isFull ? "true" : "false");
      }
    }

    /**
     * Updates the animation preview demo element with live easing curve and duration.
     * @param {string} type - Animation easing type
     * @param {number} speedMs - Animation duration in milliseconds
     */
    updatePreviewDemo(type, speedMs) {
      if (!this.modal) return;
      const previewBox = this.modal.querySelector("#zs-anim-preview-box");
      if (!previewBox) return;

      let curve = "cubic-bezier(0.25, 1, 0.5, 1)";
      if (type === "spring-snappy") curve = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      else if (type === "spring-gentle") curve = "cubic-bezier(0.34, 1.3, 0.64, 1)";
      else if (type === "spring-bouncy") curve = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
      else if (type === "elastic") curve = "cubic-bezier(0.68, -0.6, 0.32, 1.6)";
      else if (type === "none") curve = "step-end";

      const duration = (type === "none" || speedMs <= 0) ? "0.01s" : `${(speedMs / 1000).toFixed(2)}s`;
      previewBox.style.setProperty("--zs-preview-anim-curve", curve);
      previewBox.style.setProperty("--zs-preview-anim-duration", duration);
    }

    /**
     * Updates the 10x6 matrix selection visual state and hidden inputs.
     * @param {number} cols - Columns count (1 to 10)
     * @param {number} rows - Rows count (1 to 6)
     */
    updateMatrixUI(cols, rows) {
      if (!this.modal) return;
      const clampedCols = Math.max(1, Math.min(10, parseInt(cols, 10) || 1));
      const clampedRows = Math.max(1, Math.min(6, parseInt(rows, 10) || 1));

      const cells = this.modal.querySelectorAll(".zs-matrix-cell");
      cells.forEach(cell => {
        const c = parseInt(cell.dataset.col, 10);
        const r = parseInt(cell.dataset.row, 10);
        cell.setAttribute("data-selected", (c <= clampedCols && r <= clampedRows) ? "true" : "false");
      });

      const get = (id) => this.modal.querySelector("#" + id);
      if (get("zs-apps-row")) get("zs-apps-row").value = clampedCols;
      if (get("zs-max-rows")) get("zs-max-rows").value = clampedRows;
      if (get("zs-matrix-dims")) get("zs-matrix-dims").textContent = `${clampedCols} Columns × ${clampedRows} Rows`;
      if (get("zs-matrix-total-badge")) get("zs-matrix-total-badge").textContent = `${clampedCols * clampedRows} Visible Apps`;
    }

    /**
     * Reads form fields from modal UI, saves settings via ZentralCore, and triggers UI re-renders.
     */
    save() {
      if (!this.modal) return;
      const get = (id) => this.modal.querySelector("#" + id);
      Core.setPref(Constants.Apps.PREF_ENABLED, get("zs-ag-enabled").checked);
      if (get("zs-ag-placement")) {
        Core.setPref(Constants.Apps.PREF_PLACEMENT, get("zs-ag-placement").value);
      }
      Core.setPref(Constants.Apps.PREF_ANIMATION_TYPE, get("zs-anim-type").value);
      Core.setPref(Constants.Apps.PREF_ANIMATION_SPEED, parseInt(get("zs-anim-speed").value) || 0);
      Core.setPref(Constants.Apps.PREF_MAX_APPS, parseInt(get("zs-max-apps").value) || 21);
      Core.setPref(Constants.Apps.PREF_APPS_PER_ROW, parseInt(get("zs-apps-row").value) || 7);
      Core.setPref(Constants.Apps.PREF_MAX_ROWS, parseInt(get("zs-max-rows").value) || 3);

      Core.setPref(Constants.TabGroups.PREF_ENABLED, get("zs-tg-enabled").checked);
      Core.setPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH, get("zs-tg-collapse").checked);
      Core.setPref(Constants.TabGroups.PREF_THUMBNAILS, get("zs-tg-thumbnails").checked);
      Core.setPref(Constants.TabGroups.PREF_SHOW_CHEVRON, get("zs-tg-chevron").checked);
      if (get("zs-tg-indicator-type")) {
        Core.setPref(Constants.TabGroups.PREF_INDICATOR_TYPE, get("zs-tg-indicator-type").value);
      }
      if (get("zs-tg-opacity")) {
        Core.setPref(Constants.TabGroups.PREF_LABEL_OPACITY, parseInt(get("zs-tg-opacity").value) || 85);
      }

      if (get("zs-pref-logger-enabled")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, get("zs-pref-logger-enabled").checked);
      }
      if (get("zs-pref-logger-full")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_FULL, get("zs-pref-logger-full").checked);
      }
      Core.setPref(Constants.Diagnostics.PREF_LOGGER_CORE, true);
      if (get("zs-pref-logger-tabs")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_TABS, get("zs-pref-logger-tabs").checked);
      }
      if (get("zs-pref-logger-apps")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_APPS, get("zs-pref-logger-apps").checked);
      }
      if (get("zs-pref-logger-menus")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_MENUS, get("zs-pref-logger-menus").checked);
      }
      if (get("zs-pref-logger-layout")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_LAYOUT, get("zs-pref-logger-layout").checked);
      }
      if (get("zs-pref-logger-path")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_PATH, get("zs-pref-logger-path").value.trim());
      }
      
      this.close();
      if (window.Zentral?.Apps) {
        window.Zentral.Apps.repositionGrid();
        window.Zentral.Apps.updateAutohideState();
        window.Zentral.Apps.renderGrid();
      }
      if (window.Zentral?.TabGroups) {
        window.Zentral.TabGroups.applyChevronPref();
        window.Zentral.TabGroups.applyIndicatorTypePref();
        window.Zentral.TabGroups.applyLabelOpacityPref();
      }
    }

    injectStyles() {
      const existing = document.getElementById("zentral-settings-styles");
      if (existing) existing.remove();
      this._stylesInjected = true;
      const css = `
        #zentral-settings-modal {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100vh;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          z-index: 2147483647;
          display: none;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        #zentral-settings-modal[data-open="true"] {
          display: flex !important;
          animation: zsFadeIn 0.18s ease-out;
        }

        #zentral-settings-modal[data-open="false"] {
          display: none !important;
        }

        @keyframes zsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes zsModalPop {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes zsTabFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .zs-dialog {
          background: #0d0d12 !important;
          color: #e4e4e7 !important;
          width: 1120px !important;
          max-width: 95vw !important;
          height: 780px !important;
          max-height: 94vh !important;
          border-radius: 14px !important;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.09) !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: zsModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .zs-header {
          padding: 18px 32px 14px 32px;
          background: #13131a !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #ffffff;
          flex-shrink: 0;
        }

        .zs-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .zs-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .zs-version-badge {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 9999px;
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--zen-primary-color, #6366f1) 25%, transparent);
          color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 85%, #ffffff);
          font-weight: 500;
        }

        .zs-close-btn {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
          color: #71717a;
          cursor: pointer;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
          padding: 0;
        }

        .zs-close-btn * {
          pointer-events: none;
        }

        .zs-close-btn:hover {
          color: #ffffff;
          background: transparent;
          border: none;
          box-shadow: none;
        }

        .zs-close-btn:active {
          color: #d4d4d8;
          background: transparent;
          border: none;
          box-shadow: none;
          transform: scale(0.94);
        }

        .zs-tab-bar {
          display: flex;
          padding: 0 32px;
          background: #13131a !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
          gap: 24px;
          flex-shrink: 0;
        }

        .zs-tab-btn {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
          padding: 10px 4px;
          font-size: 13.5px;
          font-weight: 500;
          color: #71717a;
          cursor: pointer;
          position: relative;
          transition: color 0.15s ease;
          user-select: none;
        }

        .zs-tab-btn:hover {
          color: #d4d4d8;
          background: transparent;
          border: none;
          outline: none;
          box-shadow: none;
        }

        .zs-tab-btn[data-active="true"] {
          color: #ffffff;
          font-weight: 600;
          background: transparent;
          border: none;
          outline: none;
          box-shadow: none;
        }

        .zs-tab-btn[data-active="true"]::after {
          content: "";
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--zen-primary-color, #6366f1);
        }

        .zs-body {
          padding: 22px 32px;
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          overflow: hidden;
          background: #0d0d12 !important;
        }

        .zs-tab-panel {
          display: none;
          flex-direction: column;
          width: 100%;
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
        }

        .zs-tab-panel[data-active="true"] {
          display: flex !important;
          animation: zsTabFadeIn 0.18s ease-out;
        }

        .zs-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          align-items: stretch;
          width: 100%;
          height: 100%;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }

        .zs-col {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
        }

        #zs-ag-col {
          padding-right: 24px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }

        #zs-tg-col {
          padding-left: 24px;
          overflow: visible;
        }

        .zs-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding-bottom: 8px;
          margin-bottom: 4px;
          flex-shrink: 0;
          pointer-events: auto;
          position: sticky;
          top: 0;
          background: #0d0d12;
          z-index: 10;
        }

        .zs-section-title {
          font-size: 13px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #f4f4f5;
          margin: 0;
        }

        .zs-header-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          pointer-events: auto;
        }

        .zs-toggle-status {
          font-size: 12px;
          font-weight: 500;
          color: #a1a1aa;
          user-select: none;
        }

        .zs-section-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1 1 auto;
          min-height: 0;
          padding-top: 8px;
          padding-right: 4px;
          overflow-y: auto;
          overflow-x: hidden;
          transition: opacity 0.2s ease, filter 0.2s ease;
        }

        .zs-section-content > * {
          flex-shrink: 0;
        }

        .zs-section-content::-webkit-scrollbar,
        .zs-col::-webkit-scrollbar {
          width: 5px;
        }

        .zs-section-content::-webkit-scrollbar-track,
        .zs-col::-webkit-scrollbar-track {
          background: transparent;
        }

        .zs-section-content::-webkit-scrollbar-thumb,
        .zs-col::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 9999px;
        }

        .zs-section-content::-webkit-scrollbar-thumb:hover,
        .zs-col::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }

        .zs-section-content[data-disabled="true"] {
          opacity: 0.35;
          pointer-events: none;
          filter: grayscale(0.65);
        }

        .zs-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          min-height: 30px;
        }

        .zs-label-container {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-width: 0;
        }

        .zs-label {
          font-size: 13.5px;
          font-weight: 500;
          color: #ffffff;
        }

        .zs-sublabel {
          font-size: 11.5px;
          color: #a1a1aa;
          margin-top: 2px;
          line-height: 1.35;
        }

        .zs-placement-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .zs-placement-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .zs-placement-btn {
          -moz-appearance: none;
          appearance: none;
          position: relative;
          background: rgba(24, 24, 27, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 10px 10px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          color: #a1a1aa;
          outline: none;
          user-select: none;
          box-sizing: border-box;
          box-shadow: none;
        }

        .zs-placement-btn * {
          pointer-events: none;
        }

        .zs-placement-btn:hover {
          border-color: rgba(255, 255, 255, 0.22);
          background: rgba(39, 39, 42, 0.4);
          color: #f4f4f5;
          box-shadow: none;
        }

        .zs-placement-btn[data-active="true"] {
          border-color: var(--zen-primary-color, #6366f1);
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 12%, rgba(24, 24, 27, 0.7));
          box-shadow: none;
          color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 85%, #ffffff);
        }

        .zs-placement-btn .zs-placement-svg-box {
          width: 128px;
          height: 64px;
          border-radius: 6px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 5px;
          gap: 5px;
          box-sizing: border-box;
        }

        .zs-placement-sidebar-container {
          width: 24px;
          height: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 2px;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .zs-placement-appbox-indicator {
          width: 100%;
          height: 15px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-sizing: border-box;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .zs-placement-btn[data-active="true"] .zs-placement-appbox-indicator {
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 40%, transparent);
          border-color: var(--zen-primary-color, #6366f1);
        }

        .zs-placement-sidebar-body {
          width: 100%;
          flex: 1 1 auto;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 2px;
        }

        .zs-placement-btn .zs-placement-bar-indicator {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 3px;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .zs-placement-btn[data-active="true"] .zs-placement-bar-indicator {
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 40%, transparent);
          border-color: var(--zen-primary-color, #6366f1);
        }

        .zs-placement-btn .zs-placement-content-preview {
          flex: 1 1 auto;
          height: 100%;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 3px;
        }

        .zs-placement-label {
          font-size: 13px;
          font-weight: 500;
          transition: color 0.15s ease, font-weight 0.15s ease;
        }

        .zs-placement-btn[data-active="true"] .zs-placement-label {
          color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 85%, #ffffff);
          font-weight: 700;
        }

        .zs-h-stepper {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 2px;
          height: 32px;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .zs-h-btn {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: #a1a1aa;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease, color 0.12s ease;
          user-select: none;
          padding: 0;
        }

        .zs-h-btn:hover {
          background: #27272a;
          color: #ffffff;
        }

        .zs-h-btn:active {
          background: var(--zen-primary-color, #6366f1);
          color: #ffffff;
        }

        .zs-h-val {
          width: 32px;
          background: transparent;
          border: none;
          color: #ffffff;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          outline: none;
          -moz-appearance: textfield;
          appearance: textfield;
          padding: 0;
        }

        .zs-h-val::-webkit-outer-spin-button,
        .zs-h-val::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .zs-stacked-slider {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .zs-stacked-slider-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .zs-mono-badge {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          background: #27272a;
          color: #d4d4d8;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .zs-range-slider {
          width: 100%;
          height: 5px;
          border-radius: 9999px;
          background: #27272a;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .zs-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          transition: transform 0.12s ease;
        }

        .zs-range-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .zs-matrix-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 14px 14px 14px;
          overflow: hidden;
          flex-shrink: 0;
          max-height: 420px;
          opacity: 1;
          transform: translateY(0);
          box-sizing: border-box;
          transition: max-height 0.32s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.22s ease,
                      padding 0.32s cubic-bezier(0.16, 1, 0.3, 1),
                      margin 0.32s cubic-bezier(0.16, 1, 0.3, 1),
                      border-width 0.32s ease,
                      transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .zs-matrix-wrapper[data-hidden="true"] {
          max-height: 0 !important;
          opacity: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          border-width: 0 !important;
          transform: translateY(-8px) !important;
          pointer-events: none !important;
        }

        .zs-matrix-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .zs-matrix-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .zs-matrix-readout {
          font-size: 12px;
          font-weight: 500;
          color: var(--zen-primary-color, #6366f1);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .zs-matrix-badge {
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 85%, #ffffff);
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .zs-matrix-grid {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(6, 1fr);
          gap: 6px;
          width: 100%;
          max-width: 100%;
          user-select: none;
          touch-action: none;
          box-sizing: border-box;
          padding: 4px 0 2px 0;
        }

        .zs-matrix-cell {
          aspect-ratio: 1 / 1;
          width: 100%;
          height: auto;
          min-height: 0;
          max-height: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
          box-shadow: none;
          box-sizing: border-box;
        }

        .zs-matrix-cell:hover,
        .zs-matrix-cell[data-hover="true"] {
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 45%, rgba(255,255,255,0.12));
          border-color: var(--zen-primary-color, #6366f1);
          box-shadow: none;
        }

        .zs-matrix-cell[data-selected="true"] {
          background: var(--zen-primary-color, #6366f1);
          border-color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 75%, #ffffff);
          box-shadow: none;
        }

        .zs-matrix-cell[data-selected="true"]:hover,
        .zs-matrix-cell[data-selected="true"][data-hover="true"] {
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 80%, #ffffff);
          border-color: #ffffff;
          box-shadow: none;
          filter: none;
          transform: none;
        }

        .zs-anim-preview-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 8px 12px;
        }

        .zs-anim-preview-box {
          position: relative;
          height: 56px;
          background: #131316;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }

        .zs-anim-preview-sidebar {
          width: 28px;
          height: 100%;
          background: rgba(255, 255, 255, 0.035);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          flex-shrink: 0;
          z-index: 2;
        }

        .zs-anim-preview-dot {
          width: 12px;
          height: 12px;
          border-radius: 3.5px;
          background: rgba(255, 255, 255, 0.15);
        }

        .zs-anim-preview-panel {
          position: absolute;
          left: 29px;
          top: 5px;
          bottom: 5px;
          width: 0;
          max-width: 140px;
          opacity: 0;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid color-mix(in srgb, var(--zen-primary-color, #6366f1) 40%, rgba(255,255,255,0.1));
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 5px 8px;
          gap: 3px;
          box-sizing: border-box;
          pointer-events: none;
          transform: translateX(-10px) scale(0.95);
          transition: width var(--zs-preview-anim-duration, 0.45s) var(--zs-preview-anim-curve, cubic-bezier(0.25, 1, 0.5, 1)),
                      opacity var(--zs-preview-anim-duration, 0.45s) var(--zs-preview-anim-curve, cubic-bezier(0.25, 1, 0.5, 1)),
                      transform var(--zs-preview-anim-duration, 0.45s) var(--zs-preview-anim-curve, cubic-bezier(0.25, 1, 0.5, 1));
        }

        .zs-anim-preview-box:hover .zs-anim-preview-panel,
        .zs-anim-preview-box[data-preview-active="true"] .zs-anim-preview-panel {
          width: 125px;
          opacity: 1;
          transform: translateX(0) scale(1);
        }

        .zs-anim-preview-pill {
          height: 5px;
          width: 44px;
          border-radius: 3px;
          background: var(--zen-primary-color, #6366f1);
        }

        .zs-anim-preview-line {
          height: 3.5px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.2);
          margin-top: 1px;
        }

        .zs-anim-preview-hint {
          position: absolute;
          right: 12px;
          font-size: 11px;
          color: #71717a;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        .zs-anim-preview-box:hover .zs-anim-preview-hint,
        .zs-anim-preview-box[data-preview-active="true"] .zs-anim-preview-hint {
          opacity: 0;
        }

        #zs-panel-diagnostics {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding-right: 6px !important;
          scrollbar-width: thin !important;
          scrollbar-color: #3f3f46 transparent !important;
        }

        #zs-panel-diagnostics::-webkit-scrollbar {
          width: 5px;
        }

        #zs-panel-diagnostics::-webkit-scrollbar-track {
          background: transparent;
        }

        #zs-panel-diagnostics::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 9999px;
        }

        #zs-panel-diagnostics::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }

        .zs-custom-select {
          position: relative;
          user-select: none;
        }

        .zs-custom-select-trigger {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          width: 100%;
          height: 36px;
          min-height: 36px;
          max-height: 36px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #ffffff;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
          box-sizing: border-box;
          box-shadow: none;
          white-space: nowrap;
        }

        .zs-custom-select-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1 1 auto;
          text-align: left;
          font-size: 12.5px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .zs-custom-select-trigger * {
          pointer-events: none;
        }

        .zs-custom-select-trigger:hover {
          background-color: #27272a;
          border-color: rgba(255, 255, 255, 0.22);
        }

        .zs-custom-select[data-open="true"] .zs-custom-select-trigger {
          border-color: var(--zen-primary-color, #6366f1);
        }

        .zs-custom-select-arrow {
          width: 14px !important;
          height: 14px !important;
          min-width: 14px !important;
          min-height: 14px !important;
          max-width: 14px !important;
          max-height: 14px !important;
          color: rgba(255, 255, 255, 0.65);
          transition: transform 0.18s ease;
          flex-shrink: 0;
          display: block;
        }

        .zs-custom-select[data-open="true"] .zs-custom-select-arrow {
          transform: rotate(180deg);
        }

        .zs-custom-select-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 100%;
          width: max-content;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.65);
          padding: 4px;
          z-index: 1000;
          display: none;
          flex-direction: column;
          gap: 2px;
          animation: zsTabFadeIn 0.12s ease-out;
        }

        .zs-custom-select[data-open="true"] .zs-custom-select-menu {
          display: flex;
        }

        .zs-custom-select-option {
          padding: 6px 10px;
          font-size: 12.5px;
          font-weight: 500;
          color: #e4e4e7;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.1s ease, color 0.1s ease;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .zs-custom-select-option:hover {
          background: #27272a;
          color: #ffffff;
        }

        .zs-custom-select-option[data-selected="true"] {
          background: color-mix(in srgb, var(--zen-primary-color, #6366f1) 18%, rgba(255, 255, 255, 0.05));
          color: color-mix(in srgb, var(--zen-primary-color, #6366f1) 85%, #ffffff);
          font-weight: 600;
        }

        .zs-cat-icon {
          width: 14px !important;
          height: 14px !important;
          min-width: 14px !important;
          min-height: 14px !important;
          color: rgba(255, 255, 255, 0.7);
          flex-shrink: 0;
          display: block;
        }

        .zs-custom-select-option:hover .zs-cat-icon,
        .zs-custom-select-option[data-selected="true"] .zs-cat-icon {
          color: currentColor;
        }

        #zs-tg-content {
          overflow: visible;
        }

        #zs-tg-indicator-type-row {
          overflow: visible;
          min-height: 30px;
          max-height: 48px;
          opacity: 1;
          transform: translateY(0);
          transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                      min-height 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.20s ease,
                      margin 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                      padding 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #zs-tg-indicator-type-row[data-hidden="true"] {
          min-height: 0 !important;
          height: 0 !important;
          max-height: 0 !important;
          opacity: 0 !important;
          overflow: hidden !important;
          margin-top: -14px !important;
          margin-bottom: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          transform: translateY(-6px) !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        .zs-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
          pointer-events: auto;
        }

        .zs-switch input {
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: auto;
        }

        .zs-slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: #3f3f46;
          transition: background-color 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
          border-radius: 9999px;
        }

        .zs-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: #ffffff;
          transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .zs-switch input:checked + .zs-slider {
          background-color: var(--zen-primary-color, #6366f1);
        }

        .zs-switch input:checked + .zs-slider:before {
          transform: translateX(16px);
        }

        .zs-switch input:disabled + .zs-slider {
          opacity: 0.55 !important;
          cursor: not-allowed !important;
        }

        .zs-modules-subgroup {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 10px;
          margin-top: -4px;
          margin-bottom: 2px;
          transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .zs-modules-subgroup[data-hidden="true"] {
          display: none !important;
        }

        .zs-section-disabled {
          opacity: 0.45 !important;
          pointer-events: none !important;
        }

        .zs-text-input {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          width: 100%;
          height: 36px;
          min-height: 36px;
          max-height: 36px;
          background: #141417;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #f4f4f5;
          font-family: inherit;
          font-size: 13px;
          padding: 0 12px;
          box-sizing: border-box;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        .zs-textarea-input {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          width: 100%;
          background: #141417;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #f4f4f5;
          font-family: inherit;
          font-size: 13px;
          padding: 8px 12px;
          box-sizing: border-box;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          resize: vertical;
          min-height: 76px;
        }

        .zs-text-input:focus,
        .zs-textarea-input:focus {
          background: #18181b;
          border-color: var(--zen-primary-color, #6366f1);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--zen-primary-color, #6366f1) 25%, transparent);
        }

        .zs-text-input::placeholder,
        .zs-textarea-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .zs-reset-btn {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          align-self: flex-start;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #d4d4d8;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          margin-top: auto;
        }

        .zs-reset-btn:hover {
          background: #27272a;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .zs-reset-btn:active {
          transform: scale(0.98);
        }

        .zs-footer {
          padding: 16px 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #13131a;
          flex-shrink: 0;
        }

        .zs-btn-cancel {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          background: transparent;
          border: none;
          color: #a1a1aa;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .zs-btn-cancel:hover {
          background: #27272a;
          color: #ffffff;
        }

        .zs-btn-cancel:active {
          transform: scale(0.98);
        }

        .zs-btn-save {
          -moz-appearance: none;
          appearance: none;
          outline: none;
          background: var(--zen-primary-color, #6366f1);
          border: none;
          color: #ffffff;
          padding: 8px 22px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: none;
          transition: filter 0.15s ease, transform 0.15s ease;
        }

        .zs-btn-save:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: none;
        }

        .zs-btn-save:active {
          transform: scale(0.98);
        }
      `;
      try {
        const style = document.createElement("style");
        style.id = "zentral-settings-styles";
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      } catch (e) {
        console.error("[Zentral] Error injecting settings styles:", e);
      }
    }

    /**
     * Configures a custom dropdown select component with glitch-free option selection.
     * @param {string} dropdownId - Element ID of .zs-custom-select
     * @param {string} hiddenInputId - Element ID of associated hidden input
     * @param {Function} [onSelectCallback] - Optional callback when value changes
     */
    setupCustomSelect(dropdownId, hiddenInputId, onSelectCallback) {
      if (!this.modal) return;
      const dropdown = this.modal.querySelector("#" + dropdownId);
      const hiddenInput = this.modal.querySelector("#" + hiddenInputId);
      if (!dropdown || !hiddenInput) return;

      const trigger = dropdown.querySelector(".zs-custom-select-trigger");
      const label = dropdown.querySelector(".zs-custom-select-label");
      const options = dropdown.querySelectorAll(".zs-custom-select-option");

      const syncUI = (val) => {
        hiddenInput.value = val;
        options.forEach(opt => {
          const isSelected = opt.dataset.value === val;
          opt.setAttribute("data-selected", isSelected ? "true" : "false");
          if (isSelected && label) {
            label.innerHTML = opt.innerHTML;
          }
        });
      };

      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = dropdown.getAttribute("data-open") === "true";
          this.modal.querySelectorAll(".zs-custom-select").forEach(d => {
            if (d !== dropdown) d.removeAttribute("data-open");
          });
          if (isOpen) {
            dropdown.removeAttribute("data-open");
          } else {
            dropdown.setAttribute("data-open", "true");
          }
        });
      }

      options.forEach(opt => {
        opt.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const val = opt.dataset.value;
          syncUI(val);
          dropdown.removeAttribute("data-open");
          if (typeof onSelectCallback === "function") {
            onSelectCallback(val);
          }
        });
      });

      dropdown.syncValue = syncUI;
    }

    createModal() {
      this.injectStyles();
      this.modal = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      this.modal.id = "zentral-settings-modal";
      this.modal.setAttribute("data-open", "true");
      
      const content = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      content.className = "zs-dialog";
      
      // Generate 60 matrix cells (6 rows x 10 cols)
      let matrixCellsHtml = "";
      for (let r = 1; r <= 6; r++) {
        for (let c = 1; c <= 10; c++) {
          matrixCellsHtml += `<div class="zs-matrix-cell" data-row="${r}" data-col="${c}" title="Row ${r}, Col ${c}"></div>`;
        }
      }

      const htmlStr = `
        <div class="zs-header">
          <div class="zs-title-group">
            <h2 class="zs-title">Zentral Settings</h2>
            <span class="zs-version-badge">v0.1.6</span>
          </div>
          <button id="zs-close" class="zs-close-btn" title="Close Settings">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>

        <div class="zs-tab-bar">
          <button type="button" class="zs-tab-btn" data-tab="settings" data-active="true">Settings</button>
          <button type="button" class="zs-tab-btn" data-tab="diagnostics" data-active="false">Diagnostics</button>
        </div>

        <div class="zs-body">
          <!-- Tab Panel 1: Settings (2-Column Open Layout with Vertical Separator) -->
          <div class="zs-tab-panel" id="zs-panel-settings" data-tab="settings" data-active="true">
            <div class="zs-columns">
              <!-- Column 1: Apps -->
              <div class="zs-col" id="zs-ag-col" data-placement="sidebar">
                <div class="zs-section-header">
                  <h3 class="zs-section-title">Apps</h3>
                  <div class="zs-header-toggle">
                    <span id="zs-ag-status" class="zs-toggle-status" data-enabled="true">Enabled</span>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-ag-enabled" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="zs-section-content" id="zs-ag-content">
                  <!-- Apps Placement -->
                  <div class="zs-placement-group">
                    <div class="zs-label-container">
                      <span class="zs-label">Apps Placement</span>
                      <span class="zs-sublabel">Choose where the Apps will be located across the interface</span>
                    </div>
                    <input type="hidden" id="zs-ag-placement" value="sidebar" />
                    <div class="zs-placement-cards">
                      <button type="button" class="zs-placement-btn" id="zs-placement-sidebar" data-placement="sidebar" data-active="true" title="Dock Apps Box inside Zen Sidebar">
                        <div class="zs-placement-svg-box">
                          <div class="zs-placement-sidebar-container">
                            <div class="zs-placement-appbox-indicator"></div>
                            <div class="zs-placement-sidebar-body"></div>
                          </div>
                          <div class="zs-placement-content-preview"></div>
                        </div>
                        <span class="zs-placement-label">Sidebar</span>
                      </button>

                      <button type="button" class="zs-placement-btn" id="zs-placement-strip" data-placement="vertical-bar" data-active="false" title="Dock Apps Bar as dedicated strip on opposite edge">
                        <div class="zs-placement-svg-box">
                          <div class="zs-placement-content-preview"></div>
                          <div class="zs-placement-bar-indicator" style="width: 10px; height: 100%;"></div>
                        </div>
                        <span class="zs-placement-label">Apps Bar</span>
                      </button>
                    </div>
                  </div>

                  <!-- 10x6 Selection Matrix (Apps Box) -->
                  <div class="zs-matrix-wrapper" id="zs-matrix-wrapper">
                    <div class="zs-matrix-header">
                      <div class="zs-label-container">
                        <span class="zs-matrix-title">Apps Box</span>
                        <span class="zs-sublabel">Choose how many Apps per row and visible rows</span>
                      </div>
                      <div class="zs-matrix-readout">
                        <span id="zs-matrix-dims">7 Columns × 3 Rows</span>
                        <span id="zs-matrix-total-badge" class="zs-matrix-badge">21 Visible Apps</span>
                      </div>
                    </div>
                    <input type="hidden" id="zs-apps-row" value="7" />
                    <input type="hidden" id="zs-max-rows" value="3" />
                    <div class="zs-matrix-grid" id="zs-matrix-grid">
                      ${matrixCellsHtml}
                    </div>
                  </div>

                  <!-- Apps Number Cap -->
                  <div class="zs-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Apps Number Cap</span>
                      <span class="zs-sublabel">Maximum number of apps you can pin</span>
                    </div>
                    <div class="zs-h-stepper">
                      <button type="button" class="zs-h-btn zs-h-dec" data-target="zs-max-apps" data-step="-1">−</button>
                      <input type="number" id="zs-max-apps" class="zs-h-val" min="1" max="100" step="1" />
                      <button type="button" class="zs-h-btn zs-h-inc" data-target="zs-max-apps" data-step="1">+</button>
                    </div>
                  </div>

                  <!-- Panel Animation (Glitch-Free Custom Dropdown) -->
                  <div class="zs-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Panel Animation</span>
                      <span class="zs-sublabel">Opening/closing apps panel easing</span>
                    </div>
                    <div class="zs-custom-select" id="zs-anim-type-dropdown" data-value="slide">
                      <button type="button" class="zs-custom-select-trigger" id="zs-anim-type-trigger">
                        <span class="zs-custom-select-label">Smooth Slide</span>
                        <svg class="zs-custom-select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      <div class="zs-custom-select-menu" id="zs-anim-type-menu">
                        <div class="zs-custom-select-option" data-value="slide">Smooth Slide</div>
                        <div class="zs-custom-select-option" data-value="spring-snappy">Snappy Spring</div>
                        <div class="zs-custom-select-option" data-value="spring-gentle">Gentle Spring</div>
                        <div class="zs-custom-select-option" data-value="spring-bouncy">Bouncy Spring</div>
                        <div class="zs-custom-select-option" data-value="elastic">Elastic</div>
                        <div class="zs-custom-select-option" data-value="none">Instant</div>
                      </div>
                      <input type="hidden" id="zs-anim-type" value="slide" />
                    </div>
                  </div>

                  <!-- Animation Speed -->
                  <div class="zs-stacked-slider">
                    <div class="zs-stacked-slider-header">
                      <div class="zs-label-container">
                        <span class="zs-label">Animation Speed</span>
                        <span class="zs-sublabel">Adjust panel animation duration</span>
                      </div>
                      <span id="zs-anim-speed-badge" class="zs-mono-badge">450 ms</span>
                    </div>
                    <input type="range" id="zs-anim-speed-slider" class="zs-range-slider" min="0" max="2000" step="25" />
                    <input type="hidden" id="zs-anim-speed" value="450" />
                  </div>

                  <!-- Animation Preview Demo -->
                  <div class="zs-anim-preview-group">
                    <div class="zs-label-container">
                      <span class="zs-label">Animation Preview</span>
                      <span class="zs-sublabel">Hover or click below to test opening/closing speed and easing curve</span>
                    </div>
                    <div class="zs-anim-preview-box" id="zs-anim-preview-box">
                      <div class="zs-anim-preview-sidebar">
                        <div class="zs-anim-preview-dot"></div>
                        <div class="zs-anim-preview-dot"></div>
                        <div class="zs-anim-preview-dot"></div>
                      </div>
                      <div class="zs-anim-preview-panel" id="zs-anim-preview-panel">
                        <div class="zs-anim-preview-pill"></div>
                        <div class="zs-anim-preview-line" style="width: 85%;"></div>
                        <div class="zs-anim-preview-line" style="width: 65%;"></div>
                        <div class="zs-anim-preview-line" style="width: 75%;"></div>
                      </div>
                      <span class="zs-anim-preview-hint">Hover or click to preview</span>
                    </div>
                  </div>

                  <button id="zs-ag-reset" class="zs-reset-btn">Reset Apps Defaults</button>
                </div>
              </div>

              <!-- Column 2: Tab Groups -->
              <div class="zs-col" id="zs-tg-col">
                <div class="zs-section-header">
                  <h3 class="zs-section-title">Tab Groups</h3>
                  <div class="zs-header-toggle">
                    <span id="zs-tg-status" class="zs-toggle-status" data-enabled="true">Enabled</span>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-tg-enabled" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="zs-section-content" id="zs-tg-content">
                  <div class="zs-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Close Groups at Startup</span>
                      <span class="zs-sublabel">Automatically fold groups when launching</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-tg-collapse" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <div class="zs-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Group Thumbnails</span>
                      <span class="zs-sublabel">Interactive thumbnails on hover</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-tg-thumbnails" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <div class="zs-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Group Indicator</span>
                      <span class="zs-sublabel">Show open/close indicator next to name</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-tg-chevron" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <div class="zs-row" id="zs-tg-indicator-type-row">
                    <div class="zs-label-container">
                      <span class="zs-label">Indicator Type</span>
                      <span class="zs-sublabel">Choose the style of the indicator</span>
                    </div>
                    <div class="zs-custom-select" id="zs-tg-indicator-type-dropdown" data-value="circle">
                      <button type="button" class="zs-custom-select-trigger" id="zs-tg-indicator-type-trigger">
                        <span class="zs-custom-select-label">Circle</span>
                        <svg class="zs-custom-select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      <div class="zs-custom-select-menu" id="zs-tg-indicator-type-menu">
                        <div class="zs-custom-select-option" data-value="circle">Circle</div>
                        <div class="zs-custom-select-option" data-value="chevron">Chevron</div>
                      </div>
                      <input type="hidden" id="zs-tg-indicator-type" value="circle" />
                    </div>
                  </div>

                  <div class="zs-stacked-slider">
                    <div class="zs-stacked-slider-header">
                      <div class="zs-label-container">
                        <span class="zs-label">Group Labels Opacity</span>
                        <span class="zs-sublabel">Adjust label pill transparency</span>
                      </div>
                      <span id="zs-tg-opacity-badge" class="zs-mono-badge">85%</span>
                    </div>
                    <input type="range" id="zs-tg-opacity" class="zs-range-slider" min="10" max="100" step="5" />
                  </div>

                  <button id="zs-tg-reset" class="zs-reset-btn">Reset Tab Groups Defaults</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab Panel 2: Diagnostics -->
          <div class="zs-tab-panel" id="zs-panel-diagnostics" data-tab="diagnostics" data-active="false">
            <div class="zs-section-header">
              <h3 class="zs-section-title">Diagnostic Logging</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 14px;">
              <div class="zs-row">
                <div class="zs-label-container">
                  <span class="zs-label">Enable Diagnostic Logging</span>
                  <span class="zs-sublabel">Starts Zentral Logger in the background to capture internal layout events</span>
                </div>
                <label class="zs-switch">
                  <input type="checkbox" id="zs-pref-logger-enabled" />
                  <span class="zs-slider"></span>
                </label>
              </div>

              <!-- Options Sub-Section (Controlled by master toggle) -->
              <div id="zs-logger-options-section" style="display: flex; flex-direction: column; gap: 16px; transition: opacity 0.2s ease;">
                
                <!-- Full Log Toggle -->
                <div class="zs-row">
                  <div class="zs-label-container">
                    <span class="zs-label">Capture Full Diagnostic Log</span>
                    <span class="zs-sublabel">Records all diagnostic modules and events simultaneously</span>
                  </div>
                  <label class="zs-switch">
                    <input type="checkbox" id="zs-pref-logger-full" />
                    <span class="zs-slider"></span>
                  </label>
                </div>

                <!-- Modular Selections Container (Revealed when Full Log is unchecked) -->
                <div id="zs-logger-modules-container" class="zs-modules-subgroup" data-hidden="true">
                  <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.45); margin-bottom: 2px;">
                    Active Log Modules
                  </div>

                  <!-- 1. Core & Gecko Errors (Always On, Disabled) -->
                  <div class="zs-row" style="padding: 2px 0;">
                    <div class="zs-label-container">
                      <span class="zs-label" style="font-size: 13px;">Core Engine & Gecko Errors</span>
                      <span class="zs-sublabel" style="font-size: 11.5px;">Uncaught script exceptions and Gecko console errors (Always Active)</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-pref-logger-core" checked disabled />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <!-- 2. Tab Groups & Drag-and-Drop -->
                  <div class="zs-row" style="padding: 2px 0;">
                    <div class="zs-label-container">
                      <span class="zs-label" style="font-size: 13px;">Tab Groups & Drag-and-Drop</span>
                      <span class="zs-sublabel" style="font-size: 11.5px;">Tab groups lifecycle, split view actions, and drag interactions</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-pref-logger-tabs" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <!-- 3. Apps Sidebar & Panels -->
                  <div class="zs-row" style="padding: 2px 0;">
                    <div class="zs-label-container">
                      <span class="zs-label" style="font-size: 13px;">Apps Sidebar & Panels</span>
                      <span class="zs-sublabel" style="font-size: 11.5px;">Apps grid DOM modifications and panel open/pin events</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-pref-logger-apps" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <!-- 4. Context Menus & Popups -->
                  <div class="zs-row" style="padding: 2px 0;">
                    <div class="zs-label-container">
                      <span class="zs-label" style="font-size: 13px;">Context Menus & Popups</span>
                      <span class="zs-sublabel" style="font-size: 11.5px;">Right-click coordinates, popup showing/shown events, and menu item commands</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-pref-logger-menus" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>

                  <!-- 5. Layout Inspector Snapshot -->
                  <div class="zs-row" style="padding: 2px 0;">
                    <div class="zs-label-container">
                      <span class="zs-label" style="font-size: 13px;">Layout Inspector & CSS Snapshot</span>
                      <span class="zs-sublabel" style="font-size: 11.5px;">Computed styles, CSS variables, and element bounding boxes dump</span>
                    </div>
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-pref-logger-layout" />
                      <span class="zs-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="zs-row">
                  <div class="zs-label-container">
                    <span class="zs-label">Export Log Path</span>
                    <span class="zs-sublabel" id="zs-pref-logger-path-desc">Directory where diagnostic logs are saved</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; max-width: 55%;">
                    <input type="hidden" id="zs-pref-logger-path" />
                    <button type="button" id="zs-btn-choose-path" class="zs-reset-btn" style="margin: 0; padding: 6px 12px; font-size: 12px; background: #18181b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: inherit; max-width: 240px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Click to choose export directory">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                      <span id="zs-btn-choose-path-label">Default Folder</span>
                    </button>
                    <button type="button" id="zs-btn-clear-path" title="Reset to default folder (chrome/logs)" style="background: #18181b; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); cursor: pointer; padding: 6px 10px; display: none; align-items: center; justify-content: center; font-size: 11px; border-radius: 6px;">✕</button>
                  </div>
                </div>

                <div class="zs-row">
                  <div class="zs-label-container">
                    <span class="zs-label">Capture Log</span>
                    <span class="zs-sublabel">Generate and save a diagnostic log file instantly. (Shortcut: <kbd style="background: #27272a; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; padding: 1px 5px; font-size: 11px;">Alt</kbd>+<kbd style="background: #27272a; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; padding: 1px 5px; font-size: 11px;">L</kbd>)</span>
                  </div>
                  <button id="zs-btn-capture-log" class="zs-btn-save" style="margin: 0; padding: 6px 18px; font-size: 12.5px;">Export</button>
                </div>
              </div>

              <!-- Report an Issue Section -->
              <div class="zs-section-header" style="margin-top: 20px;">
                <h3 class="zs-section-title">Report an Issue</h3>
              </div>
              <div id="zs-issue-report-card" class="zs-card" style="display: flex; flex-direction: column; gap: 14px; margin-top: 4px; padding: 16px; background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
                
                <!-- Title & Category Row -->
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    <label class="zs-label" for="zs-report-title" style="font-size: 12.5px;">Issue Title</label>
                    <input type="text" id="zs-report-title" class="zs-text-input" placeholder="Brief summary of the issue..." style="width: 100%;" />
                  </div>
                  <div style="width: 260px; min-width: 240px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
                    <label class="zs-label" style="font-size: 12.5px;">Category</label>
                    <div class="zs-custom-select" id="zs-report-category-dropdown" data-name="report-category" style="width: 100%;">
                      <button type="button" class="zs-custom-select-trigger" aria-haspopup="listbox" aria-expanded="false" style="width: 100%;">
                        <span class="zs-custom-select-label">
                          <svg class="zs-cat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                          <span>Bug / Malfunction</span>
                        </span>
                        <svg class="zs-custom-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; min-width: 14px; min-height: 14px; flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                      <div class="zs-custom-select-menu" role="listbox">
                        <div class="zs-custom-select-option" role="option" data-value="bug" data-selected="true">
                          <svg class="zs-cat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                          <span>Bug / Malfunction</span>
                        </div>
                        <div class="zs-custom-select-option" role="option" data-value="layout">
                          <svg class="zs-cat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                          <span>Layout / Visual Alignment</span>
                        </div>
                        <div class="zs-custom-select-option" role="option" data-value="performance">
                          <svg class="zs-cat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          <span>Performance / Lag</span>
                        </div>
                        <div class="zs-custom-select-option" role="option" data-value="enhancement">
                          <svg class="zs-cat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                          <span>Feature Request / Feedback</span>
                        </div>
                      </div>
                    </div>
                    <input type="hidden" id="zs-report-category" value="bug" />
                  </div>
                </div>

                <!-- Description Field -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label class="zs-label" for="zs-report-description" style="font-size: 12.5px;">Description & Steps to Reproduce</label>
                  <textarea id="zs-report-description" class="zs-textarea-input" rows="4" placeholder="Describe what happened, expected behavior, and steps to reproduce..." style="width: 100%; resize: vertical; min-height: 80px;"></textarea>
                </div>

                <!-- Attach Log Toggle Row & Submit Action -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 4px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <label class="zs-switch">
                      <input type="checkbox" id="zs-report-attach-log" checked />
                      <span class="zs-slider"></span>
                    </label>
                    <div style="display: flex; flex-direction: column;">
                      <span class="zs-label" style="font-size: 12.5px;">Attach Diagnostic Log</span>
                      <span class="zs-sublabel" style="font-size: 11px;">Includes active modules & layout snapshot</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span id="zs-report-status" style="font-size: 12px; font-weight: 500; display: none;"></span>
                    <button type="button" id="zs-btn-submit-report" class="zs-btn-save" style="margin: 0; padding: 7px 20px; font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      <span>Submit Report</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div class="zs-footer">
          <button id="zs-cancel" class="zs-btn-cancel">Cancel</button>
          <button id="zs-save" class="zs-btn-save">Save Changes</button>
        </div>
      `;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, "text/html");
      while (doc.body.firstChild) {
        content.appendChild(doc.body.firstChild);
      }
      
      this.modal.appendChild(content);
      const container = document.getElementById("browser") || document.body || document.documentElement;
      container.appendChild(this.modal);
      
      // Tab Switching Logic
      const tabBtns = this.modal.querySelectorAll(".zs-tab-btn");
      const tabPanels = this.modal.querySelectorAll(".zs-tab-panel");
      tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const targetTab = btn.dataset.tab;
          tabBtns.forEach(b => b.setAttribute("data-active", b === btn ? "true" : "false"));
          tabPanels.forEach(p => p.setAttribute("data-active", p.dataset.tab === targetTab ? "true" : "false"));
        });
      });

      this.modal.querySelector("#zs-close").addEventListener("click", () => this.close());
      this.modal.querySelector("#zs-cancel").addEventListener("click", () => this.close());
      this.modal.querySelector("#zs-save").addEventListener("click", () => this.save());

      // Close open custom selects when clicking anywhere else
      this.modal.addEventListener("click", (e) => {
        if (!e.target.closest(".zs-custom-select")) {
          this.modal.querySelectorAll(".zs-custom-select").forEach(d => d.removeAttribute("data-open"));
        }
      });

      // Header Enable/Disable toggle sync (only disables section content, never lock out the toggle itself)
      const agToggle = this.modal.querySelector("#zs-ag-enabled");
      const agStatus = this.modal.querySelector("#zs-ag-status");
      const agContent = this.modal.querySelector("#zs-ag-content");
      if (agToggle) {
        agToggle.addEventListener("change", () => {
          const isEnabled = agToggle.checked;
          if (agStatus) {
            agStatus.textContent = isEnabled ? "Enabled" : "Disabled";
            agStatus.setAttribute("data-enabled", isEnabled ? "true" : "false");
          }
          if (agContent) agContent.setAttribute("data-disabled", !isEnabled ? "true" : "false");
        });
      }

      const tgToggle = this.modal.querySelector("#zs-tg-enabled");
      const tgStatus = this.modal.querySelector("#zs-tg-status");
      const tgContent = this.modal.querySelector("#zs-tg-content");
      if (tgToggle) {
        tgToggle.addEventListener("change", () => {
          const isEnabled = tgToggle.checked;
          if (tgStatus) {
            tgStatus.textContent = isEnabled ? "Enabled" : "Disabled";
            tgStatus.setAttribute("data-enabled", isEnabled ? "true" : "false");
          }
          if (tgContent) tgContent.setAttribute("data-disabled", !isEnabled ? "true" : "false");
        });
      }

      // Placement Visual Cards selection + Conditional matrix smooth slide visibility + Scrollable Apps Column
      const placementBtns = this.modal.querySelectorAll(".zs-placement-btn");
      const placementInput = this.modal.querySelector("#zs-ag-placement");
      const matrixWrapper = this.modal.querySelector("#zs-matrix-wrapper");
      const agCol = this.modal.querySelector("#zs-ag-col");

      placementBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const placement = btn.dataset.placement;
          if (placementInput) placementInput.value = placement;
          placementBtns.forEach(b => b.setAttribute("data-active", b === btn ? "true" : "false"));
          if (agCol) agCol.setAttribute("data-placement", placement);
          if (matrixWrapper) {
            if (placement === "sidebar") {
              matrixWrapper.removeAttribute("data-hidden");
            } else {
              matrixWrapper.setAttribute("data-hidden", "true");
              if (agCol) agCol.scrollTop = 0;
            }
          }
        });
      });

      // Horizontal Stepper (+ / -)
      this.modal.querySelectorAll(".zs-h-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const targetId = btn.dataset.target;
          const step = parseInt(btn.dataset.step, 10) || 1;
          const input = this.modal.querySelector("#" + targetId);
          if (input) {
            const min = input.min !== "" ? parseInt(input.min, 10) : 1;
            const max = input.max !== "" ? parseInt(input.max, 10) : 100;
            let current = parseInt(input.value, 10);
            if (isNaN(current)) current = 21;
            let nextVal = current + step;
            if (nextVal < min) nextVal = min;
            if (nextVal > max) nextVal = max;
            input.value = nextVal;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });

      // 10x6 Selection Matrix Mouse Handlers
      let isDraggingMatrix = false;
      const matrixGrid = this.modal.querySelector("#zs-matrix-grid");
      const matrixCells = this.modal.querySelectorAll(".zs-matrix-cell");

      matrixCells.forEach(cell => {
        cell.addEventListener("mousedown", (e) => {
          e.preventDefault();
          isDraggingMatrix = true;
          const c = parseInt(cell.dataset.col, 10);
          const r = parseInt(cell.dataset.row, 10);
          this.updateMatrixUI(c, r);
        });

        cell.addEventListener("mouseenter", () => {
          const c = parseInt(cell.dataset.col, 10);
          const r = parseInt(cell.dataset.row, 10);
          if (isDraggingMatrix) {
            this.updateMatrixUI(c, r);
          } else {
            matrixCells.forEach(other => {
              const oc = parseInt(other.dataset.col, 10);
              const or = parseInt(other.dataset.row, 10);
              other.setAttribute("data-hover", (oc <= c && or <= r) ? "true" : "false");
            });
          }
        });
      });

      if (matrixGrid) {
        matrixGrid.addEventListener("mouseleave", () => {
          matrixCells.forEach(c => c.removeAttribute("data-hover"));
        });
      }

      window.addEventListener("mouseup", () => {
        if (isDraggingMatrix) isDraggingMatrix = false;
      });

      // Animation Type and Speed Sync + Preview Demo
      const animSpeedSlider = this.modal.querySelector("#zs-anim-speed-slider");
      const animSpeedInput = this.modal.querySelector("#zs-anim-speed");
      const animSpeedBadge = this.modal.querySelector("#zs-anim-speed-badge");
      const animPreviewBox = this.modal.querySelector("#zs-anim-preview-box");
      const animTypeDropdown = this.modal.querySelector("#zs-anim-type-dropdown");

      let previewPulseTimeout = null;
      if (animPreviewBox) {
        animPreviewBox.addEventListener("click", () => {
          animPreviewBox.setAttribute("data-preview-active", "true");
          if (previewPulseTimeout) clearTimeout(previewPulseTimeout);
          const speed = parseInt(animSpeedInput ? animSpeedInput.value : "450", 10) || 450;
          previewPulseTimeout = setTimeout(() => {
            if (animPreviewBox) animPreviewBox.removeAttribute("data-preview-active");
          }, Math.max(speed + 500, 1000));
        });
      }

      const onAnimChange = (typeVal) => {
        const hiddenInput = this.modal.querySelector("#zs-anim-type");
        const type = typeVal || (hiddenInput ? hiddenInput.value : "slide");
        let speed = parseInt(animSpeedInput ? animSpeedInput.value : "450", 10);
        if (isNaN(speed)) speed = 0;

        if (speed <= 0 && type !== "none") {
          if (animTypeDropdown && animTypeDropdown.syncValue) animTypeDropdown.syncValue("none");
        }
        if (animSpeedBadge) animSpeedBadge.textContent = `${speed} ms`;
        this.updatePreviewDemo(type, speed);
      };

      this.setupCustomSelect("zs-anim-type-dropdown", "zs-anim-type", (selectedType) => {
        if (selectedType === "none") {
          if (animSpeedInput) animSpeedInput.value = 0;
          if (animSpeedSlider) animSpeedSlider.value = 0;
        } else {
          const currentSpeed = parseInt(animSpeedInput ? animSpeedInput.value : "0", 10);
          if (currentSpeed === 0) {
            if (animSpeedInput) animSpeedInput.value = 450;
            if (animSpeedSlider) animSpeedSlider.value = 450;
          }
        }
        onAnimChange(selectedType);
      });

      this.setupCustomSelect("zs-tg-indicator-type-dropdown", "zs-tg-indicator-type");

      if (animSpeedSlider) {
        animSpeedSlider.addEventListener("input", (e) => {
          const val = parseInt(e.target.value, 10) || 0;
          if (animSpeedInput) animSpeedInput.value = val;
          const currentTypeInput = this.modal.querySelector("#zs-anim-type");
          const currentType = currentTypeInput ? currentTypeInput.value : "slide";
          if (val === 0 && animTypeDropdown && animTypeDropdown.syncValue) {
            animTypeDropdown.syncValue("none");
          } else if (val > 0 && currentType === "none" && animTypeDropdown && animTypeDropdown.syncValue) {
            animTypeDropdown.syncValue("slide");
          }
          onAnimChange();
        });
      }

      if (animSpeedInput) {
        animSpeedInput.addEventListener("input", (e) => {
          let val = parseInt(e.target.value, 10);
          if (isNaN(val)) val = 0;
          if (val < 0) val = 0;
          if (val > 2000) val = 2000;
          if (animSpeedSlider) animSpeedSlider.value = val;
          const currentTypeInput = this.modal.querySelector("#zs-anim-type");
          const currentType = currentTypeInput ? currentTypeInput.value : "slide";
          if (val === 0 && animTypeDropdown && animTypeDropdown.syncValue) {
            animTypeDropdown.syncValue("none");
          } else if (val > 0 && currentType === "none" && animTypeDropdown && animTypeDropdown.syncValue) {
            animTypeDropdown.syncValue("slide");
          }
          onAnimChange();
        });
      }

      // Group Indicator toggle -> smoothly slides/shows Indicator Type row
      const chevronToggle = this.modal.querySelector("#zs-tg-chevron");
      const indicatorTypeRow = this.modal.querySelector("#zs-tg-indicator-type-row");
      if (chevronToggle && indicatorTypeRow) {
        chevronToggle.addEventListener("change", () => {
          if (chevronToggle.checked) {
            indicatorTypeRow.removeAttribute("data-hidden");
          } else {
            indicatorTypeRow.setAttribute("data-hidden", "true");
          }
        });
      }

      // Tab Groups Opacity Slider Live Sync
      const opacitySlider = this.modal.querySelector("#zs-tg-opacity");
      const opacityBadge = this.modal.querySelector("#zs-tg-opacity-badge");
      if (opacitySlider) {
        opacitySlider.addEventListener("input", (e) => {
          const val = parseInt(e.target.value, 10) || 85;
          if (opacityBadge) opacityBadge.textContent = `${val}%`;
          document.documentElement.style.setProperty("--zentral-tabgroup-label-opacity", (val / 100).toFixed(2));
          document.documentElement.setAttribute("zentral-label-opacity-below-85", val < 85 ? "true" : "false");
        });
      }

      // Helper to auto-save all diagnostics options immediately on change
      const saveDiagnosticsPrefsImmediately = () => {
        if (loggerMasterToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, loggerMasterToggle.checked);
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_CORE, true);
        }
        if (loggerFullToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_FULL, loggerFullToggle.checked);
        }
        if (tabsToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_TABS, tabsToggle.checked);
        }
        if (appsToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_APPS, appsToggle.checked);
        }
        if (menusToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_MENUS, menusToggle.checked);
        }
        if (layoutToggle) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_LAYOUT, layoutToggle.checked);
        }
        if (pathInput) {
          Core.setPref(Constants.Diagnostics.PREF_LOGGER_PATH, (pathInput.value || "").trim());
        }
      };

      // Diagnostic Logging Master Toggle
      const loggerMasterToggle = this.modal.querySelector("#zs-pref-logger-enabled");
      if (loggerMasterToggle) {
        loggerMasterToggle.addEventListener("change", () => {
          this.updateLoggerUIState();
          saveDiagnosticsPrefsImmediately();
        });
      }

      // Diagnostic Logging Full Log Toggle & Modular Sub-Selections
      const loggerFullToggle = this.modal.querySelector("#zs-pref-logger-full");
      const tabsToggle = this.modal.querySelector("#zs-pref-logger-tabs");
      const appsToggle = this.modal.querySelector("#zs-pref-logger-apps");
      const menusToggle = this.modal.querySelector("#zs-pref-logger-menus");
      const layoutToggle = this.modal.querySelector("#zs-pref-logger-layout");

      if (loggerFullToggle) {
        loggerFullToggle.addEventListener("change", () => {
          if (!loggerFullToggle.checked) {
            // When unchecking Full Log, reveal modules with optional ones unchecked by default
            if (tabsToggle) tabsToggle.checked = false;
            if (appsToggle) appsToggle.checked = false;
            if (menusToggle) menusToggle.checked = false;
            if (layoutToggle) layoutToggle.checked = false;
          }
          this.updateLoggerUIState();
          saveDiagnosticsPrefsImmediately();
        });
      }

      const optionalModuleToggles = [tabsToggle, appsToggle, menusToggle, layoutToggle].filter(Boolean);
      optionalModuleToggles.forEach(toggle => {
        toggle.addEventListener("change", () => {
          const allChecked = optionalModuleToggles.every(t => t.checked);
          if (allChecked && loggerFullToggle) {
            // If all optional modules get individually checked, switch back to Full Log mode
            loggerFullToggle.checked = true;
            this.updateLoggerUIState();
          }
          saveDiagnosticsPrefsImmediately();
        });
      });

      const choosePathBtn = this.modal.querySelector("#zs-btn-choose-path");
      const clearPathBtn = this.modal.querySelector("#zs-btn-clear-path");
      const pathInput = this.modal.querySelector("#zs-pref-logger-path");

      if (choosePathBtn) {
        choosePathBtn.addEventListener("click", async () => {
          const selectedFolder = await this.pickExportFolder();
          if (selectedFolder) {
            pathInput.value = selectedFolder;
            this.updatePathUI(selectedFolder);
            saveDiagnosticsPrefsImmediately();
          }
        });
      }

      if (clearPathBtn) {
        clearPathBtn.addEventListener("click", () => {
          pathInput.value = "";
          this.updatePathUI("");
          saveDiagnosticsPrefsImmediately();
        });
      }

      const captureBtn = this.modal.querySelector("#zs-btn-capture-log");
      if (captureBtn) {
        captureBtn.addEventListener("click", () => {
          saveDiagnosticsPrefsImmediately();
          const loggerToggle = this.modal.querySelector("#zs-pref-logger-enabled");
          const isEnabled = loggerToggle ? loggerToggle.checked : Core.getPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, false);

          if (!isEnabled) {
            captureBtn.textContent = "⚠️ Logging Disabled";
            captureBtn.style.background = "#ef4444";
            captureBtn.style.color = "#ffffff";
            captureBtn.style.pointerEvents = "none";

            try {
              const promptService = Services.prompt || Cc["@mozilla.org/embedcomp/prompt-service;1"]?.getService(Ci.nsIPromptService);
              if (promptService) {
                promptService.alert(
                  window,
                  "Zentral Diagnostics — Inactive",
                  "Diagnostic Logging is currently disabled.\n\nPlease toggle 'Enable Diagnostic Logging' ON above and save changes before exporting logs."
                );
              }
            } catch (_) {}

            setTimeout(() => {
              if (this.modal && captureBtn) {
                captureBtn.textContent = "Export";
                captureBtn.style.background = "var(--zen-primary-color)";
                captureBtn.style.pointerEvents = "auto";
              }
            }, 2500);
            return;
          }

          if (pathInput && pathInput.value) {
            Core.setPref(Constants.Diagnostics.PREF_LOGGER_PATH, pathInput.value.trim());
          }
          window.dispatchEvent(new CustomEvent("ZentralCaptureLog"));

          const originalText = "Export";
          const originalBg = "var(--zen-primary-color)";
          captureBtn.textContent = "✓ Exported!";
          captureBtn.style.background = "#10b981";
          captureBtn.style.color = "#ffffff";
          captureBtn.style.pointerEvents = "none";

          setTimeout(() => {
            if (this.modal && captureBtn) {
              captureBtn.textContent = originalText;
              captureBtn.style.background = originalBg;
              captureBtn.style.pointerEvents = "auto";
            }
          }, 2200);
        });
      }

      // -----------------------------------------------------------------------
      // Issue Report Submission Engine
      // -----------------------------------------------------------------------
      this.setupCustomSelect("zs-report-category-dropdown", "zs-report-category");

      const submitReportBtn = this.modal.querySelector("#zs-btn-submit-report");
      const titleInput = this.modal.querySelector("#zs-report-title");
      const categoryInput = this.modal.querySelector("#zs-report-category");
      const descInput = this.modal.querySelector("#zs-report-description");
      const attachLogCheckbox = this.modal.querySelector("#zs-report-attach-log");
      const statusEl = this.modal.querySelector("#zs-report-status");

      if (submitReportBtn && titleInput && descInput) {
        submitReportBtn.addEventListener("click", async () => {
          saveDiagnosticsPrefsImmediately();
          const title = titleInput.value.trim();
          const desc = descInput.value.trim();
          const category = categoryInput ? categoryInput.value : "bug";
          const attachLogs = attachLogCheckbox ? attachLogCheckbox.checked : true;

          if (!title) {
            titleInput.focus();
            titleInput.style.borderColor = "#ef4444";
            setTimeout(() => { if (titleInput) titleInput.style.borderColor = ""; }, 2000);
            return;
          }
          if (!desc) {
            descInput.focus();
            descInput.style.borderColor = "#ef4444";
            setTimeout(() => { if (descInput) descInput.style.borderColor = ""; }, 2000);
            return;
          }

          // Visual loading state
          submitReportBtn.disabled = true;
          submitReportBtn.style.opacity = "0.7";
          submitReportBtn.style.pointerEvents = "none";
          const origBtnHTML = submitReportBtn.innerHTML;
          submitReportBtn.innerHTML = `<span>Submitting...</span>`;

          if (statusEl) {
            statusEl.style.display = "inline";
            statusEl.style.color = "rgba(255, 255, 255, 0.6)";
            statusEl.textContent = "Connecting to GitHub...";
          }

          // 1. Gather diagnostic logs & system metadata
          let logContent = "";
          if (attachLogs) {
            if (window.ZentralLogger?.generateLogString) {
              logContent = window.ZentralLogger.generateLogString();
            } else if (window.ZentralLogger?.entries) {
              logContent = window.ZentralLogger.entries.join("\n");
            }
          }

          // Safety guard: GitHub limits issue bodies to 65,536 characters.
          // Truncate logs if necessary, preserving the initial snapshot & most recent trace events.
          let sendLogContent = logContent;
          if (sendLogContent && sendLogContent.length > 50000) {
            const head = sendLogContent.slice(0, 12000);
            const tail = sendLogContent.slice(-36000);
            sendLogContent = `${head}\n\n... [Log truncated: Preserved initial system snapshot & most recent events to fit GitHub's 65,536-character limit] ...\n\n${tail}`;
          }

          const systemInfo = {
            zentralVersion: "v0.1.6",
            zenVersion: navigator.userAgent,
            platform: navigator.platform || "Desktop",
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            dpr: window.devicePixelRatio || 1,
            sidebarMode: document.documentElement.getAttribute("zen-sidebar-expanded") === "true" ? "Expanded" : "Compact"
          };

          // 2. Attempt background submission to Cloudflare Worker endpoint if configured
          let endpoint = Core.getPref(Constants.Diagnostics.PREF_REPORT_ENDPOINT)?.trim();
          let submitted = false;

          if (endpoint) {
            try {
              const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title,
                  description: desc,
                  category,
                  systemInfo,
                  logs: sendLogContent
                })
              });

              const result = await resp.json();
              if (resp.ok && result.success) {
                submitted = true;
                if (statusEl) {
                  statusEl.style.display = "inline";
                  statusEl.style.color = "#10b981";
                  statusEl.innerHTML = `<a href="${result.issueUrl}" target="_blank" style="color: #10b981; text-decoration: underline;">✓ Issue #${result.issueNumber} created!</a>`;
                }
                titleInput.value = "";
                descInput.value = "";
              } else {
                console.warn("[Zentral-Report] Worker returned error:", resp.status, result);
              }
            } catch (postErr) {
              console.warn("[Zentral-Report] Worker submission failed, falling back to Web:", postErr);
            }
          }

          // 3. Fallback: If not submitted via worker, open pre-filled GitHub issue in new tab & copy logs to clipboard
          if (!submitted) {
            if (logContent) {
              try {
                const clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]?.getService(Ci.nsIClipboardHelper);
                if (clipboardHelper) {
                  clipboardHelper.copyString(logContent);
                } else if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(logContent);
                }
              } catch (_) {}
            }

            let ghBody = `### 📝 Description\n${desc}\n\n`;
            ghBody += `### 🖥️ Environment\n`;
            ghBody += `- **Zentral Version:** ${systemInfo.zentralVersion}\n`;
            ghBody += `- **Zen Build:** ${systemInfo.zenVersion}\n`;
            ghBody += `- **OS / Platform:** ${systemInfo.platform}\n`;
            ghBody += `- **Window / DPR:** ${systemInfo.windowSize} (DPR: ${systemInfo.dpr})\n\n`;
            if (logContent) {
              ghBody += `*(Diagnostic log copied to your clipboard — paste below if relevant)*\n\n`;
            }

            const ghUrl = `https://github.com/Michele501st/Zentral-Sine/issues/new?title=${encodeURIComponent(`[${category.toUpperCase()}] ${title}`)}&body=${encodeURIComponent(ghBody)}&labels=${encodeURIComponent(category)}`;
            
            if (window.gBrowser?.addTab) {
              window.gBrowser.addTab(ghUrl, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
            } else {
              window.open(ghUrl, "_blank");
            }

            if (statusEl) {
              statusEl.style.display = "inline";
              statusEl.style.color = "#60a5fa";
              statusEl.textContent = logContent ? "✓ Opened in GitHub (Log copied to clipboard!)" : "✓ Opened in GitHub!";
            }
          }

          submitReportBtn.disabled = false;
          submitReportBtn.style.opacity = "1";
          submitReportBtn.style.pointerEvents = "auto";
          submitReportBtn.innerHTML = origBtnHTML;
        });
      }

      this.modal.addEventListener("mousedown", (e) => {
        if (e.target === this.modal) this.close();
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.modal && this.modal.getAttribute("data-open") === "true") {
          this.close();
        }
      });

      this.modal.querySelector("#zs-ag-reset").addEventListener("click", () => {
        const get = (id) => this.modal.querySelector("#" + id);
        get("zs-ag-enabled").checked = true;
        if (agStatus) {
          agStatus.textContent = "Enabled";
          agStatus.setAttribute("data-enabled", "true");
        }
        if (agContent) agContent.removeAttribute("data-disabled");
        
        if (placementInput) placementInput.value = "sidebar";
        placementBtns.forEach(b => b.setAttribute("data-active", b.dataset.placement === "sidebar" ? "true" : "false"));
        if (agCol) agCol.setAttribute("data-placement", "sidebar");
        if (matrixWrapper) matrixWrapper.removeAttribute("data-hidden");
        
        this.updateMatrixUI(7, 3);
        const animDropdown = this.modal.querySelector("#zs-anim-type-dropdown");
        if (animDropdown && animDropdown.syncValue) animDropdown.syncValue("slide");
        else if (get("zs-anim-type")) get("zs-anim-type").value = "slide";

        get("zs-anim-speed").value = 450;
        if (get("zs-anim-speed-slider")) get("zs-anim-speed-slider").value = 450;
        if (get("zs-anim-speed-badge")) get("zs-anim-speed-badge").textContent = "450 ms";
        get("zs-max-apps").value = 21;
        this.updatePreviewDemo("slide", 450);
      });

      this.modal.querySelector("#zs-tg-reset").addEventListener("click", () => {
        const get = (id) => this.modal.querySelector("#" + id);
        get("zs-tg-enabled").checked = true;
        if (tgStatus) {
          tgStatus.textContent = "Enabled";
          tgStatus.setAttribute("data-enabled", "true");
        }
        if (tgContent) tgContent.removeAttribute("data-disabled");
        
        get("zs-tg-collapse").checked = false;
        get("zs-tg-thumbnails").checked = true;
        get("zs-tg-chevron").checked = true;
        if (indicatorTypeRow) indicatorTypeRow.removeAttribute("data-hidden");
        
        const tgDropdown = this.modal.querySelector("#zs-tg-indicator-type-dropdown");
        if (tgDropdown && tgDropdown.syncValue) tgDropdown.syncValue("circle");
        else if (get("zs-tg-indicator-type")) get("zs-tg-indicator-type").value = "circle";

        get("zs-tg-opacity").value = 85;
        if (get("zs-tg-opacity-badge")) get("zs-tg-opacity-badge").textContent = "85%";
        document.documentElement.style.setProperty("--zentral-tabgroup-label-opacity", "0.85");
        document.documentElement.setAttribute("zentral-label-opacity-below-85", "false");
        document.documentElement.setAttribute("zentral-indicator-type", "circle");
      });
      
      this.populate();
    }
  }

  const Apps = new ZentralApps();
  const TabGroups = new ZentralTabGroups();
  const Settings = new ZentralSettings();

  /**
   * 6.1 Global Namespace Definition
   * Exposes Zentral Core modules globally on window.Zentral for extensibility and devtools inspection.
   */
  window.Zentral = {
    Core,
    Apps,
    TabGroups,
    Settings,
    Init: () => {
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[Zentral] Booting Master Script (v0.1.6)...");
      Apps.init();
      TabGroups.init();
      Settings.init();
      window.ZentralSettingsInstance = Settings;
    },
    Destroy: () => {
      if (Core.getPref(Constants.DEBUG_PREF)) console.log("[Zentral] Unloading and destroying Zentral mod...");
      if (Apps.destroy) Apps.destroy();
      if (TabGroups.destroy) TabGroups.destroy();
      if (Settings.destroy) Settings.destroy();
      window.ZentralInitialized = false;
      delete window.Zentral;
    }
  };

  const performUnload = () => {
    try {
      if (window.Zentral && window.Zentral.Destroy) {
        window.Zentral.Destroy();
      }
    } catch(e) {
      console.error("[Zentral] Error during unload destroy:", e);
    }
  };

  // Sine Mod engine dynamically unloads scripts
  if (typeof window.addUnloadListener === "function") {
    window.addUnloadListener(performUnload);
  } else if (typeof UC_API !== "undefined" && UC_API.addUnloadListener) {
    UC_API.addUnloadListener(performUnload);
  }
  // Fallback for full app closure
  window.addEventListener("unload", performUnload, { once: true });

  /**
   * 6.2 Browser Startup Observers
   * Ensures Zentral initializes safely after browser delayed startup completes.
   */
  try {
    if (typeof gBrowserInit !== "undefined" && gBrowserInit.delayedStartupFinished) {
      window.Zentral.Init();
    } else {
      let booted = false;
      const safeBoot = () => {
        if (booted) return;
        booted = true;
        try { 
          window.Zentral.Init(); 
        } catch (err) { console.error("[Zentral] Boot error:", err); }
      };

      if (typeof Services !== "undefined" && Services.obs) {
        Services.obs.addObserver(function observer(subject, topic) {
          if (topic === "browser-delayed-startup-finished" && subject === window) {
            Services.obs.removeObserver(observer, topic);
            safeBoot();
          }
        }, "browser-delayed-startup-finished", false);
      }
    }
  } catch (e) {
    console.error("[Zentral] Startup observer error, forcing immediate Init():", e);
    try { window.Zentral.Init(); } catch (_) {}
  }

})();
