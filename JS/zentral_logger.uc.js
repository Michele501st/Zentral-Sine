// ==UserScript==
// @name         Zentral-Logger
// @description  Comprehensive diagnostic logger for Zentral (Apps Grid, Tab Groups, Settings & Layout Renderings).
// @author       Michele Pierini
// @version      v1.0.1
// @include      main
// ==/UserScript==

"use strict";

(function ZentralLoggerModule() {
  // Store true native console methods once on window singleton to prevent multi-wrapping on reload
  window._zentralNativeConsole = window._zentralNativeConsole || {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug || console.log).bind(console),
    info: (console.info || console.log).bind(console)
  };
  const _native = window._zentralNativeConsole;

  // Clean up any previously attached listeners and restore native console if reloading
  if (window._zentralLoggerCleanup && typeof window._zentralLoggerCleanup === "function") {
    try { window._zentralLoggerCleanup(); } catch (_) {}
  }

  let cleanupObservers = [];
  const MAX_ENTRIES = 8000;
  const ringBuffer = window._zentralLoggerRingBuffer || [];
  window._zentralLoggerRingBuffer = ringBuffer;
  let lastRecordedEvent = null;

  function tsFull() {
    const d = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function tsCompact() {
    const d = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function isLoggerEnabled() {
    try {
      return Services.prefs.getBoolPref("zen.workspace.zentral.debug", false);
    } catch (_) {
      return false;
    }
  }

  function isModuleEnabled(moduleName) {
    if (!isLoggerEnabled()) return false;
    if (moduleName === "core") return true;

    try {
      // If "Full Log" is active, all modules are enabled
      const isFull = Services.prefs.getBoolPref("zen.workspace.zentral.debug.full", true);
      if (isFull) return true;

      // Otherwise check the individual modular preference
      const prefKey = `zen.workspace.zentral.debug.${moduleName}`;
      return Services.prefs.getBoolPref(prefKey, false);
    } catch (_) {
      return true; // Safe fallback
    }
  }

  function classifyModuleFromTag(tag) {
    if (!tag) return "core";
    const t = String(tag).toLowerCase();
    if (t.includes("menu") || t.includes("popup")) return "menus";
    if (t.includes("drag") || t.includes("splitview") || t.includes("tabgroup") || t.includes("tabselect")) return "tabs";
    if (t.includes("app") || t.includes("grid") || t.includes("panel") || t.includes("tile") || t.includes("utility")) return "apps";
    if (t.includes("layout") || t.includes("css") || t.includes("inspector") || t.includes("root")) return "layout";
    return "core";
  }

  function showLoggingDisabledWarning() {
    try {
      const promptService = Services.prompt || Cc["@mozilla.org/embedcomp/prompt-service;1"]?.getService(Ci.nsIPromptService);
      if (promptService) {
        promptService.alert(
          window,
          "Zentral Diagnostics — Inactive",
          "Diagnostic Logging is currently disabled.\n\nTo capture and export diagnostic logs, please enable 'Enable Diagnostic Logging' in Zentral Settings first."
        );
        return;
      }
    } catch (_) {}
    alert("Diagnostic Logging is disabled.\nPlease enable 'Enable Diagnostic Logging' in Zentral Settings to export logs.");
  }

  function formatElementSelector(el) {
    if (!el || !el.tagName) return "(null)";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    return `<${tag}${id}${cls}>`;
  }

  function formatLogArg(a) {
    if (a === null) return "null";
    if (a === undefined) return "undefined";
    if (a instanceof Error || (typeof a === "object" && ("message" in a || "stack" in a))) {
      const name = a.name || "Error";
      const msg = a.message || String(a);
      const stack = a.stack ? `\nStack:\n${a.stack}` : "";
      return `${name}: ${msg}${stack}`;
    }
    if (typeof a === "object") {
      if (a instanceof HTMLElement || a instanceof Element) {
        return formatElementSelector(a);
      }
      try {
        return JSON.stringify(a, (key, value) => {
          if (value instanceof HTMLElement || value instanceof Element) {
            return formatElementSelector(value);
          }
          return value;
        });
      } catch (_) {
        return String(a);
      }
    }
    return String(a);
  }

  let isLoggingDirectly = false;

  function record(level, tag, rawMessage, explicitModule = null) {
    if (!isLoggerEnabled()) return; // DO NOT COLLECT DATA IF DISABLED
    const mod = explicitModule || classifyModuleFromTag(tag);
    if (!isModuleEnabled(mod)) return;

    let msg = String(rawMessage || "").trim();
    // Strip redundant leading [tag] or [mod] or [Zentral] from message
    const cleanPattern = new RegExp(`^\\[(${tag}|${mod}|Zentral-${tag}|Zentral|ZentralCore|ZentralApps|ZentralTabGroups|ZentralSettings)\\]\\s*`, 'i');
    while (cleanPattern.test(msg)) {
      msg = msg.replace(cleanPattern, '').trim();
    }

    const timeStr = tsCompact();
    const levelTag = (level === "warn" || level === "error" || level === "layout") ? ` [${level.toUpperCase()}]` : "";
    const header = `[${timeStr}]${levelTag} [${tag}]`;
    const formattedLine = `${header} ${msg}`;

    // Consecutive duplicate compression (e.g. rapid DOM mutations or repeated button clicks)
    if (lastRecordedEvent && lastRecordedEvent.tag === tag && lastRecordedEvent.level === level && lastRecordedEvent.msg === msg) {
      lastRecordedEvent.count++;
      ringBuffer[ringBuffer.length - 1] = `${header} ${msg} (repeated ${lastRecordedEvent.count}x)`;
      return;
    }

    lastRecordedEvent = { tag, level, msg, count: 1, time: timeStr };
    if (ringBuffer.length >= MAX_ENTRIES) ringBuffer.shift();
    ringBuffer.push(formattedLine);
  }

  /**
   * Main ZentralLogger API
   */
  const ZentralLogger = {
    isLoggerEnabled,
    isModuleEnabled,
    classifyModuleFromTag,
    formatElementSelector,
    log(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(tag);
      if (!isModuleEnabled(mod)) return;
      const msg = args.map(formatLogArg).join(" ");
      isLoggingDirectly = true;
      try { _native.log(`[${tag}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("log", tag, msg, mod);
    },
    warn(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(tag);
      if (!isModuleEnabled(mod)) return;
      const msg = args.map(formatLogArg).join(" ");
      isLoggingDirectly = true;
      try { _native.warn(`[${tag}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("warn", tag, msg, mod);
    },
    error(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(tag);
      if (!isModuleEnabled(mod)) return;
      const msg = args.map(formatLogArg).join(" ");
      isLoggingDirectly = true;
      try { _native.error(`[${tag}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("error", tag, msg, mod);
    },
    debug(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(tag);
      if (!isModuleEnabled(mod)) return;
      const msg = args.map(formatLogArg).join(" ");
      isLoggingDirectly = true;
      try { _native.debug(`[${tag}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("debug", tag, msg, mod);
    },
    info(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(tag);
      if (!isModuleEnabled(mod)) return;
      const msg = args.map(formatLogArg).join(" ");
      isLoggingDirectly = true;
      try { _native.info(`[${tag}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("info", tag, msg, mod);
    },
    layout(component, details) {
      if (!isLoggerEnabled()) return;
      const mod = classifyModuleFromTag(component) || "layout";
      if (!isModuleEnabled(mod)) return;
      const msg = typeof details === "object" ? JSON.stringify(details) : String(details);
      isLoggingDirectly = true;
      try { _native.log(`[Layout:${component}] ${msg}`); } finally { isLoggingDirectly = false; }
      record("layout", `Layout:${component}`, msg, mod);
    },
    inspectLayout() {
      if (!isLoggerEnabled() || !isModuleEnabled("layout")) return "";
      const snapshot = captureLayoutDiagnosticSnapshot();
      isLoggingDirectly = true;
      try { _native.log(snapshot); } finally { isLoggingDirectly = false; }
      record("info", "LayoutInspector", snapshot, "layout");
      return snapshot;
    },
    get entries() { return isLoggerEnabled() ? [...ringBuffer] : []; },
    dump()   { if (isLoggerEnabled()) ringBuffer.forEach(l => _native.log(l)); },
    export() { exportLog(); },
    generateLogString() { return generateLogString(); },
    clear()  { ringBuffer.length = 0; lastRecordedEvent = null; }
  };

  window.ZentralLogger = ZentralLogger;
  window.ZenzeiLogger = ZentralLogger;     // Backward compatibility alias
  window.ZenTabPeekLogger = ZentralLogger; // Backward compatibility alias

  // -------------------------------------------------------------------------
  // Intercept standard console outputs
  // -------------------------------------------------------------------------
  function patchConsoleMethod(nativeFn, level) {
    return function (...args) {
      nativeFn(...args);
      if (!isLoggerEnabled() || isLoggingDirectly) return; // Ignore if called from inside ZentralLogger
      const text = args.map(formatLogArg).join(" ");
      let tag = "Console";
      const tagMatch = text.match(/^\[(.*?)\]/);
      if (tagMatch) {
        tag = tagMatch[1];
      }
      record(level, tag, text);
    };
  }

  console.log   = patchConsoleMethod(_native.log,   "log");
  console.warn  = patchConsoleMethod(_native.warn,  "warn");
  console.error = patchConsoleMethod(_native.error, "error");
  console.debug = patchConsoleMethod(_native.debug, "debug");
  console.info  = patchConsoleMethod(_native.info,  "info");

  cleanupObservers.push(() => {
    console.log   = _native.log;
    console.warn  = _native.warn;
    console.error = _native.error;
    console.debug = _native.debug;
    console.info  = _native.info;
  });

  // Capture uncaught window errors & rejections
  const onWinError = (e) => {
    if (!isLoggerEnabled()) return;
    const msg = e.message || e.error?.message || e.error?.name || "Unknown Script Error";
    const src = e.filename || e.error?.fileName || e.error?.filename || "unknown-source";
    const line = e.lineno || e.error?.lineNumber || e.error?.lineno || 0;
    const col = e.colno || e.error?.columnNumber || e.error?.colno || 0;
    const stack = e.error?.stack ? `\nStack: ${e.error.stack}` : "";
    record("error", "WindowError", `Uncaught ${msg} @ ${src}:${line}:${col}${stack}`);
  };

  const onUnhandledRej = (e) => {
    if (!isLoggerEnabled()) return;
    const reason = e.reason;
    const text = reason instanceof Error ? `${reason.name}: ${reason.message}\nStack: ${reason.stack}` : (reason?.message || String(reason));
    record("error", "UnhandledRejection", `Reason: ${text}`);
  };

  window.addEventListener("error", onWinError, true);
  window.addEventListener("unhandledrejection", onUnhandledRej, true);
  cleanupObservers.push(() => {
    window.removeEventListener("error", onWinError, true);
    window.removeEventListener("unhandledrejection", onUnhandledRej, true);
  });

  // -------------------------------------------------------------------------
  // Intercept XPCOM Gecko Console Warnings & Errors
  // -------------------------------------------------------------------------
  try {
    const consoleListener = {
      observe(msg) {
        if (!isLoggerEnabled()) return;
        try {
          if (msg instanceof Ci.nsIScriptError) {
            const sourceName = msg.sourceName || "";
            const errorMessage = msg.errorMessage || "";
            const isWarning = (msg.flags & Ci.nsIScriptError.warningFlag) !== 0;
            const level = isWarning ? "warn" : "error";
            
            const isRelevant = /zentral|tabgroup|tab-group|splitview|workspace|sine|drag-and-drop|pagethumb/i.test(sourceName) ||
                               /zentral|tabgroup|tab-group|splitview|zen\.workspace|draganddrop/i.test(errorMessage) ||
                               sourceName.includes("Zentral.uc.js") ||
                               sourceName.includes("zentral_logger.uc.js");

            if (isRelevant) {
              record(level, isWarning ? "GeckoWarning" : "GeckoScriptError", `${errorMessage} @ ${sourceName}:${msg.lineNumber}:${msg.columnNumber}`);
            }
          } else if (msg instanceof Ci.nsIConsoleMessage) {
            const text = msg.message || "";
            if (/zentral|tabgroup|tab-group|splitview|zen\.workspace|drag/i.test(text)) {
              record("warn", "GeckoConsole", text);
            }
          }
        } catch (_) {}
      },
      QueryInterface: ChromeUtils.generateQI(["nsIConsoleListener"])
    };
    Services.console.registerListener(consoleListener);
    cleanupObservers.push(() => {
      try {
        Services.console.unregisterListener(consoleListener);
      } catch (_) {}
    });
  } catch (_) {}

  // -------------------------------------------------------------------------
  // Layout & DOM Diagnostic Snapshots
  // -------------------------------------------------------------------------
  function captureLayoutDiagnosticSnapshot() {
    const lines = [];
    lines.push(`=== ZENTRAL LAYOUT DIAGNOSTIC SNAPSHOT (${tsFull()}) ===`);
    lines.push(`Window: ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio})`);
    
    // Root layout attributes
    const root = document.documentElement;
    const attrs = Array.from(root.attributes)
      .filter(a => a.name.startsWith("zen-") || a.name.startsWith("zentral-") || ["id", "sizemode", "data-l10n-sync"].includes(a.name))
      .map(a => `${a.name}="${a.value}"`)
      .join(" | "); 
    lines.push(`Root Attributes: ${attrs}`);
    
    // Apps Grid
    const grid = document.getElementById("zen-apps-sidebar-grid");
    if (grid) {
      const isHoriz = grid.classList.contains("zen-apps-horizontal");
      const rect = grid.getBoundingClientRect();
      const tiles = grid.querySelectorAll(".zen-app-tile");
      lines.push(`Apps Grid: Present | Mode: ${isHoriz ? "Horizontal (Toolbar)" : "Vertical (Sidebar)"} | Tiles: ${tiles.length} | Rect: ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)})`);
    } else {
      lines.push(`Apps Grid: Not found in DOM`);
    }

    // App Panels
    const panels = document.querySelectorAll(".zs-app-panel");
    if (panels.length) {
      lines.push(`App Panels Count: ${panels.length}`);
      panels.forEach((p, idx) => {
        const rect = p.getBoundingClientRect();
        lines.push(`  Panel #${idx + 1} (${p.id}): open="${p.hasAttribute("open")}" pinned="${p.getAttribute("data-pinned")}" rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
      });
    }

    // Tab Groups
    const tabGroups = Array.from(document.querySelectorAll("tab-group:not([split-view-group]):not([zen-split-view]):not([is-zen-split])"));
    lines.push(`Tab Groups Count: ${tabGroups.length}`);
    tabGroups.forEach((g, idx) => {
      const label = g.label || g.getAttribute("label") || "(no label)";
      const collapsed = g.hasAttribute("collapsed");
      const rect = g.getBoundingClientRect();
      const childTabs = g.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab").length;
      lines.push(`  Group #${idx + 1} "${label}" [id="${g.id || 'none'}"]: collapsed=${collapsed} tabs=${childTabs} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
    });

    // Split Views
    const splitViews = Array.from(document.querySelectorAll("tab-group[split-view-group], tab-group[zen-split-view], tab-group[is-zen-split]"));
    if (splitViews.length) {
      lines.push(`Split Views Count: ${splitViews.length}`);
      splitViews.forEach((s, idx) => {
        const rect = s.getBoundingClientRect();
        const childTabs = s.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab").length;
        lines.push(`  Split View #${idx + 1} [id="${s.id || 'none'}"]: tabs=${childTabs} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
      });
    }

    // Modal & Context Menus
    const tabCtx = document.getElementById("tabContextMenu");
    const modal = document.getElementById("zentral-settings-modal");
    lines.push(`DOM Components: TabCtxMenu=${tabCtx ? `Present(${tabCtx.children.length})` : 'Missing'} | SettingsModal=${modal ? 'Open' : 'Closed'}`);

    // =========================================================================
    // Sidebar & Compact Mode Material / Theme Inspector
    // =========================================================================
    lines.push(`\n=== SIDEBAR & COMPACT MODE MATERIAL / THEME INSPECTOR ===`);
    
    // 1. Relevant CSS Custom Properties on :root (filter to zen & zentral tokens)
    try {
      const rootCS = window.getComputedStyle(document.documentElement);
      const cssVars = [];
      for (let i = 0; i < rootCS.length; i++) {
        const prop = rootCS[i];
        if (prop.startsWith("--zen-") || prop.startsWith("--zentral-") || prop.startsWith("--tab-group-") || prop.startsWith("--toolbox-") || prop.startsWith("--toolbar-background-color")) {
          const val = rootCS.getPropertyValue(prop)?.trim();
          if (val) cssVars.push(`  ${prop}: ${val}`);
        }
      }
      lines.push(`CSS Variables on :root (${cssVars.length}):\n${cssVars.join("\n") || "  (none)"}`);
    } catch (e) {
      lines.push(`CSS Variables on :root: Error reading variables (${e.message})`);
    }

    // 2. Element-by-Element Computed Style Dumps (Clean single-line format, omit defaults)
    const inspectIds = [
      "main-window",
      "navigator-toolbox",
      "sidebar-box",
      "browserSidebarContainer",
      "sidebar-container",
      "vertical-tabs",
      "tabbrowser-tabbox",
      "tabbrowser-tabs",
      "browser",
      "tabbrowser-tabpanels",
      "TabsToolbar",
      "nav-bar",
      "zen-appcontent-navbar-wrapper",
      "zen-main-app-wrapper",
      "titlebar",
      "zen-sidebar-top-buttons",
      "zen-sidebar-bottom-buttons",
      "zen-current-workspace-indicator",
      "zen-apps-sidebar-grid"
    ];

    inspectIds.forEach(id => {
      try {
        let el = (id === "main-window") ? document.documentElement : document.getElementById(id);
        if (!el) el = document.querySelector("." + id);
        if (!el) return;

        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const activeStyles = [];

        const hasBgColor = cs.backgroundColor && cs.backgroundColor !== "transparent" && cs.backgroundColor !== "rgba(0, 0, 0, 0)";
        const hasBgImage = cs.backgroundImage && cs.backgroundImage !== "none";
        if (hasBgColor) activeStyles.push(`bg-color: ${cs.backgroundColor}`);
        if (hasBgImage) activeStyles.push(`bg-image: ${cs.backgroundImage}`);
        if (cs.backdropFilter && cs.backdropFilter !== "none") activeStyles.push(`backdrop: ${cs.backdropFilter}`);
        if (cs.boxShadow && cs.boxShadow !== "none") activeStyles.push(`shadow: ${cs.boxShadow}`);
        if (cs.border && !cs.border.startsWith("0px")) activeStyles.push(`border: ${cs.border}`);
        if (cs.borderRadius && cs.borderRadius !== "0px") activeStyles.push(`radius: ${cs.borderRadius}`);
        if (cs.opacity && cs.opacity !== "1") activeStyles.push(`opacity: ${cs.opacity}`);
        if (cs.position && cs.position !== "static") activeStyles.push(`pos: ${cs.position} (z-index: ${cs.zIndex})`);

        lines.push(`\n[Element: ${formatElementSelector(el)}] Rect: ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)})`);
        if (activeStyles.length) lines.push(`  Styles: ${activeStyles.join(" | ")}`);

        // Check ::before pseudo-element
        try {
          const csBefore = window.getComputedStyle(el, "::before");
          if (csBefore && csBefore.content && csBefore.content !== "none") {
            lines.push(`  ::before -> content: ${csBefore.content} | bg: ${csBefore.backgroundColor || csBefore.background} | backdrop: ${csBefore.backdropFilter}`);
          }
        } catch (_) {}

        // Check ::after pseudo-element
        try {
          const csAfter = window.getComputedStyle(el, "::after");
          if (csAfter && csAfter.content && csAfter.content !== "none") {
            lines.push(`  ::after -> content: ${csAfter.content} | bg: ${csAfter.backgroundColor || csAfter.background} | backdrop: ${csAfter.backdropFilter}`);
          }
        } catch (_) {}
      } catch (_) {}
    });

    // 3. Descendants of #navigator-toolbox with actual visible backgrounds / filters / shadows
    try {
      const toolbox = document.getElementById("navigator-toolbox");
      if (toolbox) {
        const visualDescendants = [];
        const allDescendants = toolbox.querySelectorAll("*");
        allDescendants.forEach(child => {
          try {
            const cs = window.getComputedStyle(child);
            const hasBg = (cs.backgroundColor && cs.backgroundColor !== "transparent" && cs.backgroundColor !== "rgba(0, 0, 0, 0)") ||
                          (cs.backgroundImage && cs.backgroundImage !== "none") ||
                          (cs.backdropFilter && cs.backdropFilter !== "none") ||
                          (cs.boxShadow && cs.boxShadow !== "none");
            if (hasBg || ["titlebar", "TabsToolbar", "nav-bar", "vertical-tabs"].includes(child.id)) {
              visualDescendants.push(`  ${formatElementSelector(child)} -> bg: ${cs.backgroundColor || cs.background} | shadow: ${cs.boxShadow} | backdrop: ${cs.backdropFilter}`);
            }
          } catch (_) {}
        });
        if (visualDescendants.length) {
          lines.push(`\n=== NAVIGATOR-TOOLBOX VISUAL DESCENDANTS (${visualDescendants.length}) ===`);
          lines.push(visualDescendants.join("\n"));
        }
      }
    } catch (_) {}

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Real-time Layout & DOM Observers
  // -------------------------------------------------------------------------

  function setupLayoutObservers() {
    // 1. Root & Sidebar Layout Attribute Observer
    const rootObserver = new MutationObserver((mutations) => {
      if (!isLoggerEnabled()) return;
      for (const m of mutations) {
        if (["zen-right-side", "zen-sidebar-collapsed", "zen-single-toolbar", "zentral-label-opacity-below-85"].includes(m.attributeName)) {
          const val = document.documentElement.getAttribute(m.attributeName);
          ZentralLogger.layout("Root", `Attribute "${m.attributeName}" -> "${val}"`);
        }
      }
    });
    rootObserver.observe(document.documentElement, { attributes: true });
    cleanupObservers.push(() => rootObserver.disconnect());

    // 2. Apps Grid Observer
    const grid = document.getElementById("zen-apps-sidebar-grid");
    if (grid) {
      const gridObserver = new MutationObserver((mutations) => {
        if (!isLoggerEnabled()) return;
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "class") {
            const isHoriz = grid.classList.contains("zen-apps-horizontal");
            ZentralLogger.layout("AppsGrid", `Horizontal layout: ${isHoriz}`);
          } else if (m.type === "childList") {
            ZentralLogger.layout("AppsGrid", `Grid tiles updated (+${m.addedNodes.length}, -${m.removedNodes.length})`);
          }
        }
      });
      gridObserver.observe(grid, { attributes: true, childList: true, subtree: false });
      cleanupObservers.push(() => gridObserver.disconnect());
      if (isLoggerEnabled()) {
        ZentralLogger.layout("AppsGrid", "Apps Grid observer attached.");
      }
    }

    // 3. Tab Groups Observer
    const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;
    const tabGroupObserver = new MutationObserver((mutations) => {
      if (!isLoggerEnabled()) return;
      for (const m of mutations) {
        if (m.target.tagName?.toUpperCase() === "TAB-GROUP") {
          const group = m.target;
          const label = group.label || group.getAttribute("label") || "(no title)";
          const collapsed = group.hasAttribute("collapsed");
          ZentralLogger.layout("TabGroup", `Group "${label}" attr "${m.attributeName}" -> collapsed: ${collapsed}`);
        } else if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.tagName?.toUpperCase() === "TAB-GROUP") {
              ZentralLogger.layout("TabGroup", `New Tab Group added: "${node.label || node.getAttribute("label") || "Group"}"`);
            }
          }
        }
      }
    });
    if (tabContainer) {
      tabGroupObserver.observe(tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["collapsed", "label", "style", "class"] });
      cleanupObservers.push(() => tabGroupObserver.disconnect());
    }
  }

  // -------------------------------------------------------------------------
  // Tab Context Menu & Right-Click Diagnostic Tracer
  // -------------------------------------------------------------------------
  function setupTabContextMenuTracer() {
    function dumpMenuChildren(popup, prefix = "  ") {
      if (!popup || !popup.children) return ["[Empty Popup]"];
      const lines = [];
      const children = Array.from(popup.children);
      lines.push(`${prefix}Total items: ${children.length}`);
      children.forEach((el, i) => {
        const sel = formatElementSelector(el);
        const label = el.getAttribute("label") || el.label || "";
        const text = el.textContent ? el.textContent.trim().replace(/\s+/g, " ") : "";
        const l10n = el.getAttribute("data-l10n-id") ? `[l10n=${el.getAttribute("data-l10n-id")}]` : "";
        const hidden = el.hidden || el.hasAttribute("hidden") || el.getAttribute("collapsed") === "true";
        const disabled = el.disabled || el.getAttribute("disabled") === "true";
        const zGroupId = el.getAttribute("zentral-group-id") ? `[group=${el.getAttribute("zentral-group-id")}]` : "";

        let details = `${prefix}[${i}] ${sel}${zGroupId}${l10n}`;
        if (label) details += ` label="${label}"`;
        else if (text) details += ` text="${text}"`;
        if (hidden) details += " (HIDDEN)";
        if (disabled) details += " (DISABLED)";

        lines.push(details);

        if (el.tagName.toLowerCase() === "menu") {
          const sub = el.querySelector("menupopup");
          if (sub) {
            lines.push(`${prefix}  -> Submenu <menupopup id="${sub.id || 'no-id'}"> (${sub.children.length} items)`);
          }
        }
      });
      return lines;
    }

    // 1. Capture Right-Clicks on Tabs and Tabstrip
    const onContextMenu = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const tab = target?.closest ? target.closest("tab, tabbrowser-tab, .tabbrowser-tab") : null;
      const group = target?.closest ? target.closest("tab-group:not([split-view-group])") : null;
      const tabStrip = target?.closest ? target.closest("#tabbrowser-tabs, .tabbrowser-tabs") : null;

      const tabInfo = tab ? {
        label: tab.label || tab.getAttribute("label") || "(unnamed tab)",
        selected: tab.selected || tab.hasAttribute("selected"),
        pinned: tab.pinned || tab.hasAttribute("pinned"),
        group: tab.group?.id || tab.getAttribute("group") || (tab.closest("tab-group")?.getAttribute("label") || "none")
      } : null;

      const groupInfo = group ? {
        id: group.id || "(no-id)",
        label: group.label || group.getAttribute("label") || "(no-label)",
        collapsed: group.hasAttribute("collapsed")
      } : null;

      ZentralLogger.log("Menu:RightClick", {
        target: formatElementSelector(target),
        coords: `(${e.clientX},${e.clientY})`,
        tab: tabInfo,
        group: groupInfo,
        onTabStrip: !!tabStrip
      });
    };
    window.addEventListener("contextmenu", onContextMenu, true);
    cleanupObservers.push(() => window.removeEventListener("contextmenu", onContextMenu, true));

    // 2. Lifecycle listeners for all Context Menus and Submenus
    const observedPopups = new WeakSet();

    function attachPopupObserver(popup) {
      if (!popup || observedPopups.has(popup)) return;
      observedPopups.add(popup);

      const observer = new MutationObserver((mutations) => {
        if (!isLoggerEnabled()) return;
        for (const m of mutations) {
          if (m.type === "childList") {
            const added = Array.from(m.addedNodes).filter(n => n.nodeType === 1).map(n => formatElementSelector(n)).join(", ");
            const removed = Array.from(m.removedNodes).filter(n => n.nodeType === 1).map(n => formatElementSelector(n)).join(", ");
            ZentralLogger.log("Menu:Mutation", `Popup <${popup.id || popup.tagName.toLowerCase()}> children changed: +[${added}] -[${removed}]`);
          } else if (m.type === "attributes") {
            ZentralLogger.log("Menu:Mutation", `Popup item ${formatElementSelector(m.target)} attr "${m.attributeName}" -> "${m.target.getAttribute(m.attributeName)}"`);
          }
        }
      });
      observer.observe(popup, { childList: true, subtree: true, attributes: true, attributeFilter: ["label", "hidden", "disabled", "class"] });
      cleanupObservers.push(() => observer.disconnect());
    }

    const onPopupShowing = (e) => {
      if (!isLoggerEnabled()) return;
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;

      attachPopupObserver(popup);
      const parentMenu = popup.parentNode ? formatElementSelector(popup.parentNode) : "(none)";
      const triggerNode = popup.triggerNode ? formatElementSelector(popup.triggerNode) : "(none)";
      
      ZentralLogger.log("Menu:PopupShowing", `[Showing] <${tag} id="${popup.id || 'no-id'}"> | Parent: ${parentMenu} | Trigger: ${triggerNode}`);
      
      const dump = dumpMenuChildren(popup, "  ");
      ZentralLogger.log("Menu:Structure", `DOM State for <${popup.id || popup.tagName}>:\n${dump.join("\n")}`);
    };
    window.addEventListener("popupshowing", onPopupShowing, true);
    cleanupObservers.push(() => window.removeEventListener("popupshowing", onPopupShowing, true));

    const onPopupShown = (e) => {
      if (!isLoggerEnabled()) return;
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;

      ZentralLogger.log("Menu:PopupShown", `<${tag} id="${popup.id || 'no-id'}"> (visible)`);
    };
    window.addEventListener("popupshown", onPopupShown, true);
    cleanupObservers.push(() => window.removeEventListener("popupshown", onPopupShown, true));

    const onPopupHiding = (e) => {
      if (!isLoggerEnabled()) return;
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;
      ZentralLogger.log("Menu:PopupHiding", `<${tag} id="${popup.id || 'no-id'}">`);
    };
    window.addEventListener("popuphiding", onPopupHiding, true);
    cleanupObservers.push(() => window.removeEventListener("popuphiding", onPopupHiding, true));

    // 3. Command execution within tab context menus
    const onCommand = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      if (target && target.closest && (target.closest("#tabContextMenu") || target.closest("#zentral-tabgroup-context-menu") || target.closest("[id*='TabToGroup']") || target.closest("menupopup"))) {
        const id = target.id || "(no-id)";
        const label = target.getAttribute("label") || target.label || "(no-label)";
        const parentPopup = target.closest("menupopup")?.id || "(no-popup-id)";
        const zGroupId = target.getAttribute("zentral-group-id") || "";
        ZentralLogger.log("Menu:Command", `Executed command on ${formatElementSelector(target)} [label="${label}"] in popup #${parentPopup} (group="${zGroupId}")`);
      }
    };
    window.addEventListener("command", onCommand, true);
    cleanupObservers.push(() => window.removeEventListener("command", onCommand, true));
  }

  // -------------------------------------------------------------------------
  // Deep Tab Drag & Split View Diagnostic Tracer
  // -------------------------------------------------------------------------
  function setupTabDragAndSplitViewTracer() {
    function getElementSummary(el) {
      if (!el) return "(null)";
      const sel = formatElementSelector(el);
      const label = el.getAttribute?.("label") || el.label || el.textLabel?.textContent || "";
      const isSplitTab = el.splitView || el.group?.hasAttribute?.("split-view-group") || false;
      const isPending = el.hasAttribute?.("pending") || false;
      const groupId = el.group?.id || el.getAttribute?.("zen-tab-group-id") || "";
      return `${sel} "${label}"${isSplitTab ? ' [Split]' : ''}${isPending ? ' [Pending]' : ''}${groupId ? ` [group=${groupId}]` : ''}`;
    }

    function getCallerStack() {
      try {
        const stack = new Error().stack || "";
        const lines = stack.split("\n").slice(2, 5).map(l => l.trim()).filter(Boolean);
        return lines.join(" -> ");
      } catch (_) {
        return "";
      }
    }

    const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;

    // 1. Trace Mouse Events on Tab Strip
    const onTabStripMouseDown = (e) => {
      if (!isLoggerEnabled() || e.button !== 0) return;
      const target = e.target;
      if (!target?.closest?.("tab, tabbrowser-tab, tab-group, .tab-group-label-container")) return;
      const el = target.closest("tab, tabbrowser-tab, tab-group");
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("Drag:MouseDown", `${getElementSummary(el)} | coords=(${e.clientX},${e.clientY}) | activeTab="${activeTab?.label || ''}"`);
    };

    const onTabStripMouseUp = (e) => {
      if (!isLoggerEnabled() || e.button !== 0) return;
      const target = e.target;
      if (!target?.closest?.("tab, tabbrowser-tab, tab-group, .tab-group-label-container")) return;
      const el = target.closest("tab, tabbrowser-tab, tab-group");
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("Drag:MouseUp", `${getElementSummary(el)} | coords=(${e.clientX},${e.clientY}) | activeTab="${activeTab?.label || ''}"`);
    };

    if (tabContainer) {
      tabContainer.addEventListener("mousedown", onTabStripMouseDown, true);
      tabContainer.addEventListener("mouseup", onTabStripMouseUp, true);
      cleanupObservers.push(() => {
        tabContainer.removeEventListener("mousedown", onTabStripMouseDown, true);
        tabContainer.removeEventListener("mouseup", onTabStripMouseUp, true);
      });
    }

    // 2. Trace Native Drag Lifecycle
    const onDragStart = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("Drag:DragStart", `${getElementSummary(target)} | activeTab="${activeTab?.label || ''}" | types=[${Array.from(e.dataTransfer?.types || []).join(",")}]`);
    };

    const onDragEnd = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("Drag:DragEnd", `${getElementSummary(target)} | activeTab="${activeTab?.label || ''}" | dropEffect="${e.dataTransfer?.dropEffect}"`);
    };

    const onDrop = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const activeTab = window.gBrowser?.selectedTab;
      let draggedItemSummary = "(unknown)";
      try {
        const dt = e.dataTransfer;
        if (dt && dt.mozItemCount) {
          const item = dt.mozGetDataAt("application/x-moz-tabbrowser-tab", 0);
          if (item) draggedItemSummary = getElementSummary(item);
        }
      } catch (_) {}
      ZentralLogger.log("Drag:Drop", `Target ${getElementSummary(target)} | draggedItem=${draggedItemSummary} | activeTab="${activeTab?.label || ''}"`);
    };

    window.addEventListener("dragstart", onDragStart, true);
    window.addEventListener("dragend", onDragEnd, true);
    window.addEventListener("drop", onDrop, true);
    cleanupObservers.push(() => {
      window.removeEventListener("dragstart", onDragStart, true);
      window.removeEventListener("dragend", onDragEnd, true);
      window.removeEventListener("drop", onDrop, true);
    });

    // 3. Trace TabSelect Events
    const onTabSelect = (e) => {
      if (!isLoggerEnabled()) return;
      const newTab = e.target;
      const stack = getCallerStack();
      ZentralLogger.log("Drag:TabSelect", `New Active Tab: ${getElementSummary(newTab)} | Stack: ${stack}`);
    };
    window.addEventListener("TabSelect", onTabSelect, true);
    cleanupObservers.push(() => window.removeEventListener("TabSelect", onTabSelect, true));

    // 4. Trace gZenViewSplitter Split Engine Calls
    if (window.gZenViewSplitter) {
      const splitter = window.gZenViewSplitter;
      const origSplitTabs = splitter.splitTabs;
      if (typeof origSplitTabs === "function") {
        splitter.splitTabs = function(tabs, gridType, initialIndex, options) {
          if (isLoggerEnabled()) {
            const stack = getCallerStack();
            const tabList = (tabs || []).map(t => getElementSummary(t)).join("; ");
            ZentralLogger.log("SplitView:splitTabs", `gridType="${gridType}" | initialIndex=${initialIndex} | tabs=[${tabList}] | stack: ${stack}`);
          }
          return origSplitTabs.apply(this, arguments);
        };
        cleanupObservers.push(() => { splitter.splitTabs = origSplitTabs; });
      }

      const origActivateSplitView = splitter.activateSplitView;
      if (typeof origActivateSplitView === "function") {
        splitter.activateSplitView = function(splitData) {
          if (isLoggerEnabled()) {
            const stack = getCallerStack();
            const groupId = splitData?.groupId || "";
            const tabList = (splitData?.tabs || []).map(t => getElementSummary(t)).join("; ");
            ZentralLogger.log("SplitView:activateSplitView", `groupId="${groupId}" | tabs=[${tabList}] | stack: ${stack}`);
          }
          return origActivateSplitView.apply(this, arguments);
        };
        cleanupObservers.push(() => { splitter.activateSplitView = origActivateSplitView; });
      }

      const origDeactivateCurrentSplitView = splitter.deactivateCurrentSplitView;
      if (typeof origDeactivateCurrentSplitView === "function") {
        splitter.deactivateCurrentSplitView = function() {
          if (isLoggerEnabled()) {
            const stack = getCallerStack();
            ZentralLogger.log("SplitView:deactivateCurrentSplitView", `Stack: ${stack}`);
          }
          return origDeactivateCurrentSplitView.apply(this, arguments);
        };
        cleanupObservers.push(() => { splitter.deactivateCurrentSplitView = origDeactivateCurrentSplitView; });
      }
    }

    // 5. Trace startTabDrag
    const dragProto = window.ZenDragAndDrop?.prototype || tabContainer?.tabDragAndDrop;
    if (dragProto && typeof dragProto.startTabDrag === "function") {
      const origStartTabDrag = dragProto.startTabDrag;
      dragProto.startTabDrag = function(event, tab, ...args) {
        if (isLoggerEnabled()) {
          const stack = getCallerStack();
          const activeTab = window.gBrowser?.selectedTab;
          const optionsStr = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(", ");
          ZentralLogger.log("Drag:startTabDrag", `Tab: ${getElementSummary(tab)} | activeTab="${activeTab?.label || ''}" | options=(${optionsStr}) | stack: ${stack}`);
        }
        return origStartTabDrag.apply(this, arguments);
      };
      cleanupObservers.push(() => { dragProto.startTabDrag = origStartTabDrag; });
    }
  }

  // -------------------------------------------------------------------------
  // User Interactions & Hit-Test Logger (Clicks, Buttons, Modals)
  // -------------------------------------------------------------------------
  const onClick = (e) => {
    if (!isLoggerEnabled()) return;
    const t = e.target;
    if (!t) return;
    
    // Apps tile click
    const tile = t.closest(".zen-app-tile");
    if (tile) {
      const appId = tile.getAttribute("data-app-id");
      const idLabel = appId ? `[id="${appId}"]` : `[action="${tile.id || tile.className}"]`;
      ZentralLogger.log("UI:Apps", `Clicked App Tile ${idLabel}`);
      return;
    }

    // App Panel action buttons
    const btn = t.closest(".zen-app-btn");
    if (btn) {
      ZentralLogger.log("UI:Apps", `Clicked Action Button [title="${btn.title || btn.className}"]`);
      return;
    }

    // Tab Group pill click
    const group = t.closest("tab-group");
    if (group) {
      const label = group.label || group.getAttribute("label") || "(group)";
      ZentralLogger.log("UI:TabGroup", `Clicked Tab Group "${label}" [target=${formatElementSelector(t)}]`);
      return;
    }

    // Settings Modal elements
    const modal = t.closest("#zentral-settings-modal");
    if (modal) {
      if (t.closest("#zs-kofi-btn")) {
        ZentralLogger.log("UI:Settings", "Clicked Ko-fi Support Button");
        return;
      }
      ZentralLogger.log("UI:Settings", `Interaction on ${formatElementSelector(t)}`);
      return;
    }
  };
  document.addEventListener("click", onClick, true);
  cleanupObservers.push(() => document.removeEventListener("click", onClick, true));

  // -------------------------------------------------------------------------
  // Shortcut Exporter: Alt + L
  // -------------------------------------------------------------------------
  const onKeyDown = (e) => {
    if (!e.altKey || (e.key !== "l" && e.key !== "L")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exportLog();
  };
  document.addEventListener("keydown", onKeyDown, true);
  cleanupObservers.push(() => document.removeEventListener("keydown", onKeyDown, true));

  /**
   * Generates formatted diagnostic log string in-memory without file operations
   * @returns {string} Formatted log output
   */
  function generateLogString() {
    const isFull = Services.prefs.getBoolPref("zen.workspace.zentral.debug.full", true);
    const activeModulesSummary = [
      `Core: YES`,
      `Full Log: ${isFull ? "ON" : "OFF"}`,
      `Tabs: ${isModuleEnabled("tabs") ? "ON" : "OFF"}`,
      `Apps: ${isModuleEnabled("apps") ? "ON" : "OFF"}`,
      `Menus: ${isModuleEnabled("menus") ? "ON" : "OFF"}`,
      `Layout: ${isModuleEnabled("layout") ? "ON" : "OFF"}`
    ].join(" | ");

    const parts = [
      `================================================================================`,
      `ZENTRAL-LOGGER DIAGNOSTIC EXPORT — ${tsFull()}`,
      `Active Diagnostic Modules: ${activeModulesSummary}`,
      `================================================================================\n`
    ];

    if (isModuleEnabled("layout")) {
      parts.push(captureLayoutDiagnosticSnapshot() + "\n");
    } else {
      parts.push(`=== ZENTRAL LAYOUT DIAGNOSTIC SNAPSHOT ===\n[Layout Inspector & CSS Snapshot module is disabled — snapshot omitted]\n`);
    }

    parts.push(`================================================================================`);
    parts.push(`EVENT TRACE LOG (${ringBuffer.length} entries)`);
    parts.push(`================================================================================\n`);

    parts.push(ringBuffer.length ? ringBuffer.join("\n") : "[No diagnostic events logged]");
    parts.push(`\n================================================================================`);
    parts.push(`End of export.`);

    return parts.join("\n");
  }

  /**
   * Export diagnostic logs to file in workspace logs folder
   */
  function exportLog() {
    if (!isLoggerEnabled()) {
      showLoggingDisabledWarning();
      try {
        window.dispatchEvent(new CustomEvent("ZentralLogExportDisabled"));
      } catch (_) {}
      return;
    }

    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      // Output format: console-export-YYYY-M-D_H-M-S.log
      const name = `console-export-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.log`;

      let targetFile = null;

      // 1. Try resolving custom directory from prefs or fallback to chrome/logs
      try {
        let customPath = "";
        try {
          customPath = Services.prefs.getCharPref("zentral.logger.path");
        } catch (e) {}

        if (customPath && customPath.trim() !== "") {
          targetFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          targetFile.initWithPath(customPath.trim());
          if (!targetFile.exists()) {
            targetFile.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
          }
          targetFile.append(name);
        } else {
          const chromeDir = Services.dirsvc.get("UChrm", Ci.nsIFile);
          const logsDir = chromeDir.clone();
          logsDir.append("logs");
          if (!logsDir.exists()) {
            logsDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
          }
          targetFile = logsDir.clone();
          targetFile.append(name);
        }
      } catch (dirErr) {
        _native.warn("[Zentral-Logger] Could not resolve export directory:", dirErr);
      }

      if (!targetFile) {
        _native.error("[Zentral-Logger] Cannot get file handle for export.");
        return;
      }

      const fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      fos.init(targetFile, 0x02 | 0x08 | 0x20, 0o644, 0);

      const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
      cos.init(fos, "UTF-8");

      const logText = generateLogString();
      cos.writeString(logText);
      cos.writeString(`\nLog file path: ${targetFile.path}\n`);

      cos.close();
      fos.close();

      _native.log(`[Zentral-Logger] Log exported successfully to: ${targetFile.path}`);
    } catch (err) {
      _native.error("[Zentral-Logger] Failed to export log:", err);
    }
  }

  // Register cleanup handler on window for hot-reloading
  window._zentralLoggerCleanup = () => {
    cleanupObservers.forEach(fn => { try { fn(); } catch (_) {} });
    cleanupObservers = [];
  };

  // Respect Diagnostics Prefs
  const Services = globalThis.Services || Components.classes["@mozilla.org/network/services;1"].getService(Components.interfaces.nsIServiceManager).getServiceByContractID("@mozilla.org/preferences-service;1").QueryInterface(Components.interfaces.nsIPrefBranch);

  // Listen to UI Capture button
  window.addEventListener("ZentralCaptureLog", () => {
    exportLog();
  });

  // Run observers & tracers ONLY if enabled
  if (document.readyState === "complete") {
    setupLayoutObservers();
    setupTabContextMenuTracer();
    setupTabDragAndSplitViewTracer();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setupLayoutObservers();
      setupTabContextMenuTracer();
      setupTabDragAndSplitViewTracer();
    }, { once: true });
  }

  ZentralLogger.log("Zentral-Logger", "Zentral-Logger v1.0.1 initialized with clean format & deduplication. Press Alt+L to export logs.");

})();
