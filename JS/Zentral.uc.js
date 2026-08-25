
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
    console.log("[Zentral] Already initialized, skipping boot sequence.");
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
      PREF_COMPACT_DRAWER_ENABLED: "zen.workspace.apps.sidebar.compact_drawer_enabled",
      PREF_AUTOHIDE: "zen.workspace.apps.sidebar.autohide",
      PREF_PLACEMENT: "zen.workspace.apps.sidebar.placement",
      MIN_WIDTH_PX: 280,
      MAX_WIDTH_RATIO: 0.80,
      DEFAULT_SLIDE_MS: 450,
      DEFAULT_MAX_APPS: 21,
      DEFAULT_APPS_PER_ROW: 7,
      DEFAULT_MAX_ROWS: 3,
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
      PREF_LABEL_OPACITY: "zen.workspace.tabgroups.label_opacity"
    },
    /**
     * 1.3 Diagnostics Preference Keys
     */
    Diagnostics: {
      PREF_LOGGER_ENABLED: "zentral.logger.enabled",
      PREF_LOGGER_PATH: "zentral.logger.path"
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
        [Constants.Apps.PREF_COMPACT_DRAWER_ENABLED]: false,
        [Constants.Apps.PREF_AUTOHIDE]: false,
        [Constants.Apps.PREF_PLACEMENT]: "sidebar",
        [Constants.TabGroups.PREF_COLORS]: "{}",
        [Constants.TabGroups.PREF_STATE]: "{}",
        [Constants.TabGroups.PREF_ENABLED]: true,
        [Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH]: false,
        [Constants.TabGroups.PREF_THUMBNAILS]: true,
        [Constants.TabGroups.PREF_SHOW_CHEVRON]: true,
        [Constants.TabGroups.PREF_LABEL_OPACITY]: 85,
        [Constants.Diagnostics.PREF_LOGGER_ENABLED]: false,
        [Constants.Diagnostics.PREF_LOGGER_PATH]: ""
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
     * @returns {any} The stored or fallback preference value.
     */
    getPref(key) {
      const defaultVal = this.defaultPrefs[key];
      if (!Services.prefs.prefHasUserValue(key)) return defaultVal;
      
      try {
        if (typeof defaultVal === "number") {
          return Number.isInteger(defaultVal) ? Services.prefs.getIntPref(key) : parseFloat(Services.prefs.getStringPref(key));
        }
        if (typeof defaultVal === "string") return Services.prefs.getStringPref(key);
        if (typeof defaultVal === "boolean") return Services.prefs.getBoolPref(key);
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

    /**
     * Safely retrieves a native browser preference without throwing errors on missing prefs.
     * @param {string} key - Native Firefox/Zen preference key.
     * @param {any} fallback - Fallback value if preference key does not exist or fails to read.
     * @returns {any} The preference value or fallback.
     */
    setNativePref(key, value) {
      this.setPref(key, value);
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
  console.log("[ZentralCore] Initialized.");
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
        document.removeEventListener("mousemove", this.onDrag);
        document.removeEventListener("mouseup", this.onStopDrag);

        // 4. Remove injected DOM elements
        const idsToRemove = [
          "zen-apps-sidebar-grid",
          "zen-apps-sidebar-styles",
          "zen-app-panel-root",
          "zen-compact-apps-drawer",
          "zen-compact-apps-trigger",
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
        document.querySelectorAll(".zs-app-panel, .zen-app-floating-panel, #zen-app-panel-root, #zentral-apps-vertical-bar, #zentral-apps-vertical-bar-trigger, #zentral-apps-vertical-bar-footer").forEach(p => p.remove());
        if (this.#state && this.#state.appBrowsers) {
          this.#state.appBrowsers.forEach(b => { if (b && b.remove) b.remove(); });
          this.#state.appBrowsers.clear();
        }

        // 6. Reset DOM references and state
        this.#dom = {
          grid: null,
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
      activeAppId: null,
      isPinned: false,
      isExpanded: false,
      preExpandWidth: null,
      panelWidthPx: 0,
      appBrowsers: new Map(),
      positionRafId: null,
      closeTimerId: null,
      cachedScrollbarWidth: null,
      repositionTimer: null
    };

    /**
     * DOM element references cached for high-performance access
     * @private
     */
    #dom = {
      grid: null,
      verticalBar: null,
      verticalBarTrigger: null,
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
        console.log("[ZentralApps] Apps Grid feature is disabled.");
        return;
      }
      this.injectStyles();
      this.createContainers();
      this.loadApps();
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
          will-change: max-height, padding, background-color;
          transition: max-height 0.28s cubic-bezier(0.25, 1, 0.5, 1), padding 0.28s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.2s ease !important;
        }

        /* Collapsed Strip State: Show 3 dots, hide app tiles */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover) {
          background: transparent;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover) .zen-apps-autohide-dots {
          display: flex;
          opacity: 0.75;
          transform: translate(-50%, -50%) scale(1);
          transition: opacity 0.22s ease 0.06s, transform 0.24s cubic-bezier(0.25, 1, 0.5, 1) 0.06s;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover):hover .zen-apps-autohide-dots {
          opacity: 1;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover) .zen-apps-scroll-box,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover) .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):not([data-revealed="true"]):not(:hover) .zen-app-add-btn {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(-6px) scale(0.96);
          transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Keep Apps Grid expanded while an App Panel is open */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) {
          max-height: calc(var(--zentral-max-rows, 3) * 42px - 2px) !important;
          padding: 4px 10px 0px 10px !important;
          margin: 0 !important;
          overflow-y: auto !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-apps-autohide-dots {
          opacity: 0 !important;
          transform: translate(-50%, -50%) scale(0.5) !important;
          pointer-events: none !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-apps-scroll-box,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"])[zentral-app-panel-open="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal) .zen-app-add-btn {
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translateY(0) scale(1) !important;
        }

        /* Expanded Grid State: Hide 3 dots, reveal app tiles with smooth slide-down */
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"],
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover {
          max-height: calc(var(--zentral-max-rows, 3) * 42px - 2px) !important;
          padding: 4px 10px 0px 10px !important;
          margin: 0 !important;
          overflow-y: auto !important;
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-apps-autohide-dots,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-apps-autohide-dots {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.5);
          pointer-events: none;
          transition: opacity 0.16s ease, transform 0.20s cubic-bezier(0.25, 1, 0.5, 1);
        }
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-apps-scroll-box,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal)[data-revealed="true"] .zen-app-add-btn,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-apps-scroll-box,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-app-tile,
        :root[zentral-apps-autohide="true"]:not([zentral-apps-placement="vertical-bar"]):not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal):hover .zen-app-add-btn {
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translateY(0) scale(1);
          transition: opacity 0.26s cubic-bezier(0.25, 1, 0.5, 1), transform 0.28s cubic-bezier(0.25, 1, 0.5, 1) !important;
        }

        #zen-apps-sidebar-grid { display: grid; grid-template-columns: repeat(var(--zentral-grid-cols, 7), minmax(0, 1fr)); justify-items: center; align-items: center; gap: 6px; padding: 4px 10px 0px 10px; margin: 0; width: 100%; box-sizing: border-box; position: relative; z-index: 10; max-height: calc(var(--zentral-max-rows, 3) * 42px - 2px); overflow-y: auto; scrollbar-width: none; }
        #zen-apps-sidebar-grid::-webkit-scrollbar { display: none; }
        .zen-apps-scroll-box { display: contents; }
        #zen-apps-sidebar-grid.zen-apps-horizontal { display: flex; flex-direction: row; padding: 0 2px; gap: 2px; width: auto; align-items: center; -moz-window-dragging: no; position: relative; flex-shrink: 1 !important; min-width: 0 !important; margin-left: auto !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box { display: flex; flex-direction: row; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; width: max-content; max-width: calc(10 * 38px + 9 * 4px) !important; scroll-behavior: smooth; -moz-window-dragging: no; flex-shrink: 1 !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box::-webkit-scrollbar { display: none; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-app-tile { width: 38px !important; min-width: 38px !important; max-width: 38px !important; height: 28px !important; padding: 0 !important; aspect-ratio: auto; border-radius: var(--toolbarbutton-border-radius, 6px); flex-shrink: 0 !important; }
        .zen-app-tile { position: relative; appearance: none; border: none; width: 100%; height: auto; aspect-ratio: 1 / 1; max-width: 36px; max-height: 36px; border-radius: var(--toolbarbutton-border-radius, 8px); background-color: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease; padding: 0; margin: 0; overflow: visible; -moz-window-dragging: no-drag; pointer-events: auto !important; }
        .zen-app-tile:hover { background-color: var(--toolbarbutton-hover-background, color-mix(in srgb, currentColor 10%, transparent)) !important; }
        .zen-app-tile:active { transform: scale(0.95); }
        .zen-app-tile[data-active="true"] { background-color: var(--toolbarbutton-active-background, color-mix(in srgb, currentColor 15%, transparent)) !important; }
        .zen-app-tile img { width: 18px; height: 18px; object-fit: contain; pointer-events: none; border-radius: 4px; image-rendering: -webkit-optimize-contrast; }
        .zen-app-add-btn { background-color: transparent; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); opacity: 0.7; flex-shrink: 0 !important; }
        .zen-app-add-btn:hover { opacity: 1; border-style: solid; }
        .zen-app-add-btn svg { width: 16px; height: 16px; pointer-events: none; }
        .zen-app-badge { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px; background-color: #ff3b30; color: #ffffff; font-size: 9px; font-weight: 700; line-height: 14px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3); pointer-events: none; z-index: 10; box-sizing: border-box; }
        .zen-app-badge[data-dot="true"] { min-width: 8px; width: 8px; height: 8px; padding: 0; border-radius: 50%; top: 3px; right: 3px; font-size: 0; }

        #zen-app-panel-root { position: fixed; display: none; pointer-events: none; overflow: visible; z-index: 2147483600 !important; }
        #zen-app-panel-root[open] { display: block; }
        #zen-app-panel-root:not([open]) #zen-app-panel-slider, #zen-app-panel-root[closing] #zen-app-panel-slider { box-shadow: none !important; }
        #zen-app-panel-clip { position: absolute; inset: 0; overflow: hidden; border-radius: var(--zen-native-inner-radius, 8px); pointer-events: none; }
        #zen-app-panel-slider { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--tabpanels-background-color, #1e1e24); box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.30); pointer-events: auto; will-change: transform; }
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
          width: 44px !important;
          min-width: 44px !important;
          max-width: 44px !important;
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
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          flex: 0 0 44px !important;
          flex-shrink: 0 !important;
          z-index: 10 !important;
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          border: none !important;
          transform: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          margin-top: 0 !important;
          transition: width 0.22s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease !important;
        }

        /* Mode B: Autohide ENABLED (Compact Floating Panel) */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar {
          position: fixed !important;
          z-index: 2147483500 !important;
          background-color: var(--zen-colors-base, rgb(19, 19, 19)) !important;
          border-radius: var(--zen-native-inner-radius, 10px) !important;
          box-shadow: var(--zen-big-shadow, rgba(0, 0, 0, 0.24) 0px 3px 8px 0px) !important;
          border: 1px solid var(--zen-colors-border, color-mix(in srgb, currentColor 10%, transparent)) !important;
          transition: transform 0.24s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease, visibility 0.24s ease, top 0.18s cubic-bezier(0.25, 1, 0.5, 1) !important;
          will-change: transform, opacity, top;
          overflow: hidden !important;
        }

        /* Zen Theme Wallpaper / Gradient Layer */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -2 !important;
          background-image: var(--zen-theme-gradient-override, var(--zen-theme-gradient, var(--zen-main-browser-background, none))) !important;
          background-size: 100vw 100vh !important;
          background-repeat: no-repeat !important;
          background-position: var(--zen-vb-gradient-pos, left top) !important;
          pointer-events: none !important;
        }

        /* When Vertical Bar is on Left (Sidebar on Right): Sample top-left gradient color */
        :root[zentral-apps-placement="vertical-bar"][zen-right-side="true"] #zentral-apps-vertical-bar::before,
        :root[zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] #zentral-apps-vertical-bar::before {
          background-position: left top !important;
        }

        /* When Vertical Bar is on Right (Sidebar on Left): Sample top-right gradient color */
        :root[zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar::before {
          background-position: right top !important;
        }

        /* Zen Film Grain Texture Layer */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -1 !important;
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
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-right-side="true"] #zentral-apps-vertical-bar:not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]),
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"][zen-sidebar-right="true"] #zentral-apps-vertical-bar:not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) {
          transform: translateX(calc(-100% - 16px)) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        /* Autohide Mode B: Idle/Collapsed State on Right */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"]:not([zen-right-side="true"]):not([zen-sidebar-right="true"]) #zentral-apps-vertical-bar:not([data-revealed="true"]):not(:hover):not([zentral-app-panel-open="true"]) {
          transform: translateX(calc(100% + 16px)) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        /* Autohide Mode B: Revealed State on Hover / Active Panel */
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar[data-revealed="true"],
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar:hover,
        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar[zentral-app-panel-open="true"] {
          transform: translateX(0) !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          visibility: visible !important;
        }

        #zentral-apps-vertical-bar #zen-apps-sidebar-grid {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          width: 100% !important;
          height: 0 !important;
          flex: 1 1 0px !important;
          padding: 0 4px !important;
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
          flex-shrink: 0 !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          box-sizing: border-box !important;
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
          border-radius: var(--toolbarbutton-border-radius, 8px) !important;
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
          border-radius: var(--toolbarbutton-border-radius, 8px) !important;
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

        :root[zentral-apps-autohide="true"][zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-badge {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4), 0 0 0 1.5px var(--zen-colors-base, #131313) !important;
        }

        /* Default / Non-autohide Vertical Bar (Clean standard tile styling) */
        :root:not([zentral-apps-autohide="true"])[zentral-apps-placement="vertical-bar"] #zentral-apps-vertical-bar .zen-app-tile {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
          max-width: 36px !important;
          max-height: 36px !important;
          border-radius: var(--toolbarbutton-border-radius, 8px) !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          flex-shrink: 0 !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          color: inherit !important;
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
          border-radius: var(--toolbarbutton-border-radius, 8px) !important;
          background-color: transparent !important;
          border: 1px dashed color-mix(in srgb, currentColor 30%, transparent) !important;
          opacity: 0.7 !important;
          transform: none !important;
          pointer-events: auto !important;
          visibility: visible !important;
          box-shadow: none !important;
          flex-shrink: 0 !important;
          color: inherit !important;
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
          position: fixed;
          top: 0;
          bottom: 0;
          width: 16px;
          z-index: 2147483550;
          pointer-events: auto;
          background: transparent;
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

        this.#dom.grid.addEventListener("mouseenter", () => {
          if (!this.isPlacementVerticalBar()) {
            this.setAutohideHovered(true);
          }
        });
        this.#dom.grid.addEventListener("mouseleave", () => {
          if (!this.isPlacementVerticalBar()) {
            this.scheduleAutohideCollapse();
          }
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
          if (e.target.closest(".zen-app-tile[data-app-id]")) return;
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

        let vbHovered = false;

        vb.addEventListener("mouseenter", () => {
          if (this.isPlacementVerticalBar()) {
            vbHovered = true;
            this.setAutohideHovered(true);
          }
        });
        vb.addEventListener("mouseleave", (e) => {
          if (this.isPlacementVerticalBar()) {
            vbHovered = false;
            if (!vb.contains(e.relatedTarget)) {
              this.scheduleAutohideCollapse(120);
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
            vbHovered = true;
            this.setAutohideHovered(true);
          }
        });
        trigger.addEventListener("mouseleave", (e) => {
          if (this.isPlacementVerticalBar()) {
            if (e.relatedTarget !== vb && !vb.contains(e.relatedTarget)) {
              vbHovered = false;
              this.scheduleAutohideCollapse(120);
            }
          }
        });
        this.#dom.verticalBarTrigger = trigger;

        window.addEventListener("mousemove", (e) => {
          if (!this.isPlacementVerticalBar() || Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) !== true) return;
          if (this.#state.activeAppId) return; // Keep revealed while panel is open

          const isRight = this.isVerticalBarOnRight();
          const triggerDist = 16;
          const barWidth = 60;

          const isNearEdge = isRight ? (e.clientX >= window.innerWidth - triggerDist) : (e.clientX <= triggerDist);
          const isInsideBar = isRight ? (e.clientX >= window.innerWidth - barWidth) : (e.clientX <= barWidth);

          if (isNearEdge) {
            vbHovered = true;
            this.setAutohideHovered(true);
          } else if (!isInsideBar && vbHovered) {
            vbHovered = false;
            this.scheduleAutohideCollapse(80);
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

      this.createCompactDrawerContainers();
    }

    /**
     * Creates persistent DOM elements and event handlers for the Compact Sidebar Apps Drawer.
     */
    createCompactDrawerContainers() {
      if (document.getElementById("zen-compact-apps-drawer")) return;

      const trigger = document.createElement("div");
      trigger.id = "zen-compact-apps-trigger";

      const drawer = document.createElement("div");
      drawer.id = "zen-compact-apps-drawer";

      const header = document.createElement("div");
      header.id = "zen-compact-apps-header";

      const addBtn = document.createElement("button");
      addBtn.className = "zen-app-tile zen-app-add-btn";
      addBtn.title = "Add App";
      addBtn.appendChild(this.#createSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`));
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeCompactDrawer();
        const tab = gBrowser.selectedTab; if (!tab) return;
        const url = tab.linkedBrowser?.currentURI?.spec || "about:blank";
        const title = tab.label || url;
        const icon = (typeof gBrowser.getIcon === "function" ? gBrowser.getIcon(tab) : null) || tab.getAttribute("image") || tab.image || "";
        if (url !== "about:blank") this.addApp(url, title, icon);
      });
      header.appendChild(addBtn);

      const list = document.createElement("div");
      list.id = "zen-compact-apps-list";

      drawer.appendChild(header);
      drawer.appendChild(list);

      const container = document.body || document.documentElement;
      container.appendChild(trigger);
      container.appendChild(drawer);

      this.#dom.compactTrigger = trigger;
      this.#dom.compactDrawer = drawer;
      this.#dom.compactList = list;

      let openTimer = null;
      let closeTimer = null;

      const cancelTimers = () => {
        if (openTimer) { clearTimeout(openTimer); openTimer = null; }
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      };

      trigger.addEventListener("mouseenter", () => {
        if (!this.isCollapsedSidebar() || Core.getPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED) === false) return;
        cancelTimers();
        openTimer = setTimeout(() => {
          openTimer = null;
          drawer.setAttribute("open", "true");
        }, 120);
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.isCollapsedSidebar() || Core.getPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED) === false) return;
        if (e.clientY > window.innerHeight / 3) return;

        const isRight = this.isSidebarRight();
        const isNearEdge = isRight ? (e.clientX >= window.innerWidth - 18) : (e.clientX <= 18);

        if (isNearEdge && !drawer.hasAttribute("open") && !openTimer) {
          cancelTimers();
          openTimer = setTimeout(() => {
            openTimer = null;
            drawer.setAttribute("open", "true");
          }, 120);
        }
      }, { passive: true });

      trigger.addEventListener("mouseleave", () => {
        if (openTimer) { clearTimeout(openTimer); openTimer = null; }
        closeTimer = setTimeout(() => {
          closeTimer = null;
          if (!drawer.matches(":hover")) drawer.removeAttribute("open");
        }, 300);
      });

      drawer.addEventListener("mouseenter", () => {
        cancelTimers();
      });

      drawer.addEventListener("mouseleave", () => {
        cancelTimers();
        closeTimer = setTimeout(() => {
          closeTimer = null;
          drawer.removeAttribute("open");
        }, 300);
      });

      this.updateAutohideState();
      this.updateCompactDrawerState();
    }

    /**
     * Immediately closes the Compact Sidebar Apps Drawer.
     */
    closeCompactDrawer() {
      if (this.#dom.compactDrawer) {
        this.#dom.compactDrawer.removeAttribute("open");
      }
    }

    /**
     * Updates the enabled/disabled DOM state of the Compact Sidebar Apps Drawer trigger and container.
     */
    updateCompactDrawerState() {
      const enabled = Core.getPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED, false) === true;
      if (this.#dom.compactTrigger) {
        if (enabled) {
          this.#dom.compactTrigger.removeAttribute("disabled");
          this.#dom.compactTrigger.style.display = "";
          this.#dom.compactTrigger.style.pointerEvents = "";
        } else {
          this.#dom.compactTrigger.setAttribute("disabled", "true");
          this.#dom.compactTrigger.style.display = "none";
          this.#dom.compactTrigger.style.pointerEvents = "none";
        }
      }
      if (this.#dom.compactDrawer) {
        if (enabled) {
          this.#dom.compactDrawer.removeAttribute("disabled");
          this.#dom.compactDrawer.style.display = "";
        } else {
          this.#dom.compactDrawer.setAttribute("disabled", "true");
          this.#dom.compactDrawer.removeAttribute("open");
          this.#dom.compactDrawer.style.display = "none";
        }
      }
    }

    /**
     * Renders or updates the app tiles grid using DocumentFragment for maximum DOM performance.
     * Filters apps based on workspace isolation rules (All Spaces vs Current Space).
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
    }

    /**
     * Sets whether the autohide apps grid is currently revealed.
     * @param {boolean} hovered - Whether cursor is over trigger or grid.
     */
    setAutohideHovered(hovered) {
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
     * @param {number} [delay=280] - Delay in milliseconds.
     */
    scheduleAutohideCollapse(delay = 180) {
      if (this.#state.autohideCollapseTimer) clearTimeout(this.#state.autohideCollapseTimer);
      this.#state.autohideCollapseTimer = setTimeout(() => {
        this.#state.autohideCollapseTimer = null;
        if (!this.#state.activeAppId) {
          this.setAutohideHovered(false);
        }
      }, delay);
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
      this.#dom.grid.style.setProperty("--zentral-grid-cols", Core.getPref(Constants.Apps.PREF_APPS_PER_ROW));
      this.#dom.grid.style.setProperty("--zentral-max-rows", Core.getPref(Constants.Apps.PREF_MAX_ROWS));

      const maxApps = Core.getPref(Constants.Apps.PREF_MAX_APPS);
      const activeWorkspaceId = window.gZenWorkspaces?.activeWorkspace;
      const visibleApps = this.#state.apps.filter(app => {
        if (!app.workspaceId || app.workspaceId === "all") return true;
        if (activeWorkspaceId && app.workspaceId === activeWorkspaceId) return true;
        return false;
      });
      const activeApps = visibleApps.slice(0, maxApps);
      let draggedAppId = null;
      const fragment = document.createDocumentFragment();

      this.updateAutohideState();
      this.updateCompactDrawerState();
      this.renderCompactDrawer(activeApps);

      activeApps.forEach((app) => {
        const btn = document.createElement("button");
        btn.id = "zen-app-btn-" + app.id;
        btn.className = "zen-app-tile";
        btn.dataset.appId = app.id;
        btn.dataset.active = (this.#state.activeAppId === app.id) ? "true" : "false";
        btn.title = app.title || "";

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
          const title = tab.label || url;
          const icon = (typeof gBrowser.getIcon === "function" ? gBrowser.getIcon(tab) : null) || tab.getAttribute("image") || tab.image || "";
          if (url !== "about:blank") this.addApp(url, title, icon);
        });

        addBtn.addEventListener("mousedown", (e) => {
          if (e.button === 0) e.stopPropagation();
        });

        if (isVerticalBar) {
          targetContainer.appendChild(addBtn);
          this.updateVerticalBarAddBtnPlacement();
        } else {
          this.#dom.grid.appendChild(addBtn);
        }
      }

      if (this.#dom.scrollBox) {
        if (this.#state.apps.length >= 8) {
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
     * Renders the apps in the compact sidebar hover drawer.
     * @param {Array} activeApps - Array of app configuration objects to render.
     */
    renderCompactDrawer(activeApps) {
      if (!this.#dom.compactList) return;
      this.#dom.compactList.innerHTML = "";
      
      const fragment = document.createDocumentFragment();
      
      activeApps.forEach((app) => {
        const btn = document.createElement("button");
        btn.id = "zen-compact-app-btn-" + app.id;
        btn.className = "zen-app-tile";
        btn.dataset.appId = app.id;
        btn.dataset.active = (this.#state.activeAppId === app.id) ? "true" : "false";
        btn.title = app.title || "";

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

        btn.addEventListener("click", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          
          this.closeCompactDrawer();
          if (this.#state.activeAppId === app.id) {
            this.closePanel();
          } else {
            this.openPanel(app);
          }
        });

        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const popup = document.getElementById("zen-apps-sidebar-tile-context");
          if (popup) { 
            popup.dataset.activeAppId = app.id; 
            popup.openPopupAtScreen(e.screenX, e.screenY, true); 
          }
        });
        
        fragment.appendChild(btn);
      });
      
      this.#dom.compactList.appendChild(fragment);
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
      const newApp = { id, url, title, icon: crispIcon };
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
      console.log("[ZentralApps] openPanel called for app:", app.id, "URL:", app.url);
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
      console.log("[ZentralApps] closePanel called");
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
     * Retrieves existing XUL browser element for an app, or instantiates a new content browser.
     * Listens for title changes to trigger unread badge notifications.
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

      // Performance Optimization: Removed setInterval polling. Rely on DOMTitleChanged
      const titleHandler = (e) => {
        const title = b.contentTitle || "";
        const match = title.match(/^\((\d+)\)/) || title.includes("ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢") || title.match(/^\[(\d+)\]/);
        const hasNotification = !!match;
        
        let notifCount = null;
        if (match && match[1]) {
           notifCount = parseInt(match[1]);
        }
        
        if (app.hasNotification !== hasNotification || app.notificationCount !== notifCount) {
          app.hasNotification = hasNotification;
          app.notificationCount = notifCount;
          
          const updateBadge = (btn) => {
            if (btn) {
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
          };
          updateBadge(document.getElementById("zen-app-btn-" + app.id));
          updateBadge(document.getElementById("zen-compact-app-btn-" + app.id));
        }
      };
      b.addEventListener("pagetitlechanged", titleHandler);
      b.addEventListener("DOMTitleChanged", titleHandler);
      b.addEventListener("load", titleHandler);

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
      if (vbHeight <= 0) return;

      const activeAppsCount = scrollBox ? scrollBox.querySelectorAll(".zen-app-tile:not(.zen-app-add-btn):not(.zen-app-vb-footer-btn)").length : 0;
      const footerBaseHeight = 82; // Eye + Gear buttons + padding
      const itemHeight = 42; // 36px tile + 6px gap
      const requiredHeight = (activeAppsCount + 1) * itemHeight + footerBaseHeight + 16; // 16px padding

      const autohideBtn = footer.querySelector("#zentral-apps-vb-autohide-btn");

      if (requiredHeight > vbHeight) {
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
     * Synchronizes theme background gradient from the native sidebar background (#zen-toolbar-background)
     * to the Vertical Bar in autohide (compact) mode so it matches the Compact Sidebar.
     */
    syncVerticalBarTheme() {
      const vb = this.#dom.verticalBar;
      if (!vb) return;
      
      const isAutohide = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      if (!isAutohide) {
        vb.style.removeProperty("--zen-theme-gradient-override");
        vb.style.removeProperty("--zen-vb-gradient-pos");
        return;
      }

      // 1. Anchoring gradient position to left or right based on Vertical Bar side
      const isVbRight = this.isVerticalBarOnRight();
      vb.style.setProperty("--zen-vb-gradient-pos", isVbRight ? "right top" : "left top");

      // 2. Check if Zen toolbar background exists and capture its computed gradient
      const zenToolbarBg = document.getElementById("zen-toolbar-background") || document.querySelector(".zen-toolbar-background");
      if (zenToolbarBg) {
        const csBefore = window.getComputedStyle(zenToolbarBg, "::before");
        if (csBefore && csBefore.backgroundImage && csBefore.backgroundImage !== "none") {
          vb.style.setProperty("--zen-theme-gradient-override", csBefore.backgroundImage);
          return;
        }
        const cs = window.getComputedStyle(zenToolbarBg);
        if (cs && cs.backgroundImage && cs.backgroundImage !== "none") {
          vb.style.setProperty("--zen-theme-gradient-override", cs.backgroundImage);
          return;
        }
      }
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
      };
      window.addEventListener("TabSelect", this.#tabSelectListener);

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

        // 4. Secure state persistence across restarts: capture full hierarchy and tab assignments
        const ss = this.#getSessionStore();
        const allGroups = Array.from(document.querySelectorAll("tab-group:not([split-view-group])"));
        const stateToSave = {
          groups: {},
          tabMapping: {}
        };

        allGroups.forEach(group => {
          if (!group.id) group.id = "zentral-group-" + Math.random().toString(36).substr(2, 9);
          const parentGroup = group.parentElement?.closest("tab-group:not([split-view-group])");
          const parentId = parentGroup?.id || null;
          const label = group.label || group.getAttribute("label") || "Group";
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color") || "";
          const isCollapsed = group.hasAttribute("collapsed") && group.getAttribute("collapsed") === "true";
          const wsId = group.getAttribute("zen-workspace-id") || "";

          const posContainer = parentGroup || group.parentElement;
          const groupSiblings = posContainer
            ? Array.from(posContainer.children).filter(el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group"))
            : [];
          const index = groupSiblings.indexOf(group);

          stateToSave.groups[group.id] = {
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

          stateToSave.tabMapping[group.id] = directTabs.map(tab => ({
            url: tab.linkedBrowser?.currentURI?.spec || "",
            label: tab.label || "",
            zenTabId: tab.getAttribute("zen-tab-id") || tab.id || ""
          }));

          directTabs.forEach(tab => {
            if (!tab) return;
            tab.setAttribute("data-zentral-group-id", group.id);
            tab.setAttribute("data-zentral-group-label", label);
            if (color) tab.setAttribute("data-zentral-group-color", color);
            tab.setAttribute("data-zentral-group-collapsed", isCollapsed ? "true" : "false");
            if (wsId) tab.setAttribute("data-zentral-group-ws", wsId);
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

        // Persist full state to preferences
        Core.setPref(Constants.TabGroups.PREF_STATE, JSON.stringify(stateToSave));

        // 5. Flatten groups cleanly without leaving gaps in the root strip
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
            group.querySelectorAll('.zentral-chevron, .zentral-group-initials, .ztg-drag-handle, .zentral-close-btn, .zentral-tab-title-wrapper').forEach(el => el.remove());

            const tabs = Array.from(group.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab")).filter(t => t.closest("tab-group") === group);

            // Move tabs directly before the group container
            tabs.forEach(tab => {
              if (group.parentNode) {
                try {
                  group.parentNode.insertBefore(tab, group);
                } catch (_) {
                  try { rootTabContainer.appendChild(tab); } catch (_) {}
                }
              } else if (rootTabContainer) {
                try { rootTabContainer.appendChild(tab); } catch (_) {}
              }
              try { if (typeof gBrowser?.addTabToGroup === "function") gBrowser.addTabToGroup(tab, null); } catch (_) {}
              try { tab.group = null; } catch (_) {}
              try { tab.removeAttribute("group"); tab.removeAttribute("zen-group"); } catch (_) {}
            });

            // Cleanly remove the tab-group element directly
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
      } catch(e) {
        console.error("[Zentral] TabGroups destroy error:", e);
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

        const allTabs = Array.from(gBrowser?.tabs || document.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab"));
        const groupsToReconstruct = new Map();

        // 1. Match tabs to groups using DOM attributes, SessionStore, or URL fallback
        allTabs.forEach(tab => {
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

        // Also add missing parent groups needed for nested structures
        if (savedGroupsMap) {
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
          if (!group) {
            group = document.createXULElement ? document.createXULElement("tab-group") : document.createElement("tab-group");
            group.id = info.id;
            group.setAttribute("label", info.label);
          }
          group.label = info.label;
          if (info.workspaceId) group.setAttribute("zen-workspace-id", info.workspaceId);

          // Guarantee full internal structure exists
          let labelContainer = group.querySelector(".tab-group-label-container");
          if (!labelContainer) {
            labelContainer = document.createElement("div");
            labelContainer.className = "tab-group-label-container";
            const innerLabel = document.createElement("label");
            innerLabel.className = "tab-group-label";
            innerLabel.textContent = info.label || "Group";
            labelContainer.appendChild(innerLabel);
            group.insertBefore(labelContainer, group.firstChild);
          }

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

            // Determine correct insertion parent: nested inside parentGroup or at rootTabContainer
            let parentEl = null;
            if (info.parentId && groupsToReconstruct.has(info.parentId)) {
              const parentGroup = document.getElementById(info.parentId);
              if (parentGroup && !group.contains(parentGroup)) {
                parentEl = parentGroup.querySelector(".tab-group-container") || parentGroup;
              }
            }

            if (!parentEl) {
              parentEl = rootTabContainer;
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
              try {
                if (typeof gBrowser?.addTabToGroup === "function") {
                  gBrowser.addTabToGroup(tab, group);
                } else if (typeof group.addTabs === "function") {
                  group.addTabs([tab]);
                } else {
                  targetTabContainer.appendChild(tab);
                  tab.group = group;
                }
              } catch (_) {
                try {
                  targetTabContainer.appendChild(tab);
                  tab.group = group;
                } catch (_) {}
              }

              // Cleanup temporary attributes
              tab.removeAttribute("data-zentral-group-id");
              tab.removeAttribute("data-zentral-group-label");
              tab.removeAttribute("data-zentral-group-color");
              tab.removeAttribute("data-zentral-group-collapsed");
              tab.removeAttribute("data-zentral-group-ws");
              tab.removeAttribute("data-zentral-parent-id");
            });

            // Restore colors
            if (info.color) {
              group.style.setProperty("--tab-group-color", info.color);
              group.style.setProperty("--tab-group-color-invert", info.color);
              group.style.setProperty("--zentral-custom-color", info.color);
              group.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(info.color));
              group.style.setProperty("--atg-contrast-color", this.getContrastColor(info.color));
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
     * Extracts 2-letter uppercase initials from a tab group name string for collapsed sidebar display.
     * @param {string} name - Tab group title string.
     * @returns {string} Two letter uppercase initials.
     */
    getGroupInitials(name) {
      if (!name) return "";
      const words = name.trim().split(/\s+/);
      if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
      return (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
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
        console.log("[ZentralTabGroups] Tab Groups feature is disabled.");
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
          padding: 6px 10px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          max-width: 320px !important;
        }
        #tab-label-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid color-mix(in srgb, currentColor 40%, transparent) !important;
          border-radius: 6px !important;
          color: var(--zentral-tabgroup-contrast-color, var(--atg-contrast-color, #ffffff)) !important;
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

        .ztg-cp-box {
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

        .ztg-btn {
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

        .ztg-btn:hover {
          background: color-mix(in srgb, currentColor 14%, transparent) !important;
          border-color: color-mix(in srgb, currentColor 22%, transparent) !important;
        }

        .ztg-btn:active {
          transform: scale(0.97) !important;
        }

        .ztg-input {
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

        .ztg-input:focus {
          border-color: var(--zen-primary-color, #70a0ff) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--zen-primary-color, #70a0ff) 25%, transparent) !important;
        }

        .ztg-drag-handle {
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

        .ztg-drag-handle:active {
          cursor: grabbing !important;
        }

        .ztg-drag-pill {
          width: 32px !important;
          height: 4px !important;
          border-radius: 2px !important;
          background: color-mix(in srgb, currentColor 22%, transparent) !important;
          transition: background 0.15s ease, width 0.15s ease !important;
          pointer-events: none !important;
        }

        .ztg-drag-handle:hover .ztg-drag-pill {
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
      observer.observe(tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["collapsed", "split-view-group", "zen-split-view", "is-zen-split"] });
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
            const initialsEl = labelContainer.querySelector('.zentral-group-initials');
            if (initialsEl) initialsEl.textContent = this.getGroupInitials(newName);
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
      group.style.setProperty("border-radius", "6px", "important");

      // Ensure full internal structure exists
      let labelContainer = group.querySelector(".tab-group-label-container");
      if (!labelContainer) {
        labelContainer = document.createElement("div");
        labelContainer.className = "tab-group-label-container";
        const innerLabel = document.createElement("label");
        innerLabel.className = "tab-group-label";
        innerLabel.textContent = group.label || group.getAttribute("label") || "Group";
        labelContainer.appendChild(innerLabel);
        group.insertBefore(labelContainer, group.firstChild);
      }

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
          if (e.target.closest(".tab-close-button") || e.target.closest("#tab-label-input") || e.target.closest(".ztg-drag-handle")) return;
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
          labelContainer.style.setProperty("border-radius", "14px", "important");
          labelContainer.style.setProperty("aspect-ratio", "auto", "important");
          labelContainer.style.setProperty("align-self", "stretch", "important");
          labelContainer.style.setProperty("width", "100%", "important");
          labelContainer.style.setProperty("min-width", "100%", "important");
          labelContainer.style.setProperty("max-width", "100%", "important");
          labelContainer.style.setProperty("height", "28px", "important");
          labelContainer.style.setProperty("min-height", "28px", "important");
          labelContainer.style.setProperty("box-sizing", "border-box", "important");
          labelContainer.style.setProperty("display", "flex", "important");
          labelContainer.style.setProperty("flex-direction", "row", "important");
          labelContainer.style.setProperty("align-items", "center", "important");
          labelContainer.style.setProperty("justify-content", "center", "important");
          labelContainer.style.setProperty("padding", "0 10px", "important");
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
                  
                  row.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (gBrowser && tab) gBrowser.selectedTab = tab;
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
                  
                  row.appendChild(icon);
                  row.appendChild(textCol);
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
        let initialsEl = labelContainer.querySelector(".zentral-group-initials");
        if (!initialsEl) {
          initialsEl = document.createElement("label");
          initialsEl.className = "zentral-group-initials";
          labelContainer.appendChild(initialsEl);
        }
        initialsEl.textContent = this.getGroupInitials(labelValue);
      }
      if (!labelContainer || labelContainer.querySelector(".tab-close-button")) return;
      // Safe DOM injection
      if (window.MozXULElement?.parseXULToFragment) {
        const frag = window.MozXULElement.parseXULToFragment(`
          <div class="tab-group-icon-container"><div class="tab-group-icon"><image class="group-marker" role="button" keyNav="false" tooltiptext="Toggle Group"/></div></div>
          <image class="tab-close-button close-icon" role="button" keyNav="false" tooltiptext="Close Group"/>
        `);
        const iconContainer = frag.children[0];
        const closeButton = frag.children[1];

        labelContainer.insertBefore(iconContainer, labelContainer.firstChild);
        labelContainer.appendChild(closeButton);

        closeButton.addEventListener("click", (event) => {
          event.stopPropagation();
          event.preventDefault();
          try {
            this.removeSavedColor(group.id);
            gBrowser.removeTabGroup(group);
          } catch (error) { console.error("[ZentralTabGroups] Error removing tab group:", error); }
        });
      }

      // Wrap title elements in .zentral-tab-title-wrapper for physical Folder Tab contour
      if (!labelContainer.querySelector(".zentral-tab-title-wrapper")) {
        const wrapper = document.createElement("div");
        wrapper.className = "zentral-tab-title-wrapper";
        const iconContainer = labelContainer.querySelector(".tab-group-icon-container");
        const innerLabel = labelContainer.querySelector(".tab-group-label");
        const initialsEl = labelContainer.querySelector(".zentral-group-initials");
        const closeBtn = labelContainer.querySelector(".tab-close-button");

        if (iconContainer) wrapper.appendChild(iconContainer);
        if (innerLabel) wrapper.appendChild(innerLabel);
        if (initialsEl) wrapper.appendChild(initialsEl);

        labelContainer.insertBefore(wrapper, closeBtn || labelContainer.firstChild);
      }

      group.classList.remove('tab-group-editor-mode-create');
      this.#processedGroups.add(group);
      group.setAttribute("data-close-button-added", "true"); // Kept for external compatibility

      this.addContextMenu(group);

      if (typeof group._useFaviconColor === 'function') {
        group._useFaviconColor();
      }

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
      let contextMenu = document.getElementById("zentral-tabgroup-context-menu") || document.getElementById("advanced-tab-groups-context-menu");
      
      if (!contextMenu || !contextMenu.isConnected) {
        if (contextMenu) contextMenu.remove();
        
        if (window.MozXULElement?.parseXULToFragment) {
          const frag = window.MozXULElement.parseXULToFragment(`
            <menupopup id="zentral-tabgroup-context-menu">
              <menu id="ztg-menu-color" label="Change Group Color">
                <menupopup id="ztg-menu-color-popup">
                  <menuitem id="ztg-item-set-color" label="Set Custom Color"/>
                  <menuitem id="ztg-item-auto-color" label="Average Group's Color"/>
                </menupopup>
              </menu>
              <menuitem id="ztg-item-rename" label="Rename Group"/>
              <menuseparator/>
              <menuitem id="ztg-item-ungroup" label="Ungroup Tabs"/>
            </menupopup>
          `);
          popupSet.appendChild(frag);
          contextMenu = document.getElementById("zentral-tabgroup-context-menu");
        } else {
          contextMenu = document.createXULElement("menupopup");
          contextMenu.id = "zentral-tabgroup-context-menu";

          const colorMenu = document.createXULElement("menu");
          colorMenu.setAttribute("label", "Change Group Color");
          const colorPopup = document.createXULElement("menupopup");

          const setColorItem = document.createXULElement("menuitem");
          setColorItem.id = "ztg-item-set-color";
          setColorItem.setAttribute("label", "Set Custom Color");

          const autoColorItem = document.createXULElement("menuitem");
          autoColorItem.id = "ztg-item-auto-color";
          autoColorItem.setAttribute("label", "Average Group's Color");

          colorPopup.appendChild(setColorItem);
          colorPopup.appendChild(autoColorItem);
          colorMenu.appendChild(colorPopup);
          contextMenu.appendChild(colorMenu);

          const renameItem = document.createXULElement("menuitem");
          renameItem.id = "ztg-item-rename";
          renameItem.setAttribute("label", "Rename Group");
          contextMenu.appendChild(renameItem);

          const sep = document.createXULElement("menuseparator");
          contextMenu.appendChild(sep);

          const ungroupItem = document.createXULElement("menuitem");
          ungroupItem.id = "ztg-item-ungroup";
          ungroupItem.setAttribute("label", "Ungroup Tabs");
          contextMenu.appendChild(ungroupItem);

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
              const hexInput = picker.querySelector("#ztg-input-hex");
              if (hexInput) hexInput.value = hex;
              const bigint = parseInt(hex.slice(1), 16);
              const rgbInput = picker.querySelector("#ztg-input-rgb");
              if (rgbInput && !isNaN(bigint)) rgbInput.value = `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
              const nativeColorInput = picker.querySelector("#ztg-native-color");
              if (nativeColorInput) nativeColorInput.value = hex;
              
              if (typeof picker.openPopupAtScreen === "function") {
                picker.openPopupAtScreen(this.#state.lastContextMenuX || 0, this.#state.lastContextMenuY || 0, false);
              } else if (typeof picker.openPopup === "function") {
                picker.openPopup(grp, "after_start", 0, 0, false, false);
              }
            }
          };

          contextMenu.querySelector("#ztg-item-set-color")?.addEventListener("command", (e) => {
            e.stopPropagation();
            openColorPicker();
          });

          contextMenu.querySelector("#ztg-item-auto-color")?.addEventListener("command", (e) => {
            e.stopPropagation();
            if (this.#state.contextMenuCurrentGroup?._useFaviconColor) {
              this.#state.contextMenuCurrentGroup._useFaviconColor();
            }
          });

          contextMenu.querySelector("#ztg-item-rename")?.addEventListener("command", (e) => {
            e.stopPropagation();
            if (this.#state.contextMenuCurrentGroup) {
              this.renameGroupStart(this.#state.contextMenuCurrentGroup, true);
            }
          });

          contextMenu.querySelector("#ztg-item-ungroup")?.addEventListener("command", (e) => {
            e.stopPropagation();
            if (this.#state.contextMenuCurrentGroup?.ungroupTabs) {
              this.#state.contextMenuCurrentGroup.ungroupTabs();
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
          <vbox class="ztg-cp-box">
            <html:div id="ztg-drag-handle" class="ztg-drag-handle" title="Drag to move">
              <html:div class="ztg-drag-pill"></html:div>
            </html:div>
            <html:div id="ztg-palette-container" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: 156px; height: 144px;">
              ${htmlPalette}
            </html:div>
            <html:div id="ztg-wheel-container" style="display: none; flex-direction: column; gap: 6px; align-items: center; width: 156px; height: 144px;">
              <html:canvas id="ztg-satval-canvas" width="156" height="124" style="border-radius: 8px; cursor: crosshair; border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"></html:canvas>
              <html:canvas id="ztg-hue-canvas" width="156" height="14" style="border-radius: 8px; cursor: pointer; border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"></html:canvas>
            </html:div>
            <hbox style="align-items: center; justify-content: space-between; gap: 4px; width: 156px;">
              <html:button id="ztg-btn-auto" class="ztg-btn" title="Average Group's Color">Auto</html:button>
              <html:button id="ztg-btn-wheel" class="ztg-btn">Wheel</html:button>
              <html:button id="ztg-btn-pick" class="ztg-btn">Pick</html:button>
            </hbox>
            <hbox style="align-items: center; justify-content: space-between; gap: 6px; width: 156px;">
              <html:input id="ztg-input-hex" type="text" placeholder="#HEX" class="ztg-input" style="width: 70px;"/>
              <html:input id="ztg-input-rgb" type="text" placeholder="R, G, B" class="ztg-input" style="width: 80px;"/>
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
          panel._currentGroup.style.setProperty("--atg-contrast-color", this.getContrastColor(color));
          this.saveTabGroupColors();
          this.scheduleStateSave();
        }
      };

      // Palette swatches
      panel.querySelectorAll(".zentral-color-swatch").forEach(swatch => {
        swatch.addEventListener("click", () => applyColor(swatch.dataset.color));
      });

      // Wheel/Palette toggle
      const paletteContainer = panel.querySelector("#ztg-palette-container");
      const wheelContainer = panel.querySelector("#ztg-wheel-container");
      const btnWheel = panel.querySelector("#ztg-btn-wheel");
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
      const satValCanvas = panel.querySelector("#ztg-satval-canvas");
      const hueCanvas = panel.querySelector("#ztg-hue-canvas");

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
        panel.querySelector("#ztg-input-hex").value = hex;
        panel.querySelector("#ztg-input-rgb").value = `${pixel[0]}, ${pixel[1]}, ${pixel[2]}`;
      });

      // Eyedropper API
      const btnPick = panel.querySelector("#ztg-btn-pick");
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
      panel.querySelector("#ztg-btn-auto").addEventListener("click", () => {
        if (panel._currentGroup && panel._currentGroup._useFaviconColor) {
          panel._currentGroup._useFaviconColor();
        }
      });

      // Draggable Color Picker Logic
      const handle = panel.querySelector("#ztg-drag-handle");
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

      panel.querySelector("#ztg-input-hex").addEventListener("input", (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) applyColor(val);
      });
      panel.querySelector("#ztg-input-rgb").addEventListener("change", (e) => {
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
        if (!folderMenu || folderMenu.querySelector("#atg-convert-folder-to-group")) return;
        
        if (window.MozXULElement?.parseXULToFragment) {
          const frag = window.MozXULElement.parseXULToFragment(`<menuseparator id="atg-folder-separator"/><menuitem id="atg-convert-folder-to-group" label="Convert Folder to Group"/>`);
          const convertToSpaceItem = folderMenu.querySelector("#context_zenFolderToSpace");
          if (convertToSpaceItem) { convertToSpaceItem.after(frag); } else { folderMenu.appendChild(frag); }
          
          folderMenu.addEventListener('command', (event) => {
            if (event.target.id === 'atg-convert-folder-to-group') {
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
          if (typeof group._useFaviconColor === 'function') setTimeout(() => group._useFaviconColor(), 300);
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
          group.style.setProperty("--atg-contrast-color", this.getContrastColor(colorString));
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
     * Prevents dormant tabs from being selected and loaded while being dragged or reordered,
     * ensuring sleeping/unloaded tabs remain dormant and only activate on explicit click.
     */
    initTabDragSelectionGuard() {
      const tabContainer = gBrowser?.tabContainer || document.getElementById("tabbrowser-tabs");
      if (!tabContainer || this.#tabDragGuardInitialized) return;
      this.#tabDragGuardInitialized = true;

      let isGuardingTab = false;
      let isDraggingTab = false;
      let dragCandidateTab = null;
      let startX = 0;
      let startY = 0;

      const shouldBlockSelection = (val) => {
        if (!val) return false;
        if (isGuardingTab && val === dragCandidateTab) {
          return true;
        }
        if (isDraggingTab) {
          const isSplitTab = val && (val.hasAttribute?.("is-zen-split") || val.hasAttribute?.("zen-split-view") || val.closest?.("tab-group[split-view-group], tab-group[zen-split-view]"));
          // Allow split view creation selections through; block only plain dormant tab reorder wakeups
          if (val === dragCandidateTab && !isSplitTab) {
            return true;
          }
        }
        return false;
      };

      // 1. Intercept gBrowser.selectedTab setter
      let origSelectedTabDesc = null;
      let targetGbrowserObj = null;
      let proto = gBrowser;
      while (proto) {
        let desc = Object.getOwnPropertyDescriptor(proto, "selectedTab");
        if (desc && desc.set) {
          origSelectedTabDesc = desc;
          targetGbrowserObj = proto;
          break;
        }
        proto = Object.getPrototypeOf(proto);
      }

      if (origSelectedTabDesc && targetGbrowserObj) {
        Object.defineProperty(targetGbrowserObj, "selectedTab", {
          get: origSelectedTabDesc.get,
          set: function(val) {
            if (shouldBlockSelection(val)) {
              return;
            }
            origSelectedTabDesc.set.call(this, val);
          },
          configurable: true,
          enumerable: origSelectedTabDesc.enumerable
        });
      }

      // 2. Intercept tabContainer.selectedItem setter (Native Firefox drag uses this)
      let origSelectedItemDesc = null;
      let targetTabContainerObj = null;
      let tcProto = tabContainer;
      while (tcProto) {
        let desc = Object.getOwnPropertyDescriptor(tcProto, "selectedItem");
        if (desc && desc.set) {
          origSelectedItemDesc = desc;
          targetTabContainerObj = tcProto;
          break;
        }
        tcProto = Object.getPrototypeOf(tcProto);
      }

      if (origSelectedItemDesc && targetTabContainerObj) {
        Object.defineProperty(targetTabContainerObj, "selectedItem", {
          get: origSelectedItemDesc.get,
          set: function(val) {
            if (shouldBlockSelection(val)) {
              return;
            }
            origSelectedItemDesc.set.call(this, val);
          },
          configurable: true,
          enumerable: origSelectedItemDesc.enumerable
        });
      }

      // 3. Setup drag detection logic
      const onMouseDown = (e) => {
        if (e.button !== 0) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!e.target || typeof e.target.closest !== "function") return;
        const tab = e.target.closest("tab, tabbrowser-tab, .tabbrowser-tab");
        if (!tab) return;
        if (e.target.closest(".tab-close-button, .tab-icon-sound, .tab-audio-button, .tab-pin-icon")) return;

        if (tab !== gBrowser.selectedTab) {
          dragCandidateTab = tab;
          isGuardingTab = true;
          isDraggingTab = false;
          startX = e.clientX;
          startY = e.clientY;
        }
      };

      const onDragStart = (e) => {
        const tab = (e.target && typeof e.target.closest === "function" ? e.target.closest("tab, tabbrowser-tab, .tabbrowser-tab") : null) || dragCandidateTab;
        if (tab) {
          dragCandidateTab = tab;
          isDraggingTab = true;
          isGuardingTab = false;
        }
      };

      const onMouseUp = (e) => {
        if (e.button !== 0) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

        if (dragCandidateTab && !isDraggingTab) {
          const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
          if (moveDist < 6 && dragCandidateTab.isConnected && dragCandidateTab !== gBrowser.selectedTab) {
            isGuardingTab = false;
            try {
              if (origSelectedTabDesc) {
                origSelectedTabDesc.set.call(gBrowser, dragCandidateTab);
              } else {
                gBrowser.selectedTab = dragCandidateTab;
              }
            } catch (_) {}
          }
        }
        isGuardingTab = false;
        isDraggingTab = false;
        dragCandidateTab = null;
      };

      const onDragEnd = () => {
        isGuardingTab = false;
        isDraggingTab = false;
        dragCandidateTab = null;
      };

      const onDrop = () => {
        isGuardingTab = false;
        isDraggingTab = false;
        dragCandidateTab = null;
      };

      tabContainer.addEventListener("mousedown", onMouseDown, { capture: true });
      window.addEventListener("mouseup", onMouseUp, { capture: true });
      tabContainer.addEventListener("dragstart", onDragStart, { capture: true });
      tabContainer.addEventListener("dragend", onDragEnd, { capture: true });
      tabContainer.addEventListener("drop", onDrop, { capture: true });

      this.#dragGuardCleanup = () => {
        if (origSelectedTabDesc && targetGbrowserObj) {
          Object.defineProperty(targetGbrowserObj, "selectedTab", origSelectedTabDesc);
        }
        if (origSelectedItemDesc && targetTabContainerObj) {
          Object.defineProperty(targetTabContainerObj, "selectedItem", origSelectedItemDesc);
        }
        tabContainer.removeEventListener("mousedown", onMouseDown, { capture: true });
        window.removeEventListener("mouseup", onMouseUp, { capture: true });
        tabContainer.removeEventListener("dragstart", onDragStart, { capture: true });
        tabContainer.removeEventListener("dragend", onDragEnd, { capture: true });
        tabContainer.removeEventListener("drop", onDrop, { capture: true });
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
      const colors = {};
      document.querySelectorAll("tab-group:not([split-view-group])").forEach(group => {
        if (group.id) {
          const color = group.style.getPropertyValue("--tab-group-color");
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
                group.style.setProperty("--atg-contrast-color", this.getContrastColor(color));
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
        const state = {
          groups: {},
          tabMapping: {}
        };

        // Clean any tabs that are no longer part of any tab group
        const allBrowserTabs = Array.from(gBrowser?.tabs || document.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab"));
        allBrowserTabs.forEach(tab => {
          const tabGroup = tab.closest("tab-group:not([split-view-group])") || (tab.group && !tab.group.hasAttribute?.("split-view-group") ? tab.group : null);
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

        document.querySelectorAll("tab-group:not([split-view-group])").forEach(group => {
          if (!group.id) return;

          const parent = group.parentElement?.closest("tab-group, zen-folder") ?? null;
          const posContainer = parent || group.parentElement;
          const groupSiblings = posContainer
            ? Array.from(posContainer.children).filter(
                el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group")
              )
            : [];
          const index = groupSiblings.indexOf(group);

          const label = group.label || group.getAttribute("label") || "Group";
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color") || "";
          const wsId = group.getAttribute("zen-workspace-id") || "";

          state.groups[group.id] = {
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

          state.tabMapping[group.id] = directTabs.map(tab => ({
            url: tab.linkedBrowser?.currentURI?.spec || "",
            label: tab.label || "",
            zenTabId: tab.getAttribute("zen-tab-id") || tab.id || ""
          }));

          // Synchronize DOM attributes and SessionStore with live state
          directTabs.forEach(tab => {
            tab.setAttribute("data-zentral-group-id", group.id);
            tab.setAttribute("data-zentral-group-label", label);
            if (color) tab.setAttribute("data-zentral-group-color", color);
            else tab.removeAttribute("data-zentral-group-color");
            
            tab.setAttribute("data-zentral-group-collapsed", group.hasAttribute("collapsed") ? "true" : "false");
            
            if (wsId) tab.setAttribute("data-zentral-group-ws", wsId);
            else tab.removeAttribute("data-zentral-group-ws");
            
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

        Core.setPref(Constants.TabGroups.PREF_STATE, JSON.stringify(state));
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
      } else {
        this.modal.style.display = "flex";
        this.populate();
      }
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
      if (this.modal) this.modal.style.display = "none";
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
      
      get("zs-ag-enabled").checked = Core.getPref(Constants.Apps.PREF_ENABLED, true) !== false;
      if (get("zs-ag-placement")) {
        get("zs-ag-placement").value = Core.getPref(Constants.Apps.PREF_PLACEMENT, "sidebar") || "sidebar";
      }
      if (get("zs-ag-compact-drawer")) {
        get("zs-ag-compact-drawer").checked = Core.getPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED, false) === true;
      }
      if (get("zs-ag-autohide")) {
        get("zs-ag-autohide").checked = Core.getPref(Constants.Apps.PREF_AUTOHIDE, false) === true;
      }
      get("zs-anim-type").value = Core.getPref(Constants.Apps.PREF_ANIMATION_TYPE, "slide") || "slide";
      get("zs-anim-speed").value = Core.getPref(Constants.Apps.PREF_ANIMATION_SPEED, 450) || 450;
      get("zs-max-apps").value = Core.getPref(Constants.Apps.PREF_MAX_APPS, 21) || 21;
      get("zs-apps-row").value = Core.getPref(Constants.Apps.PREF_APPS_PER_ROW, 7) || 7;
      get("zs-max-rows").value = Core.getPref(Constants.Apps.PREF_MAX_ROWS, 3) || 3;

      get("zs-tg-enabled").checked = Core.getPref(Constants.TabGroups.PREF_ENABLED, true) !== false;
      get("zs-tg-collapse").checked = Core.getPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH, false) === true;
      get("zs-tg-thumbnails").checked = Core.getPref(Constants.TabGroups.PREF_THUMBNAILS, true) !== false;
      get("zs-tg-chevron").checked = Core.getPref(Constants.TabGroups.PREF_SHOW_CHEVRON, true) !== false;
      
      const opacity = Core.getPref(Constants.TabGroups.PREF_LABEL_OPACITY, 85) || 85;
      if (get("zs-tg-opacity")) {
        get("zs-tg-opacity").value = opacity;
        if (get("zs-tg-opacity-val")) get("zs-tg-opacity-val").textContent = opacity + "%";
      }
      
      if (get("zs-pref-logger-enabled")) {
        get("zs-pref-logger-enabled").checked = Core.getPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, false);
      }
      if (get("zs-pref-logger-path")) {
        const savedPath = Core.getPref(Constants.Diagnostics.PREF_LOGGER_PATH, "");
        get("zs-pref-logger-path").value = savedPath;
        this.updatePathUI(savedPath);
      }
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
      if (get("zs-ag-compact-drawer")) {
        Core.setPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED, get("zs-ag-compact-drawer").checked);
      }
      if (get("zs-ag-autohide")) {
        Core.setPref(Constants.Apps.PREF_AUTOHIDE, get("zs-ag-autohide").checked);
      }
      Core.setPref(Constants.Apps.PREF_ANIMATION_TYPE, get("zs-anim-type").value);
      Core.setPref(Constants.Apps.PREF_ANIMATION_SPEED, parseInt(get("zs-anim-speed").value) || 450);
      Core.setPref(Constants.Apps.PREF_MAX_APPS, parseInt(get("zs-max-apps").value) || 21);
      Core.setPref(Constants.Apps.PREF_APPS_PER_ROW, parseInt(get("zs-apps-row").value) || 7);
      Core.setPref(Constants.Apps.PREF_MAX_ROWS, parseInt(get("zs-max-rows").value) || 3);

      Core.setPref(Constants.TabGroups.PREF_ENABLED, get("zs-tg-enabled").checked);
      Core.setPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH, get("zs-tg-collapse").checked);
      Core.setPref(Constants.TabGroups.PREF_THUMBNAILS, get("zs-tg-thumbnails").checked);
      Core.setPref(Constants.TabGroups.PREF_SHOW_CHEVRON, get("zs-tg-chevron").checked);
      if (get("zs-tg-opacity")) {
        Core.setPref(Constants.TabGroups.PREF_LABEL_OPACITY, parseInt(get("zs-tg-opacity").value) || 85);
      }

      if (get("zs-pref-logger-enabled")) {
        Core.setPref(Constants.Diagnostics.PREF_LOGGER_ENABLED, get("zs-pref-logger-enabled").checked);
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
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: zsFadeIn 0.18s ease-out;
        }

        @keyframes zsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes zsModalPop {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .zs-dialog {
          background: #18181c !important;
          color: #f2f2f7 !important;
          width: 480px;
          max-width: 92vw;
          border-radius: 16px;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: zsModalPop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        .zs-header {
          padding: 16px 22px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          color: #ffffff !important;
        }

        .zs-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .zs-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.2px;
          color: #ffffff !important;
        }

        .zs-close-btn {
          background: transparent;
          border: none;
          color: #f2f2f7 !important;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: all 0.15s ease;
          padding: 0;
        }

        .zs-close-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .zs-body {
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          max-height: 72vh;
          scrollbar-width: thin;
          background: #18181c !important;
          color: #f2f2f7 !important;
        }

        .zs-section-title {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--zen-primary-color, #ff5555) !important;
          opacity: 0.95;
          margin: 6px 0 2px 0;
        }

        .zs-card {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.07) !important;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .zs-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .zs-label-container {
          display: flex;
          flex-direction: column;
        }

        .zs-label {
          font-size: 13px;
          font-weight: 500;
          color: #f2f2f7 !important;
        }

        .zs-sublabel {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6) !important;
          margin-top: 2px;
        }

        /* Integrated Dark Stepper Container */
        .zs-stepper {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          width: 86px;
          height: 32px;
        }

        .zs-stepper:focus-within {
          border-color: var(--zen-primary-color, #ff5555) !important;
          box-shadow: 0 0 0 2px rgba(255, 85, 85, 0.3) !important;
        }

        .zs-stepper .zs-input-number {
          flex: 1;
          width: 54px !important;
          background: transparent !important;
          border: none !important;
          color: #ffffff !important;
          padding: 4px 6px 4px 10px !important;
          font-size: 13px !important;
          text-align: left !important;
          font-weight: 600 !important;
          outline: none !important;
          -moz-appearance: textfield !important;
          appearance: textfield !important;
        }

        .zs-stepper .zs-input-number::-webkit-outer-spin-button,
        .zs-stepper .zs-input-number::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }

        .zs-stepper-btns {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          width: 22px;
        }

        .zs-stepper-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
          user-select: none;
        }

        .zs-stepper-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .zs-stepper-btn:active {
          background: var(--zen-primary-color, #ff5555);
          color: #ffffff;
        }

        .zs-stepper-up {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Sleek select box */
        .zs-select {
          width: 155px;
          background: #242429 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>') no-repeat right 10px center !important;
          -moz-appearance: none !important;
          appearance: none !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          border-radius: 8px;
          color: #ffffff !important;
          padding: 6px 28px 6px 10px;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .zs-select:hover {
          border-color: rgba(255, 255, 255, 0.35) !important;
        }

        .zs-select:focus {
          border-color: var(--zen-primary-color, #ff5555) !important;
        }

        .zs-select option {
          background-color: #242429 !important;
          color: #f2f2f7 !important;
        }

        .zs-switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 22px;
          flex-shrink: 0;
        }

        .zs-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .zs-slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: rgba(255, 255, 255, 0.16) !important;
          transition: background-color 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
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
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        .zs-switch input:checked + .zs-slider {
          background-color: var(--zen-primary-color, #ff5555) !important;
          border-color: transparent !important;
        }

        .zs-switch input:checked + .zs-slider:before {
          transform: translateX(16px);
        }

        .zs-range-container {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 180px;
        }

        .zs-range-slider {
          flex: 1;
          appearance: none;
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.16) !important;
          outline: none;
          cursor: pointer;
        }

        .zs-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--zen-primary-color, #ff5555) !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .zs-range-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .zs-range-value {
          font-size: 12px;
          font-weight: 600;
          width: 40px;
          text-align: right;
          color: #f2f2f7 !important;
          opacity: 0.9;
        }

        .zs-reset-btn {
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 500;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: #f2f2f7 !important;
          cursor: pointer;
          opacity: 0.85;
          transition: all 0.15s ease;
          align-self: flex-end;
        }

        .zs-reset-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.14) !important;
        }

        .zs-footer {
          padding: 14px 22px;
          background: rgba(255, 255, 255, 0.02) !important;
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .zs-btn-cancel {
          padding: 7px 16px;
          border-radius: 8px;
          background: transparent !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          color: #f2f2f7 !important;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          opacity: 0.85;
          transition: all 0.15s ease;
        }

        .zs-btn-cancel:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .zs-btn-save {
          padding: 7px 18px;
          border-radius: 8px;
          background: var(--zen-primary-color, #ff5555) !important;
          border: none;
          color: #ffffff !important;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 8px color-mix(in srgb, var(--zen-primary-color, #ff5555) 40%, transparent);
          transition: all 0.15s ease;
        }

        .zs-btn-save:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .zs-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: rgba(255, 85, 85, 0.15);
          color: #ff6b6b;
          border: 1px solid rgba(255, 85, 85, 0.25);
          margin-left: 6px;
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

    createModal() {
      this.injectStyles();
      this.modal = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      this.modal.id = "zentral-settings-modal";
      
      const content = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      content.className = "zs-dialog";
      
      const htmlStr = `
        <div class="zs-header">
          <div class="zs-title-group">
            <h2 class="zs-title">Zentral Settings <span style="font-size: 11px; padding: 2px 7px; border-radius: 10px; background: color-mix(in srgb, currentColor 10%, transparent); opacity: 0.75; font-weight: 600; margin-left: 8px;">v0.1.6</span></h2>
          </div>
          <button id="zs-close" class="zs-close-btn" title="Close Settings">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>

        <div class="zs-body">
          <div class="zs-section-title">Apps Grid</div>
          <div class="zs-card">
            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Enable Apps Grid</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-ag-enabled" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Apps placement</span>
                <span class="zs-sublabel">Dock in Sidebar or in a dedicated Vertical Bar on the opposite edge</span>
              </div>
              <select id="zs-ag-placement" class="zs-select">
                <option value="sidebar">Sidebar</option>
                <option value="vertical-bar">Vertical Bar (Opposite Edge)</option>
              </select>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Compact Sidebar Apps Drawer <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: color-mix(in srgb, #ff6b6b 20%, transparent); color: #ff6b6b; font-weight: 600; margin-left: 6px; text-transform: uppercase;">Experimental</span></span>
                <span class="zs-sublabel">Hover top 1/3 screen edge in compact mode to reveal vertical Apps drawer</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-ag-compact-drawer" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Animation type</span>
              </div>
              <select id="zs-anim-type" class="zs-select">
                <option value="slide">Smooth Slide</option>
                <option value="spring-gentle">Spring (Gentle)</option>
                <option value="spring-bouncy">Spring (Bouncy)</option>
                <option value="spring-snappy">Spring (Snappy)</option>
                <option value="elastic">Elastic Bounce</option>
                <option value="none">None (Instant)</option>
              </select>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Animation speed (ms)</span>
              </div>
              <div class="zs-stepper">
                <input type="number" id="zs-anim-speed" class="zs-input-number" min="50" max="2000" step="50" />
                <div class="zs-stepper-btns">
                  <button type="button" class="zs-stepper-btn zs-stepper-up" data-target="zs-anim-speed" data-step="50" title="Increase">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button type="button" class="zs-stepper-btn zs-stepper-down" data-target="zs-anim-speed" data-step="-50" title="Decrease">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Max total apps</span>
              </div>
              <div class="zs-stepper">
                <input type="number" id="zs-max-apps" class="zs-input-number" min="1" max="100" step="1" />
                <div class="zs-stepper-btns">
                  <button type="button" class="zs-stepper-btn zs-stepper-up" data-target="zs-max-apps" data-step="1" title="Increase">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button type="button" class="zs-stepper-btn zs-stepper-down" data-target="zs-max-apps" data-step="-1" title="Decrease">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Apps per row (max 10)</span>
              </div>
              <div class="zs-stepper">
                <input type="number" id="zs-apps-row" class="zs-input-number" min="1" max="10" step="1" />
                <div class="zs-stepper-btns">
                  <button type="button" class="zs-stepper-btn zs-stepper-up" data-target="zs-apps-row" data-step="1" title="Increase">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button type="button" class="zs-stepper-btn zs-stepper-down" data-target="zs-apps-row" data-step="-1" title="Decrease">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Max rows before scroll</span>
              </div>
              <div class="zs-stepper">
                <input type="number" id="zs-max-rows" class="zs-input-number" min="1" max="10" step="1" />
                <div class="zs-stepper-btns">
                  <button type="button" class="zs-stepper-btn zs-stepper-up" data-target="zs-max-rows" data-step="1" title="Increase">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button type="button" class="zs-stepper-btn zs-stepper-down" data-target="zs-max-rows" data-step="-1" title="Decrease">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <button id="zs-ag-reset" class="zs-reset-btn">Reset Apps Grid Defaults</button>
          </div>

          <div class="zs-section-title">Tab Groups</div>
          <div class="zs-card">
            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Enable tab groups</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-tg-enabled" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Collapse groups at Startup</span>
                <span class="zs-sublabel">Disable to remember group states</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-tg-collapse" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Groups Thumbnails</span>
                <span class="zs-sublabel">Show thumbnails for tab groups</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-tg-thumbnails" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Show Group Chevron</span>
                <span class="zs-sublabel">Display expansion chevron icon near title</span>
              </div>
              <label class="zs-switch">
                <input type="checkbox" id="zs-tg-chevron" />
                <span class="zs-slider"></span>
              </label>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Group Labels Opacity</span>
                <span class="zs-sublabel">Adjust label pill transparency (10% - 100%)</span>
              </div>
              <div class="zs-range-container">
                <input type="range" id="zs-tg-opacity" class="zs-range-slider" min="10" max="100" step="5" />
                <span id="zs-tg-opacity-val" class="zs-range-value">85%</span>
              </div>
            </div>

            <button id="zs-tg-reset" class="zs-reset-btn">Reset Tab Groups Defaults</button>
          </div>

          <div class="zs-section-title">Diagnostics</div>
          <div class="zs-card">
            
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

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Export Log Path</span>
                <span class="zs-sublabel" id="zs-pref-logger-path-desc">Directory where diagnostic logs are saved</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; max-width: 55%;">
                <input type="hidden" id="zs-pref-logger-path" />
                <button type="button" id="zs-btn-choose-path" class="zs-reset-btn" style="margin: 0; padding: 5px 10px; font-size: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: inherit; max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="Click to choose export directory">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  <span id="zs-btn-choose-path-label">Default Folder</span>
                </button>
                <button type="button" id="zs-btn-clear-path" title="Reset to default folder (chrome/logs)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); cursor: pointer; padding: 4px 8px; display: none; align-items: center; justify-content: center; font-size: 11px; border-radius: 5px;">✕</button>
              </div>
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Capture Log</span>
                <span class="zs-sublabel">Generate and save a diagnostic log file instantly. (Shortcut: <kbd>Alt</kbd>+<kbd>L</kbd>)</span>
              </div>
              <button id="zs-btn-capture-log" class="zs-reset-btn" style="background:var(--zen-primary-color); color:#fff; border:none; margin: 0; min-width: 75px; text-align: center; transition: background 0.2s ease, transform 0.1s ease;">Export</button>
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
      
      this.modal.querySelector("#zs-close").addEventListener("click", () => this.close());
      this.modal.querySelector("#zs-cancel").addEventListener("click", () => this.close());
      this.modal.querySelector("#zs-save").addEventListener("click", () => this.save());

      const choosePathBtn = this.modal.querySelector("#zs-btn-choose-path");
      const clearPathBtn = this.modal.querySelector("#zs-btn-clear-path");
      const pathInput = this.modal.querySelector("#zs-pref-logger-path");

      if (choosePathBtn) {
        choosePathBtn.addEventListener("click", async () => {
          const selectedFolder = await this.pickExportFolder();
          if (selectedFolder) {
            pathInput.value = selectedFolder;
            this.updatePathUI(selectedFolder);
          }
        });
      }

      if (clearPathBtn) {
        clearPathBtn.addEventListener("click", () => {
          pathInput.value = "";
          this.updatePathUI("");
        });
      }

      const captureBtn = this.modal.querySelector("#zs-btn-capture-log");
      if (captureBtn) {
        captureBtn.addEventListener("click", () => {
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

      this.modal.addEventListener("mousedown", (e) => {
        if (e.target === this.modal) this.close();
      });

      // Stepper button events
      this.modal.querySelectorAll(".zs-stepper-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const targetId = btn.dataset.target;
          const step = parseInt(btn.dataset.step, 10) || 1;
          const input = this.modal.querySelector("#" + targetId);
          if (input) {
            const min = input.min !== "" ? parseInt(input.min, 10) : -Infinity;
            const max = input.max !== "" ? parseInt(input.max, 10) : Infinity;
            let current = parseInt(input.value, 10);
            if (isNaN(current)) current = 0;
            let nextVal = current + step;
            if (nextVal < min) nextVal = min;
            if (nextVal > max) nextVal = max;
            input.value = nextVal;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });

      this.modal.querySelector("#zs-ag-reset").addEventListener("click", () => {
        const get = (id) => this.modal.querySelector("#" + id);
        get("zs-ag-enabled").checked = true;
        if (get("zs-ag-placement")) get("zs-ag-placement").value = "sidebar";
        if (get("zs-ag-compact-drawer")) get("zs-ag-compact-drawer").checked = false;
        get("zs-anim-type").value = "slide";
        get("zs-anim-speed").value = 450;
        get("zs-max-apps").value = 21;
        get("zs-apps-row").value = 7;
        get("zs-max-rows").value = 3;
      });

      this.modal.querySelector("#zs-tg-reset").addEventListener("click", () => {
        const get = (id) => this.modal.querySelector("#" + id);
        get("zs-tg-enabled").checked = true;
        get("zs-tg-collapse").checked = false;
        get("zs-tg-thumbnails").checked = true;
        get("zs-tg-chevron").checked = true;
        get("zs-tg-opacity").value = 85;
        get("zs-tg-opacity-val").textContent = "85%";
        document.documentElement.style.setProperty("--zentral-tabgroup-label-opacity", "0.85");
        document.documentElement.setAttribute("zentral-label-opacity-below-85", "false");
      });

      const opacityInput = this.modal.querySelector("#zs-tg-opacity");
      const opacityVal = this.modal.querySelector("#zs-tg-opacity-val");
      if (opacityInput && opacityVal) {
        opacityInput.addEventListener("input", (e) => {
          const val = parseInt(e.target.value);
          opacityVal.textContent = val + "%";
          document.documentElement.style.setProperty("--zentral-tabgroup-label-opacity", (val / 100).toFixed(2));
          document.documentElement.setAttribute("zentral-label-opacity-below-85", val < 85 ? "true" : "false");
        });
      }
      
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
      console.log("[Zentral] Booting Master Script (v0.1.6)...");
      Apps.init();
      TabGroups.init();
      Settings.init();
      window.ZentralSettingsInstance = Settings;
    },
    Destroy: () => {
      console.log("[Zentral] Unloading and destroying Zentral mod...");
      if (Apps.destroy) Apps.destroy();
      if (TabGroups.destroy) TabGroups.destroy();
      if (Settings.destroy) Settings.destroy();
      window.ZentralInitialized = false;
      delete window.Zentral;
      delete window.ZenzeiLogger;
      delete window.ZenTabPeekLogger;
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
    } else if (document.readyState === "complete") {
      window.Zentral.Init();
    } else {
      let booted = false;
      const safeBoot = () => {
        if (booted) return;
        booted = true;
        try { window.Zentral.Init(); } catch (err) { console.error("[Zentral] Boot error:", err); }
      };

      if (typeof Services !== "undefined" && Services.obs) {
        Services.obs.addObserver(function observer(subject, topic) {
          if (topic === "browser-delayed-startup-finished" && subject === window) {
            Services.obs.removeObserver(observer, topic);
            safeBoot();
          }
        }, "browser-delayed-startup-finished", false);
      }
      
      window.addEventListener("DOMContentLoaded", safeBoot, { once: true });
      window.addEventListener("load", safeBoot, { once: true });
      setTimeout(safeBoot, 1000);
    }
  } catch (e) {
    console.error("[Zentral] Startup observer error, forcing immediate Init():", e);
    try { window.Zentral.Init(); } catch (_) {}
  }

})();
