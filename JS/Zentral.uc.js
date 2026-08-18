
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
      MIN_WIDTH_PX: 280,
      MAX_WIDTH_RATIO: 0.80,
      DEFAULT_SLIDE_MS: 450,
      DEFAULT_MAX_APPS: 21,
      DEFAULT_APPS_PER_ROW: 7,
      DEFAULT_MAX_ROWS: 3
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
    }
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
        [Constants.TabGroups.PREF_COLORS]: "{}",
        [Constants.TabGroups.PREF_STATE]: "{}",
        [Constants.TabGroups.PREF_ENABLED]: true,
        [Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH]: false,
        [Constants.TabGroups.PREF_THUMBNAILS]: true,
        [Constants.TabGroups.PREF_SHOW_CHEVRON]: true,
        [Constants.TabGroups.PREF_LABEL_OPACITY]: 85
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
    getNativePref(key, fallback) {
      if (!Services.prefs.prefHasUserValue(key)) return fallback;
      try {
        if (typeof fallback === "boolean") return Services.prefs.getBoolPref(key);
        if (typeof fallback === "number") return Number.isInteger(fallback) ? Services.prefs.getIntPref(key) : parseFloat(Services.prefs.getStringPref(key));
        if (typeof fallback === "string") return Services.prefs.getStringPref(key);
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
    /**
     * Module tear down for Sine hot unloading
     */
    destroy() {
      try {
        const els = ["zs-app-style", "zs-app-grid-container", "zs-apps-resize-handle", "zs-app-drawer-toggle"];
        els.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.remove();
        });
        document.querySelectorAll(".zs-app-panel").forEach(p => p.remove());
        if (this.#state && this.#state.appBrowsers) {
          this.#state.appBrowsers.forEach(b => { if (b && b.remove) b.remove(); });
          this.#state.appBrowsers.clear();
        }
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
      cachedScrollbarWidth: null
    };

    /**
     * DOM element references cached for high-performance access
     * @private
     */
    #dom = {
      grid: null,
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
      if (document.documentElement.getAttribute("zen-right-side") === "true") return true;
      if (document.documentElement.getAttribute("zen-sidebar-right") === "true") return true;
      if (Core.getNativePref("zen.view.sidebar-on-right", false)) return true;
      if (Core.getNativePref("zen.sidebar.right", false)) return true;
      
      const sidebarEl = document.getElementById("sidebar-box") || 
                        document.getElementById("sidebar-container") || 
                        document.getElementById("vertical-tabs") ||
                        gBrowser?.tabContainer;
      if (sidebarEl && sidebarEl.isConnected) {
        const rect = sidebarEl.getBoundingClientRect();
        if (rect.width > 0 && rect.left > window.innerWidth / 2) return true;
      }
      return false;
    }

    /**
     * Determines whether the Zen sidebar is currently collapsed.
     * @returns {boolean} True if sidebar is collapsed.
     */
    isCollapsedSidebar() {
      if (document.documentElement.getAttribute("zen-sidebar-collapsed") === "true") return true;
      if (document.documentElement.getAttribute("zen-sidebar-expanded") === "false") return true;
      if (document.documentElement.getAttribute("zen-compact-mode") === "true") return true;
      if (document.getElementById("tabbrowser-tabs")?.getAttribute("zentral-sidebar-collapsed") === "true") return true;
      if (!Core.getNativePref("zen.view.sidebar-expanded", true)) return true;

      const sidebarBox = document.getElementById("sidebar-box") || document.getElementById("sidebar-container");
      if (sidebarBox && (sidebarBox.getAttribute("collapsed") === "true" || sidebarBox.getAttribute("hidden") === "true")) return true;

      return false;
    }

    /**
     * Determines whether Zen Browser is using the "Collapsed Sidebar" layout mode (horizontal apps bar in top toolbar).
     * @returns {boolean} True if in Collapsed Sidebar layout mode.
     */
    isCollapsedLayoutMode() {
      if (this.#dom.grid?.classList.contains("zen-apps-horizontal")) return true;
      return this.isCollapsedSidebar();
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
        #zen-apps-sidebar-grid { display: grid; grid-template-columns: repeat(var(--zentral-grid-cols, 7), minmax(0, 1fr)); justify-items: center; align-items: center; gap: 6px; padding: 8px 10px; width: 100%; box-sizing: border-box; position: relative; z-index: 10; max-height: calc(var(--zentral-max-rows, 3) * 42px + 16px); overflow-y: auto; scrollbar-width: none; }
        #zen-apps-sidebar-grid::-webkit-scrollbar { display: none; }
        .zen-apps-scroll-box { display: contents; }
        :root[zen-sidebar-collapsed="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal),
        :root[zen-compact-mode="true"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal),
        :root[zen-sidebar-expanded="false"] #zen-apps-sidebar-grid:not(.zen-apps-horizontal),
        :root:not([zen-sidebar-expanded="true"]) #zen-apps-sidebar-grid:not(.zen-apps-horizontal) { display: none !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal { display: flex !important; flex-direction: row !important; padding: 0 4px !important; gap: 2px !important; width: auto !important; height: 100% !important; max-height: 38px !important; align-items: center !important; -moz-window-dragging: no !important; position: relative !important; flex-shrink: 1 !important; min-width: 0 !important; margin-left: auto !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 4px !important; overflow-x: auto !important; scrollbar-width: none !important; width: max-content !important; max-width: calc(10 * 38px + 9 * 4px) !important; scroll-behavior: smooth !important; -moz-window-dragging: no !important; flex-shrink: 1 !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-apps-scroll-box::-webkit-scrollbar { display: none !important; }
        #zen-apps-sidebar-grid.zen-apps-horizontal .zen-app-tile { width: 28px !important; min-width: 28px !important; max-width: 28px !important; height: 28px !important; padding: 0 !important; aspect-ratio: auto !important; border-radius: var(--toolbarbutton-border-radius, 6px) !important; flex-shrink: 0 !important; }
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

        #zen-app-panel-root { position: fixed; display: none; pointer-events: none; overflow: visible; z-index: 1 !important; }
        #zen-app-panel-root[open] { display: block; }
        #zen-app-panel-root:not([open]) #zen-app-panel-slider, #zen-app-panel-root[closing] #zen-app-panel-slider { box-shadow: none !important; }
        #zen-app-panel-clip { position: absolute; inset: 0; overflow: hidden; border-radius: var(--zen-native-inner-radius, 8px); pointer-events: none; }
        #zen-app-panel-slider { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--tabpanels-background-color, #1e1e24); box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.30); pointer-events: auto; will-change: transform; }
        #zen-app-panel-pill { position: absolute; top: 50%; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 4px; border-radius: 14px; background: var(--zen-colors-tertiary, var(--zen-colors-secondary, var(--zen-primary-color, light-dark(#f4b4b4, #362929)))); color: var(--zen-colors-tertiary-text, light-dark(#18181b, #f4f4f5)); border: 1px solid color-mix(in srgb, currentColor 12%, transparent); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35); z-index: 20; opacity: 0; transition: opacity 0.2s ease 0.3s; pointer-events: none; }
        #zen-app-panel-root:not([open]) #zen-app-panel-pill, #zen-app-panel-root[closing] #zen-app-panel-pill { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        :root[zen-right-side="true"] #zen-app-panel-pill { left: 0; transform: translate(-50%, -50%); }
        :root:not([zen-right-side="true"]) #zen-app-panel-pill { right: 0; transform: translate(50%, -50%); }
        .zen-app-hover-zone { position: absolute; top: 0; bottom: 0; width: 44px; z-index: 10; pointer-events: none; background: transparent; }
        #zen-app-panel-root[open] .zen-app-hover-zone { pointer-events: auto; }
        :root[zen-right-side="true"] .zen-app-hover-zone { left: -22px; right: auto; }
        :root:not([zen-right-side="true"]) .zen-app-hover-zone { right: -22px; left: auto; }
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

        const scrollBox = document.createElement("div");
        scrollBox.className = "zen-apps-scroll-box";

        this.#dom.grid.appendChild(scrollBox);
        this.#dom.scrollBox = scrollBox;

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
     */
    renderGrid() {
      if (!this.#dom.grid) return;
      const oldAddBtn = this.#dom.grid.querySelector(".zen-app-add-btn");
      if (oldAddBtn) oldAddBtn.remove();
      const targetContainer = this.#dom.scrollBox || this.#dom.grid;
      targetContainer.innerHTML = "";
      
      const sidebarRight = this.isSidebarRight();
      const isCollapsed = this.isCollapsedSidebar();
      const shouldFlip = !sidebarRight && !isCollapsed;
      this.#dom.grid.style.direction = shouldFlip ? "rtl" : "ltr";
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

        let isDraggingTile = false;
        let clickTimer = null;
        let startX = 0;
        let startY = 0;

        const togglePanel = () => {
          if (this.#state.activeAppId === app.id) {
            this.closePanel();
          } else {
            this.openPanel(app);
          }
        };

        const cancelClickTimer = () => {
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
        };

        btn.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          isDraggingTile = false;
          startX = e.clientX;
          startY = e.clientY;
          
          cancelClickTimer();
          if (this.isCollapsedSidebar()) {
            clickTimer = setTimeout(() => {
              clickTimer = null;
              if (!isDraggingTile) togglePanel();
            }, 400);
          }
        });

        btn.addEventListener("mousemove", (e) => {
          if (e.buttons === 1) {
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (dist > 4) {
              isDraggingTile = true;
              cancelClickTimer();
            }
          }
        });

        btn.addEventListener("mouseup", (e) => {
          if (e.button !== 0) return;
          if (isDraggingTile) {
            cancelClickTimer();
            return;
          }
          
          cancelClickTimer();
          togglePanel();
        });
        
        btn.addEventListener("click", (e) => {
          if (e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
          }
        });

        // Context menu and drag/drop logic
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const popup = document.getElementById("zen-apps-sidebar-tile-context");
          if (popup) { popup.dataset.activeAppId = app.id; popup.openPopupAtScreen(e.screenX, e.screenY, true); }
        });
        
        btn.draggable = true;
        btn.addEventListener("dragstart", (e) => { 
          isDraggingTile = true; 
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
          draggedAppId = app.id; 
          e.dataTransfer.effectAllowed = "move"; 
          e.dataTransfer.setData("text/plain", app.id); 
          btn.style.opacity = "0.4"; 
        });
        btn.addEventListener("dragend", () => { draggedAppId = null; btn.style.opacity = "1"; this.renderGrid(); });
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

        this.#dom.grid.appendChild(addBtn);
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

      const isTopSlide = this.isCollapsedLayoutMode();
      const slideFrom = isTopSlide 
        ? "translateY(-100%)" 
        : (this.isSidebarRight() ? "translateX(100%)" : "translateX(-100%)");
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
      
      const tiles = document.querySelectorAll(".zen-app-tile[data-app-id]");
      tiles.forEach(tile => tile.dataset.active = "false");

      const isTopSlide = this.isCollapsedLayoutMode();
      const slideTo = isTopSlide 
        ? "translateY(-100%)" 
        : (this.isSidebarRight() ? "translateX(100%)" : "translateX(-100%)");
      
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
        const match = title.match(/^\((\d+)\)/) || title.includes("•") || title.match(/^\[(\d+)\]/);
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
      window.addEventListener("transitionend", this._globalTransitionHandler, { passive: true });

      // --- Vector 2: ResizeObserver ---
      // Catches structural layout box changes (like window resize or sidebar toggle)
      this._sidebarResizeObserver = new ResizeObserver(reposition);
      const idsToObserve = [
        "sidebar-box", "sidebar-container", "vertical-tabs", 
        "navigator-toolbox", "zen-appcontent-navbar-wrapper"
      ];
      idsToObserve.forEach(id => {
        const el = document.getElementById(id);
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

      const isCollapsed = this.isCollapsedSidebar() || (sidebarRect.width > 0 && sidebarRect.width <= 80);
      const sideGap = isCollapsed ? 7 : gap;

      let top = 0;
      let targetLeft = Math.max(gap, Math.round(sidebarRect.right) + sideGap);
      let targetRight = Math.max(gap, Math.round(window.innerWidth - sidebarRect.left) + sideGap);

      try {
        let maxBottom = 0;
        const idsToCheck = ["zen-appcontent-navbar-wrapper", "navigator-toolbox"];
          
        idsToCheck.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.height < 200) {
              maxBottom = Math.max(maxBottom, rect.bottom);
            }
          }
        });
        
        top = Math.round(maxBottom);
      } catch(e) {}

      root.style.top = top + "px";
      root.style.bottom = gap + "px";

      if (this.isSidebarRight()) {
        root.style.left = "auto";
        root.style.right = targetRight + "px";
        root.style.transform = "translateX(0)";
      } else {
        root.style.right = "auto";
        root.style.left = targetLeft + "px";
        root.style.transform = "translateX(0)";
      }
      // console.log removed — was firing at 60fps causing console spam (C-04)
    }

    /**
     * Toggles pinned state for floating app panel. Pinned panels remain visible when clicking outside.
     */
    togglePin() {
      this.#state.isPinned = !this.#state.isPinned;
      console.log("[ZentralApps] togglePin - isPinned:", this.#state.isPinned);
      if(this.#dom.pinBtn) {
        this.#dom.pinBtn.setAttribute("data-pinned", this.#state.isPinned ? "true" : "false");
        this.#dom.pinBtn.title = this.#state.isPinned ? "Unpin panel" : "Pin panel";
      }
    }

    /**
     * Toggles expanded state for active floating app panel, maximizing width to fit viewport.
     */
    toggleExpand() {
      console.log("[ZentralApps] toggleExpand - current isExpanded:", this.#state.isExpanded);
      if (!this.#state.isExpanded) {
        this.#state.preExpandWidth = this.#state.panelWidthPx || this.loadWidth();
        
        const gap = 12;
        let fullWidth = window.innerWidth - (gap * 2);
        if (gBrowser?.tabContainer) {
          const tcRect = gBrowser.tabContainer.getBoundingClientRect();
          if (this.isSidebarRight()) {
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
      let newW = this.isSidebarRight() ? (this._startW - diff) : (this._startW + diff);
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
        const settingsItem = document.createXULElement("menuitem"); settingsItem.id = "zen-apps-sidebar-settings-item"; settingsItem.setAttribute("label", "Zentral Settings");
        popup.appendChild(removeMenuItem); popup.appendChild(preloadItem); popup.appendChild(spaceSep); popup.appendChild(currentSpaceItem); popup.appendChild(allSpacesItem); popup.appendChild(settingsSep); popup.appendChild(settingsItem);
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
        
        if (removeBtn) removeBtn.hidden = !hasApp;
        if (preloadBtn) preloadBtn.hidden = !hasApp;
        if (currentSpaceBtn) currentSpaceBtn.hidden = !hasApp;
        if (allSpacesBtn) allSpacesBtn.hidden = !hasApp;
        if (spaceSep) spaceSep.hidden = !hasApp;

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
      if (path.some(el => el.id === "zen-app-panel-root" || el.id === "zen-apps-sidebar-grid" || (el.classList && el.classList.contains("zen-app-tile")))) return;
      if (path.some(el => el.id === "navigator-toolbox" || el.id === "sidebar-box" || el.id === "PersonalToolbar" || el.id === "nav-bar")) return;
      if (path.some(el => (el.id && el.id.includes("sine")) || (el.className && typeof el.className === "string" && el.className.includes("sine")))) return;
      if (e.target.closest && (e.target.closest("#zen-app-panel-root") || e.target.closest("#zen-apps-sidebar-grid") || e.target.closest(".zen-app-tile"))) return;
      if (e.target.closest && (e.target.closest("#navigator-toolbox") || e.target.closest("#sidebar-box") || e.target.closest("#PersonalToolbar") || e.target.closest("#nav-bar"))) return;
      if (e.target.closest && (e.target.closest("[id*='sine']") || e.target.closest("[class*='sine']"))) return;
      
      console.log("[ZentralApps] handleOutsideClick closing panel due to click target:", e.target?.tagName, e.target?.id, e.target?.className);
      this.closePanel();
    }

    /**
     * Repositions app grid container between vertical sidebar or horizontal toolbar based on Zen layout mode.
     */
    repositionGrid() {
      const grid = this.#dom.grid;
      if (!grid) return;
      try {
        const isCollapsed = this.isCollapsedSidebar();
        
        if (isCollapsed) {
          const bookmarksContainer = document.getElementById("personal-bookmarks") || document.getElementById("PlacesToolbarItems");
          const topToolbar = document.getElementById("nav-bar-customization-target") || document.getElementById("nav-bar");
          
          grid.classList.add("zen-apps-horizontal");
          grid.style.order = "initial";
          
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

      window.addEventListener("TabSelect", () => {
        const currentWs = window.gZenWorkspaces?.activeWorkspace;
        if (this.#state.lastWorkspaceId !== currentWs) {
          this.#state.lastWorkspaceId = currentWs;
          this.renderGrid();
        }
      });

      const sideObserver = new window.MutationObserver((mutations) => {
        let shouldReposition = false;
        let shouldRender = false;
        for (const m of mutations) {
          if (m.attributeName === "zen-right-side") {
            shouldRender = true;
            shouldReposition = true;
          }
          if (m.attributeName === "zen-sidebar-expanded" ||
              m.attributeName === "zen-sidebar-collapsed" ||
              m.attributeName === "zen-compact-mode" ||
              m.attributeName === "zen-single-toolbar" ||
              m.attributeName === "zen-has-hover") {
            shouldReposition = true;
          }
        }
        if (shouldReposition) this.repositionGrid();
        if (shouldRender) this.renderGrid();
        if (this.#state.activeAppId && this.#dom.root?.hasAttribute("open")) this.positionPanel();
      });
      sideObserver.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: [
          "zen-right-side",
          "zen-sidebar-expanded",
          "zen-sidebar-collapsed",
          "zen-compact-mode",
          "zen-single-toolbar",
          "zen-has-hover"
        ] 
      });

      const layoutObserver = (subject, topic, data) => {
        if (data === "zen.view.use-single-toolbar" || 
            data === "zen.view.sidebar-expanded" || 
            data === "zen.view.compact" ||
            data === "zen.tabs.vertical") {
          setTimeout(this.repositionGrid, 50);
          setTimeout(this.repositionGrid, 250);
        }
      };
      Services.prefs.addObserver("zen.view.use-single-toolbar", layoutObserver, false);
      Services.prefs.addObserver("zen.view.sidebar-expanded", layoutObserver, false);
      try { Services.prefs.addObserver("zen.view.compact", layoutObserver, false); } catch (_) {}
      try { Services.prefs.addObserver("zen.tabs.vertical", layoutObserver, false); } catch (_) {}

      // Clean up pref observers when window closes to prevent ghost observers (H-03)
      window.addEventListener("unload", () => {
        try { Services.prefs.removeObserver("zen.view.use-single-toolbar", layoutObserver); } catch (_) {}
        try { Services.prefs.removeObserver("zen.view.sidebar-expanded", layoutObserver); } catch (_) {}
        try { Services.prefs.removeObserver("zen.view.compact", layoutObserver); } catch (_) {}
        try { Services.prefs.removeObserver("zen.tabs.vertical", layoutObserver); } catch (_) {}
        this.stopPositionTracking();
      }, { once: true });

      setTimeout(this.repositionGrid, 100);
      setTimeout(this.repositionGrid, 400);
    }
  }
  /* ============================================================================
   * 4.0 TAB GROUPS MODULE (ZentralTabGroups)
   * ============================================================================
   */

  /**
   * Zentral Tab Groups Module
   * Enhances native tab groups with color pickers, folder integration, tooltips, and state persistence.
   */
  class ZentralTabGroups {
    /**
     * Module tear down for Sine hot unloading
     */
    destroy() {
      try {
        const els = ["zs-tabgroup-style", "zs-tabgroup-color-picker", "zs-tabgroup-context-menu"];
        els.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.remove();
        });
        if (this.#state && this.#state.saveStateTimer) {
          clearTimeout(this.#state.saveStateTimer);
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
          // User is hovering the popup or label — keep it open!
          return;
        }

        panel.hidePopup();
      }, delayMs);
    }

    /**
     * Initializes Tab Groups module observers, styles, color palettes, and tooltip containers.
     */
    init() {
      if (!Core.getPref(Constants.TabGroups.PREF_ENABLED)) {
        console.log("[ZentralTabGroups] Tab Groups feature is disabled.");
        return;
      }
      this.clearStoredColorData();
      this.loadSavedColors();
      this.injectStyles();
      this.setupObserver();
      this.addFolderContextMenuItems();
      this.removeBuiltinTabGroupMenu();
      this.enhanceTabContextMenu();
      this.processExistingGroups();
      
      setTimeout(() => this.processExistingGroups(), 1000);
      document.addEventListener("TabGroupCreate", (e) => this.onTabGroupCreate(e));

      // Collapsed Sidebar observer for Tab Groups
      const prefName = "zen.view.sidebar-expanded";
      const updateSidebarAttr = () => {
        try {
          const expanded = Core.getNativePref(prefName, true);
          const isCollapsed = !expanded || document.documentElement.getAttribute("zen-sidebar-collapsed") === "true";
          const tabContainer = document.getElementById("tabbrowser-tabs");
          if (tabContainer) {
            tabContainer.setAttribute("zentral-sidebar-collapsed", isCollapsed ? "true" : "false");
          }
          document.documentElement.setAttribute("zentral-sidebar-collapsed", isCollapsed ? "true" : "false");
        } catch (e) {}
      };
      updateSidebarAttr();
      Services.prefs.addObserver(prefName, updateSidebarAttr, false);
      // Clean up pref observer on window close to prevent ghost observers (H-03)
      window.addEventListener("unload", () => {
        try { Services.prefs.removeObserver(prefName, updateSidebarAttr); } catch (_) {}
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
          if (mutation.type === "attributes" && mutation.attributeName === "collapsed") {
            if (mutation.target.tagName?.toUpperCase() === "TAB-GROUP") needsSave = true;
            continue;
          }
          
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType !== Node.ELEMENT_NODE) continue;
              
              const tag = node.tagName?.toUpperCase();
              if (tag === "TAB-GROUP") needsSave = true;
              
              if (node.id === "tab-group-editor" || tag === "TABGROUP-MEU" || node.querySelector?.("#tab-group-editor, tabgroup-meu")) {
                this.removeBuiltinTabGroupMenu(node);
              }
              
              if (tag === "TAB-GROUP" && !node.hasAttribute("split-view-group")) {
                this.processGroup(node);
              }
              
              const childGroups = node.querySelectorAll?.("tab-group") || [];
              if (childGroups.length > 0) {
                needsSave = true;
                childGroups.forEach((group) => {
                  if (!group.hasAttribute("split-view-group")) this.processGroup(group);
                });
              }
            }
            
            for (const node of mutation.removedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && node.tagName?.toUpperCase() === "TAB-GROUP") {
                needsSave = true;
                // Disconnect the per-group style MutationObserver to prevent memory leak
                const obs = this.#groupObservers.get(node);
                if (obs) { obs.disconnect(); this.#groupObservers.delete(node); }
                // Clear from processedGroups so it can be re-processed if re-created
                this.#processedGroups.delete(node);
              }
            }
          }
        }
        
        if (needsSave) this.scheduleStateSave();
      });
      const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;
      observer.observe(tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["collapsed"] });
    }

    /* --------------------------------------------------------------------------
     * 4.5 Custom Tooltips & Context Menus
     * --------------------------------------------------------------------------
     */

    /**
     * Removes builtin native tab group context menus to prevent UI redundancy.
     * @param {Element|Document} [root=document] - Container scope to scan.
     */
    removeBuiltinTabGroupMenu(root = document) {
      try {
        const list = root.querySelectorAll ? root.querySelectorAll("#tab-group-editor, tabgroup-meu") : [];
        list.forEach(el => el.remove());
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
      if (this.#processedGroups.has(group) || group.classList.contains("zen-folder") || group.hasAttribute("zen-folder") || group.hasAttribute("split-view-group")) {
        return;
      }
      group.style.setProperty("border-radius", "6px", "important");

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
      const labelContainer = group.querySelector(".tab-group-label-container");
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

        // Labels are always full-width — no hover expand/collapse needed.
        
        let hoverTimer = null;
        labelContainer.addEventListener("mouseenter", () => {
          if (!Core.getPref(Constants.TabGroups.PREF_THUMBNAILS)) return;
          labelContainer.setAttribute("zentral-hover", "true");
          hoverTimer = setTimeout(() => {
            const panel = document.getElementById("zentral-tabgroup-tooltip");
            const container = document.getElementById("zentral-tabgroup-tooltip-container");
            if (panel && container && group) {
              let tabs = group.tabs ? Array.from(group.tabs) : [];
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
      if (this.#state.sharedContextMenu) return this.#state.sharedContextMenu;

      if (window.MozXULElement?.parseXULToFragment) {
        const frag = window.MozXULElement.parseXULToFragment(`
          <menupopup id="advanced-tab-groups-context-menu">
            <menu class="change-group-color" label="Change Group Color"><menupopup><menuitem class="set-group-color" label="Set Group Color"/><menuitem class="use-favicon-color" label="Average Group's Color"/></menupopup></menu>
            <menuitem class="rename-group" label="Rename Group"/>
            <menuseparator/>
            <menuitem class="ungroup-tabs" label="Ungroup Tabs"/>
          </menupopup>
        `);
        const contextMenu = frag.firstElementChild;
        document.body.appendChild(contextMenu);

        contextMenu.querySelector(".set-group-color")?.addEventListener("command", (e) => {
          if (this.#state.contextMenuCurrentGroup) {
             const picker = this.ensureColorPickerPanel();
             if (picker) {
                picker.openPopupAtScreen(this.#state.lastContextMenuX || 0, this.#state.lastContextMenuY || 0, false);
                picker._currentGroup = this.#state.contextMenuCurrentGroup;
                const currentColor = picker._currentGroup.style.getPropertyValue("--tab-group-color").trim() || "#2b2b2b";
                const hex = currentColor.startsWith("#") && currentColor.length >= 7 ? currentColor.substring(0,7) : "#2b2b2b";
                picker.querySelector("#ztg-input-hex").value = hex;
                const bigint = parseInt(hex.slice(1), 16);
                const rgbInput = picker.querySelector("#ztg-input-rgb");
                if (rgbInput) rgbInput.value = `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
                const nativeColorInput = picker.querySelector("#ztg-native-color");
                if (nativeColorInput) nativeColorInput.value = hex;
             }
          }
        });
        contextMenu.querySelector(".use-favicon-color")?.addEventListener("command", () => {
          if (this.#state.contextMenuCurrentGroup?._useFaviconColor) this.#state.contextMenuCurrentGroup._useFaviconColor();
        });
        contextMenu.querySelector(".rename-group")?.addEventListener("command", () => {
          if (this.#state.contextMenuCurrentGroup) this.renameGroupStart(this.#state.contextMenuCurrentGroup);
        });
        contextMenu.querySelector(".ungroup-tabs")?.addEventListener("command", () => {
          if (this.#state.contextMenuCurrentGroup?.ungroupTabs) this.#state.contextMenuCurrentGroup.ungroupTabs();
        });

        contextMenu.addEventListener("popuphidden", () => { 
           // do not nullify current group here so the color picker can still reference it if needed
        });
        this.#state.sharedContextMenu = contextMenu;
        return contextMenu;
      }
      return null;
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
      if (this.#state.colorPickerPanel) return this.#state.colorPickerPanel;
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

      const panel = frag.firstElementChild;
      document.body.appendChild(panel);

      // High-Performance RAF Panel Dragging Logic (0 Lag)
      const dragHandle = panel.querySelector("#ztg-drag-handle");
      let isDraggingPanel = false;
      let startPanelX = 0;
      let startPanelY = 0;
      let startMouseX = 0;
      let startMouseY = 0;
      let targetX = 0;
      let targetY = 0;
      let dragRafId = null;

      const updateDragPosition = () => {
        if (!isDraggingPanel) return;
        if (typeof panel.moveTo === "function") {
          panel.moveTo(targetX, targetY);
        } else {
          panel.style.left = targetX + "px";
          panel.style.top = targetY + "px";
        }
        dragRafId = null;
      };

      if (dragHandle) {
        dragHandle.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          isDraggingPanel = true;
          startMouseX = e.screenX;
          startMouseY = e.screenY;

          const rect = panel.getBoundingClientRect();
          startPanelX = panel.screenX !== undefined ? panel.screenX : window.screenX + rect.left;
          startPanelY = panel.screenY !== undefined ? panel.screenY : window.screenY + rect.top;
          targetX = startPanelX;
          targetY = startPanelY;

          e.preventDefault();
          e.stopPropagation();
        });

        window.addEventListener("mousemove", (e) => {
          if (!isDraggingPanel) return;
          const dx = e.screenX - startMouseX;
          const dy = e.screenY - startMouseY;
          targetX = startPanelX + dx;
          targetY = startPanelY + dy;

          if (!dragRafId) {
            dragRafId = requestAnimationFrame(updateDragPosition);
          }
        });

        window.addEventListener("mouseup", () => {
          isDraggingPanel = false;
          if (dragRafId) {
            cancelAnimationFrame(dragRafId);
            dragRafId = null;
          }
        });
      }

      const applyColor = (hex) => {
        if (!panel._currentGroup) return;
        panel._currentGroup.style.setProperty("--tab-group-color", hex);
        panel._currentGroup.style.setProperty("--tab-group-color-invert", hex);
        panel._currentGroup.style.setProperty("--zentral-custom-color", hex);
        panel._currentGroup.style.setProperty("--zentral-tabgroup-contrast-color", this.getContrastColor(hex));
        panel._currentGroup.style.setProperty("--atg-contrast-color", this.getContrastColor(hex));
        panel.querySelector("#ztg-input-hex").value = hex;
        const bigint = parseInt(hex.slice(1), 16);
        panel.querySelector("#ztg-input-rgb").value = `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
        this.saveTabGroupColors();
      };

      panel.querySelector("#ztg-palette-container").addEventListener("click", (e) => {
        if (e.target.classList.contains("zentral-color-swatch")) {
          applyColor(e.target.dataset.color);
        }
      });

      // Canvas Color Spectrum initialization
      const satValCanvas = panel.querySelector("#ztg-satval-canvas");
      const hueCanvas = panel.querySelector("#ztg-hue-canvas");
      let currentHue = 0;

      const drawHueCanvas = () => {
        const ctx = hueCanvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, hueCanvas.width, 0);
        grad.addColorStop(0, "#ff0000");
        grad.addColorStop(0.17, "#ffff00");
        grad.addColorStop(0.33, "#00ff00");
        grad.addColorStop(0.50, "#00ffff");
        grad.addColorStop(0.67, "#0000ff");
        grad.addColorStop(0.83, "#ff00ff");
        grad.addColorStop(1, "#ff0000");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
      };

      const drawSatValCanvas = (hue) => {
        const ctx = satValCanvas.getContext("2d");
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);

        const whiteGrad = ctx.createLinearGradient(0, 0, satValCanvas.width, 0);
        whiteGrad.addColorStop(0, "#ffffff");
        whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = whiteGrad;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);

        const blackGrad = ctx.createLinearGradient(0, 0, 0, satValCanvas.height);
        blackGrad.addColorStop(0, "rgba(0,0,0,0)");
        blackGrad.addColorStop(1, "#000000");
        ctx.fillStyle = blackGrad;
        ctx.fillRect(0, 0, satValCanvas.width, satValCanvas.height);
      };

      let isDraggingSatVal = false;
      let isDraggingHue = false;

      const pickSatValColor = (e) => {
        const rect = satValCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, satValCanvas.width - 1));
        const y = Math.max(0, Math.min(e.clientY - rect.top, satValCanvas.height - 1));
        const ctx = satValCanvas.getContext("2d");
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
        applyColor(hex);
      };

      const pickHueColor = (e) => {
        const rect = hueCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, hueCanvas.width - 1));
        currentHue = Math.round((x / hueCanvas.width) * 360);
        drawSatValCanvas(currentHue);
        pickSatValColor({ clientX: rect.left + satValCanvas.width / 2, clientY: rect.top + satValCanvas.height / 2 });
      };

      satValCanvas.addEventListener("mousedown", (e) => { isDraggingSatVal = true; pickSatValColor(e); });
      hueCanvas.addEventListener("mousedown", (e) => { isDraggingHue = true; pickHueColor(e); });

      // Convert to named functions so they can be removed on window unload (C-03).
      // Anonymous arrow functions added to window can never be removed, causing a
      // permanent mousemove listener that runs for the entire browser session.
      const onSatHueMouseMove = (e) => {
        if (isDraggingSatVal) pickSatValColor(e);
        if (isDraggingHue) pickHueColor(e);
      };
      const onSatHueMouseUp = () => {
        isDraggingSatVal = false;
        isDraggingHue = false;
      };
      window.addEventListener("mousemove", onSatHueMouseMove);
      window.addEventListener("mouseup", onSatHueMouseUp);
      window.addEventListener("unload", () => {
        window.removeEventListener("mousemove", onSatHueMouseMove);
        window.removeEventListener("mouseup", onSatHueMouseUp);
      }, { once: true });

      panel.querySelector("#ztg-btn-auto").addEventListener("click", () => {
        if (panel._currentGroup && typeof panel._currentGroup._useFaviconColor === "function") {
          panel._currentGroup._useFaviconColor();
          const currentColor = panel._currentGroup.style.getPropertyValue("--tab-group-color").trim();
          if (currentColor) {
            const hex = currentColor.startsWith("#") && currentColor.length >= 7 ? currentColor.substring(0, 7) : currentColor;
            panel.querySelector("#ztg-input-hex").value = hex;
            if (hex.startsWith("#") && hex.length === 7) {
              const bigint = parseInt(hex.slice(1), 16);
              const rgbInput = panel.querySelector("#ztg-input-rgb");
              if (rgbInput) rgbInput.value = `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
            }
          }
        }
      });

      panel.querySelector("#ztg-btn-wheel").addEventListener("click", () => {
        const paletteContainer = panel.querySelector("#ztg-palette-container");
        const wheelContainer = panel.querySelector("#ztg-wheel-container");
        const btn = panel.querySelector("#ztg-btn-wheel");

        if (wheelContainer.style.display === "none") {
          wheelContainer.style.display = "flex";
          paletteContainer.style.display = "none";
          btn.textContent = "Palette";
          drawHueCanvas();
          drawSatValCanvas(currentHue);
        } else {
          wheelContainer.style.display = "none";
          paletteContainer.style.display = "grid";
          btn.textContent = "Wheel";
        }
      });

      panel.querySelector("#ztg-btn-pick").addEventListener("click", () => {
        panel.hidePopup();
        try {
          const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          canvas.style.position = "fixed";
          canvas.style.top = "0";
          canvas.style.left = "0";
          canvas.style.zIndex = "2147483647";
          canvas.style.cursor = "crosshair";

          const ctx = canvas.getContext("2d");
          ctx.drawWindow(window, 0, 0, window.innerWidth, window.innerHeight, "rgb(255,255,255)");

          const loupe = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
          loupe.style.position = "fixed";
          loupe.style.width = "40px";
          loupe.style.height = "40px";
          loupe.style.borderRadius = "50%";
          loupe.style.border = "2px solid #ffffff";
          loupe.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
          loupe.style.pointerEvents = "none";
          loupe.style.zIndex = "2147483647";
          loupe.style.display = "none";

          document.documentElement.appendChild(canvas);
          document.documentElement.appendChild(loupe);

          const cleanup = () => {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            if (loupe.parentNode) loupe.parentNode.removeChild(loupe);
            window.removeEventListener("keydown", onKeyDown);
          };

          const onKeyDown = (e) => {
            if (e.key === "Escape") cleanup();
          };
          window.addEventListener("keydown", onKeyDown);

          canvas.addEventListener("mousemove", (e) => {
            loupe.style.display = "block";
            loupe.style.left = `${e.clientX + 15}px`;
            loupe.style.top = `${e.clientY + 15}px`;
            const p = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
            const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
            loupe.style.backgroundColor = hex;
          });

          canvas.addEventListener("click", (e) => {
            const p = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
            const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
            applyColor(hex);
            cleanup();
          });
        } catch (err) {
          console.error("Eyedropper drawWindow failed:", err);
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
     * Removes or cleans up native tab group context menus if present.
     */
    removeBuiltinTabGroupMenu() {
      try {
        const builtinMenu = document.getElementById("tabGroupContextMenu");
        if (builtinMenu) builtinMenu.remove();
      } catch (_) {}
    }

    /**
     * Enhances native tab context menu (#tabContextMenu) to ensure all existing
     * tab groups are populated and selectable when right-clicking tabs to add/move to group.
     */
    enhanceTabContextMenu() {
      const tabContextMenu = document.getElementById("tabContextMenu");
      if (!tabContextMenu || tabContextMenu._zentralEnhanced) return;
      tabContextMenu._zentralEnhanced = true;

      const populateSubMenu = (menuPopup) => {
        if (!menuPopup) return;
        const groups = Array.from(document.querySelectorAll("tab-group:not([split-view-group])"));
        groups.forEach(group => {
          const label = group.label || group.getAttribute("label");
          if (!group.id || !label) return;
          if (menuPopup.querySelector(`[zentral-group-id="${group.id}"]`)) return;

          const item = document.createXULElement("menuitem");
          item.setAttribute("zentral-group-id", group.id);
          item.setAttribute("label", label);
          item.setAttribute("class", "menuitem-iconic zentral-group-menuitem");
          const color = group.style.getPropertyValue("--tab-group-color") || group.style.getPropertyValue("--zentral-custom-color");
          if (color) {
            item.style.setProperty("--menu-icon-color", color);
          }
          item.addEventListener("command", (evt) => {
            evt.stopPropagation();
            const selectedTabs = gBrowser.selectedTabs || (gBrowser.selectedTab ? [gBrowser.selectedTab] : []);
            if (selectedTabs.length > 0) {
              if (typeof gBrowser.addTabToGroup === "function") {
                selectedTabs.forEach(t => gBrowser.addTabToGroup(t, group));
              } else if (typeof group.addTabs === "function") {
                group.addTabs(selectedTabs);
              }
            }
          });
          menuPopup.appendChild(item);
        });
      };

      tabContextMenu.addEventListener("popupshowing", (e) => {
        try {
          const subPopups = document.querySelectorAll("#context_tabToGroupPopup, #context_moveTabToGroupPopup, #context_zenTabToGroupPopup, .context-tab-to-group menupopup");
          subPopups.forEach(popup => populateSubMenu(popup));
        } catch (_) {}
      });
    }

    /**
     * Event listener handler triggered when a new tab group is created in the browser.
     * @param {CustomEvent} event - TabGroupCreate custom event object.
     */
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
      if (group._contextMenuAdded) return;
      group._contextMenuAdded = true;

      const sharedMenu = this.ensureSharedContextMenu();
      const labelContainer = group.querySelector(".tab-group-label-container");
      if (labelContainer) {
        labelContainer.removeAttribute("context");
        labelContainer.addEventListener("contextmenu", (event) => {
          event.preventDefault(); event.stopPropagation();
          this.#state.contextMenuCurrentGroup = group;
          this.#state.lastContextMenuX = event.screenX;
          this.#state.lastContextMenuY = event.screenY;
          sharedMenu?.openPopupAtScreen(event.screenX, event.screenY, false);
        });
      }
      group.removeAttribute("context");

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
                // Move tab element in DOM so it becomes a sibling of the group container
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
            });
          }

          // 3. Remove the group via the native API so Zen's internal registry stays consistent.
          // Fall back to raw DOM removal if the native API is unavailable.
          try {
            if (typeof gBrowser?.removeTabGroup === "function") {
              gBrowser.removeTabGroup(group);
            } else {
              setTimeout(() => { try { group.remove(); } catch (_) {} }, 50);
            }
          } catch (e) {
            setTimeout(() => { try { group.remove(); } catch (_) {} }, 50);
          }

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
        }
      } catch (e) {}
    }

    /**
     * Schedules debounced state save for tab groups to prevent excessive disk writes.
     */
    scheduleStateSave() {
      if (this.#state.saveStateTimer) clearTimeout(this.#state.saveStateTimer);
      this.#state.saveStateTimer = setTimeout(() => this.saveTabGroupState(), 1000);
    }

    /**
     * Serializes tab group hierarchy, parent relationships, and collapsed states to user preferences.
     */
    saveTabGroupState() {
      try {
        const state = {};
        document.querySelectorAll("tab-group:not([split-view-group])").forEach(group => {
          if (!group.id) return;

          // Nearest tab-group or zen-folder ancestor (null = top-level)
          const parent = group.parentElement?.closest("tab-group, zen-folder") ?? null;

          // Count ONLY tab-group siblings (not tabs or other elements) for a stable,
          // platform-independent index. This is the key fix for H-01:
          // previously Array.from(parent.children).indexOf(group) included tab nodes,
          // making indices unstable across restarts.
          const posContainer = parent || group.parentElement;
          const groupSiblings = posContainer
            ? Array.from(posContainer.children).filter(
                el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group")
              )
            : [];
          const index = groupSiblings.indexOf(group); // -1 should never occur for an existing child

          state[group.id] = {
            collapsed: group.hasAttribute("collapsed"),
            parentId: parent?.id ?? null,
            index,
          };
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
        const state = JSON.parse(stateStr);

        // Sort ascending by saved index. Use Infinity (not || 0) for unknown/new groups
        // so they go to the end rather than collapsing to position 0 — this was the
        // root cause of H-04: || 0 made index -1 and undefined indistinguishable.
        const groupsToProcess = Array.from(
          document.querySelectorAll("tab-group:not([split-view-group])")
        ).sort((a, b) => {
          const aIdx = state[a.id]?.index ?? Infinity;
          const bIdx = state[b.id]?.index ?? Infinity;
          return aIdx - bIdx;
        });

        // Pass 1: Reconstruct the DOM nesting for groups that have a saved parentId.
        // We only touch nested groups here; top-level order is handled by the native
        // session-restore which Zentral cannot and should not override.
        groupsToProcess
          .filter(g => state[g.id]?.parentId)
          .forEach(group => {
            const groupState = state[group.id];
            const parent = document.getElementById(groupState.parentId);
            if (!parent || group.contains(parent)) return; // Guard: avoid circular nesting

            // Build the reference sibling list from tab-group children ONLY (not tabs).
            // Exclude the group itself from the list so the target index is stable.
            const freshGroupChildren = Array.from(parent.children).filter(
              el =>
                el.tagName?.toLowerCase() === "tab-group" &&
                !el.hasAttribute("split-view-group") &&
                el !== group
            );

            const targetIndex = groupState.index ?? freshGroupChildren.length;

            // Skip if already nested at the correct position
            const alreadyInParent = group.parentElement === parent;
            if (alreadyInParent) {
              const currentIdx = Array.from(parent.children)
                .filter(
                  el => el.tagName?.toLowerCase() === "tab-group" && !el.hasAttribute("split-view-group")
                )
                .indexOf(group);
              if (currentIdx === targetIndex) return;
            }

            // Insert before the target sibling, or append if at the end
            const refSibling = freshGroupChildren[targetIndex] ?? null;
            if (refSibling) {
              parent.insertBefore(group, refSibling);
            } else {
              parent.appendChild(group);
            }
          });

        // Pass 2: Restore collapsed states.
        groupsToProcess.forEach(group => {
          if (!group.id) return;
          const groupState = state[group.id];
          if (!groupState) return;

          if (forceCollapse) {
            if (!group.hasAttribute("collapsed")) {
              group.setAttribute("collapsed", "true");
            }
          } else {
            if (groupState.collapsed && !group.hasAttribute("collapsed")) {
              group.setAttribute("collapsed", "true");
            } else if (!groupState.collapsed && group.hasAttribute("collapsed")) {
              group.removeAttribute("collapsed");
            }
          }
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
      if (this.modal) {
        if (this.close) this.close();
        if (this.modal.parentNode) this.modal.remove();
        this.modal = null;
      }
    }
    
    /* --------------------------------------------------------------------------
     * 5.2 Form Data Binding & Persistence
     * --------------------------------------------------------------------------
     */

    /**
     * Opens the Zentral settings modal dialog and populates form fields with current preferences.
     */
    open() {
      if (!this.modal) {
        this.createModal();
      } else {
        this.modal.style.display = "flex";
        this.populate();
      }
    }
    
    /**
     * Hides the settings modal dialog.
     */
    close() {
      if (this.modal) this.modal.style.display = "none";
    }
    
    /**
     * Reads preferences from ZentralCore and populates modal input fields and switches.
     */
    populate() {
      if (!this.modal) return;
      const get = (id) => this.modal.querySelector("#" + id);
      if (!get("zs-anim-speed")) return;
      get("zs-ag-enabled").checked = Core.getPref(Constants.Apps.PREF_ENABLED);
      if (get("zs-ag-compact-drawer")) get("zs-ag-compact-drawer").checked = Core.getPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED, false) === true;
      get("zs-anim-type").value = Core.getPref(Constants.Apps.PREF_ANIMATION_TYPE);
      get("zs-anim-speed").value = Core.getPref(Constants.Apps.PREF_ANIMATION_SPEED);
      get("zs-max-apps").value = Core.getPref(Constants.Apps.PREF_MAX_APPS);
      get("zs-apps-row").value = Core.getPref(Constants.Apps.PREF_APPS_PER_ROW);
      get("zs-max-rows").value = Core.getPref(Constants.Apps.PREF_MAX_ROWS);
      get("zs-tg-enabled").checked = Core.getPref(Constants.TabGroups.PREF_ENABLED);
      get("zs-tg-collapse").checked = Core.getPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH);
      get("zs-tg-thumbnails").checked = Core.getPref(Constants.TabGroups.PREF_THUMBNAILS);
      get("zs-tg-chevron").checked = Core.getPref(Constants.TabGroups.PREF_SHOW_CHEVRON) !== false;
      const opacity = Core.getPref(Constants.TabGroups.PREF_LABEL_OPACITY);
      if (get("zs-tg-opacity")) {
        get("zs-tg-opacity").value = opacity;
        if (get("zs-tg-opacity-val")) get("zs-tg-opacity-val").textContent = opacity + "%";
      }
    }
    
    /**
     * Reads form fields from modal UI, saves settings via ZentralCore, and triggers grid re-renders.
     */
    save() {
      if (!this.modal) return;
      const get = (id) => this.modal.querySelector("#" + id);
      Core.setPref(Constants.Apps.PREF_ENABLED, get("zs-ag-enabled").checked);
      if (get("zs-ag-compact-drawer")) Core.setPref(Constants.Apps.PREF_COMPACT_DRAWER_ENABLED, get("zs-ag-compact-drawer").checked);
      if (window.zentralApps) window.zentralApps.updateCompactDrawerState();
      Core.setPref(Constants.Apps.PREF_ANIMATION_TYPE, get("zs-anim-type").value);
      Core.setPref(Constants.Apps.PREF_ANIMATION_SPEED, parseInt(get("zs-anim-speed").value));
      Core.setPref(Constants.Apps.PREF_MAX_APPS, parseInt(get("zs-max-apps").value));
      Core.setPref(Constants.Apps.PREF_APPS_PER_ROW, parseInt(get("zs-apps-row").value));
      Core.setPref(Constants.Apps.PREF_MAX_ROWS, parseInt(get("zs-max-rows").value));
      Core.setPref(Constants.TabGroups.PREF_ENABLED, get("zs-tg-enabled").checked);
      Core.setPref(Constants.TabGroups.PREF_COLLAPSE_ON_LAUNCH, get("zs-tg-collapse").checked);
      Core.setPref(Constants.TabGroups.PREF_THUMBNAILS, get("zs-tg-thumbnails").checked);
      Core.setPref(Constants.TabGroups.PREF_SHOW_CHEVRON, get("zs-tg-chevron").checked);
      if (get("zs-tg-opacity")) {
        Core.setPref(Constants.TabGroups.PREF_LABEL_OPACITY, parseInt(get("zs-tg-opacity").value));
      }
      
      this.close();
      // Apply immediate UI updates
      if (window.Zentral?.Apps) window.Zentral.Apps.renderGrid();
      if (window.Zentral?.TabGroups) {
        window.Zentral.TabGroups.applyChevronPref();
        window.Zentral.TabGroups.applyLabelOpacityPref();
      }
    }
    
    /* --------------------------------------------------------------------------
     * 5.1 Modal UI Structure & Injection
     * --------------------------------------------------------------------------
     */

    /**
     * Injects CSS styles for settings modal, backdrop filters, toggles, and form controls.
     */
    injectStyles() {
      if (document.getElementById("zentral-settings-styles") || this._stylesInjected) return;
      this._stylesInjected = true;
      const css = `
        #zentral-settings-modal {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.45);
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
          background: var(--tabpanels-background-color, var(--in-content-page-background, #16161a));
          color: var(--in-content-page-color, #fbfbfe);
          width: 480px;
          max-width: 92vw;
          border-radius: 16px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px color-mix(in srgb, currentColor 10%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 12%, rgba(255, 255, 255, 0.08));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: zsModalPop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        .zs-header {
          padding: 16px 22px;
          border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: color-mix(in srgb, currentColor 2%, transparent);
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
        }

        .zs-close-btn {
          background: transparent;
          border: none;
          color: inherit;
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
          background: color-mix(in srgb, currentColor 12%, transparent);
        }

        .zs-body {
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          max-height: 72vh;
          scrollbar-width: thin;
        }

        .zs-section-title {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--zen-primary-color, #70a0ff);
          opacity: 0.9;
          margin: 6px 0 2px 0;
        }

        .zs-card {
          background: color-mix(in srgb, currentColor 3%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 6%, transparent);
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
        }

        .zs-sublabel {
          font-size: 11px;
          opacity: 0.6;
          margin-top: 2px;
        }

        .zs-input-number {
          width: 68px;
          background: color-mix(in srgb, currentColor 8%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
          border-radius: 8px;
          color: inherit;
          padding: 6px 8px;
          font-size: 13px;
          text-align: center;
          font-weight: 500;
          outline: none;
          transition: all 0.15s ease;
        }

        .zs-input-number:focus {
          border-color: var(--zen-primary-color, #70a0ff);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--zen-primary-color, #70a0ff) 30%, transparent);
        }

        .zs-select {
          width: 145px;
          background: color-mix(in srgb, var(--in-content-page-color, #fff) 8%, var(--in-content-page-background, #16161a));
          border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
          border-radius: 8px;
          color: inherit;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .zs-select:hover {
          border-color: color-mix(in srgb, currentColor 30%, transparent);
        }

        .zs-select:focus {
          border-color: var(--zen-primary-color, #70a0ff);
        }

        .zs-select option {
          background-color: var(--in-content-page-background, #16161a) !important;
          color: var(--in-content-page-color, #fbfbfe) !important;
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
          background-color: color-mix(in srgb, currentColor 18%, transparent);
          transition: background-color 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
          border-radius: 22px;
          border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
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
          background-color: var(--zen-primary-color, #0061e0);
          border-color: transparent;
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
          background: color-mix(in srgb, currentColor 18%, transparent);
          outline: none;
          cursor: pointer;
        }

        .zs-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--zen-primary-color, #70a0ff);
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
          opacity: 0.85;
        }

        .zs-reset-btn {
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 500;
          border-radius: 6px;
          background: color-mix(in srgb, currentColor 6%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
          color: inherit;
          cursor: pointer;
          opacity: 0.85;
          transition: all 0.15s ease;
          align-self: flex-end;
        }

        .zs-reset-btn:hover {
          opacity: 1;
          background: color-mix(in srgb, currentColor 12%, transparent);
        }

        .zs-footer {
          padding: 14px 22px;
          background: color-mix(in srgb, currentColor 2%, transparent);
          border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .zs-btn-cancel {
          padding: 7px 16px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
          color: inherit;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          opacity: 0.85;
          transition: all 0.15s ease;
        }

        .zs-btn-cancel:hover {
          opacity: 1;
          background: color-mix(in srgb, currentColor 8%, transparent);
        }

        .zs-btn-save {
          padding: 7px 20px;
          border-radius: 8px;
          background: var(--zen-primary-color, #0061e0);
          border: none;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px color-mix(in srgb, var(--zen-primary-color, #0061e0) 35%, transparent);
          transition: all 0.15s ease;
        }

        .zs-btn-save:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .zs-btn-save:active {
          transform: translateY(0);
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
     * Constructs and attaches the HTML modal dialog DOM elements to browser document.
     */
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
              <input type="number" id="zs-anim-speed" class="zs-input-number" />
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Max total apps</span>
              </div>
              <input type="number" id="zs-max-apps" class="zs-input-number" />
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Apps per row (max 10)</span>
              </div>
              <input type="number" id="zs-apps-row" class="zs-input-number" />
            </div>

            <div class="zs-row">
              <div class="zs-label-container">
                <span class="zs-label">Max rows before scroll</span>
              </div>
              <input type="number" id="zs-max-rows" class="zs-input-number" />
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

      this.modal.addEventListener("mousedown", (e) => {
        if (e.target === this.modal) this.close();
      });

      this.modal.querySelector("#zs-ag-reset").addEventListener("click", () => {
        const get = (id) => this.modal.querySelector("#" + id);
        get("zs-ag-enabled").checked = true;
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

  /* ============================================================================
   * 6.0 MASTER BOOTSTRAPPER & ENTRY POINT
   * ============================================================================
   */

  /**
   * Instantiate module singletons
   */
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