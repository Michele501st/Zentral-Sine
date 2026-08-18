// ==UserScript==
// @name         Zentral-Logger
// @description  Comprehensive diagnostic logger for Zentral (Apps Grid, Tab Groups, Settings & Layout Renderings).
// @author       Michele Pierini
// @version      v0.1.6
// @include      main
// ==/UserScript==

"use strict";

(function ZentralLoggerModule() {
  if (window.ZentralLoggerInitialized) return;
  window.ZentralLoggerInitialized = true;

  const MAX_ENTRIES = 5000;
  const ringBuffer = [];

  function ts() {
    const d = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function record(level, tag, message) {
    const line = `[${ts()}] [${level.toUpperCase()}] [${tag}] ${message}`;
    if (ringBuffer.length >= MAX_ENTRIES) ringBuffer.shift();
    ringBuffer.push(line);
  }

  const _log   = console.log.bind(console);
  const _warn  = console.warn.bind(console);
  const _error = console.error.bind(console);
  const _debug = (console.debug || console.log).bind(console);
  const _info  = (console.info || console.log).bind(console);

  /**
   * Main ZentralLogger API
   */
  const ZentralLogger = {
    log(tag, ...args) {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _log(`[${tag}] ${msg}`);
      record("log", tag, msg);
    },
    warn(tag, ...args) {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _warn(`[${tag}] ${msg}`);
      record("warn", tag, msg);
    },
    error(tag, ...args) {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _error(`[${tag}] ${msg}`);
      record("error", tag, msg);
    },
    debug(tag, ...args) {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _debug(`[${tag}] ${msg}`);
      record("debug", tag, msg);
    },
    info(tag, ...args) {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _info(`[${tag}] ${msg}`);
      record("info", tag, msg);
    },
    layout(component, details) {
      const msg = typeof details === "object" ? JSON.stringify(details) : String(details);
      _log(`[Zentral-Layout:${component}] ${msg}`);
      record("layout", `Layout:${component}`, msg);
    },
    inspectLayout() {
      const snapshot = captureLayoutDiagnosticSnapshot();
      _log(snapshot);
      record("info", "LayoutInspector", snapshot);
      return snapshot;
    },
    get entries() { return [...ringBuffer]; },
    dump()   { ringBuffer.forEach(l => _log(l)); },
    export() { exportLog(); },
    clear()  { ringBuffer.length = 0; }
  };

  window.ZentralLogger = ZentralLogger;
  window.ZenzeiLogger = ZentralLogger;     // Backward compatibility alias
  window.ZenTabPeekLogger = ZentralLogger; // Backward compatibility alias

  // -------------------------------------------------------------------------
  // Intercept standard console outputs
  // -------------------------------------------------------------------------
  function patchConsoleMethod(originalFn, level) {
    return function (...args) {
      originalFn(...args);
      const text = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      let tag = "Console";
      const tagMatch = text.match(/^\[(.*?)\]/);
      if (tagMatch) {
        tag = tagMatch[1];
      }
      record(level, tag, text);
    };
  }

  console.log   = patchConsoleMethod(_log,   "log");
  console.warn  = patchConsoleMethod(_warn,  "warn");
  console.error = patchConsoleMethod(_error, "error");
  console.debug = patchConsoleMethod(_debug, "debug");
  console.info  = patchConsoleMethod(_info,  "info");

  // Capture uncaught window errors & rejections
  window.addEventListener("error", (e) => {
    record("error", "WindowError", `Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    record("error", "UnhandledRejection", `Reason: ${e.reason?.message || e.reason}`);
  }, true);

  // -------------------------------------------------------------------------
  // Layout & DOM Diagnostic Snapshots
  // -------------------------------------------------------------------------
  function captureLayoutDiagnosticSnapshot() {
    const lines = [];
    lines.push(`=== ZENTRAL LAYOUT DIAGNOSTIC SNAPSHOT (${ts()}) ===`);
    lines.push(`Window Dimensions: ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio})`);
    
    // Root layout attributes
    const root = document.documentElement;
    const attrs = Array.from(root.attributes).map(a => `${a.name}="${a.value}"`).join(" | "); lines.push(`Root Attributes: ${attrs}`);
    
    // Apps Grid
    const grid = document.getElementById("zen-apps-sidebar-grid");
    if (grid) {
      const isHoriz = grid.classList.contains("zen-apps-horizontal");
      const rect = grid.getBoundingClientRect();
      lines.push(`Apps Grid: Present | Mode: ${isHoriz ? "Horizontal (Toolbar)" : "Vertical (Sidebar)"} | Rect: ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)}) | Parent: ${grid.parentNode?.id || grid.parentNode?.tagName}`);
      const tiles = grid.querySelectorAll(".zen-app-tile");
      lines.push(`Apps Tiles Count: ${tiles.length}`);
    } else {
      lines.push(`Apps Grid: Not found in DOM`);
    }

    // App Panels
    const panels = document.querySelectorAll(".zs-app-panel");
    lines.push(`App Panels Count: ${panels.length}`);
    panels.forEach((p, idx) => {
      const rect = p.getBoundingClientRect();
      lines.push(`  Panel #${idx + 1} (${p.id}): open="${p.hasAttribute("open")}" pinned="${p.getAttribute("data-pinned")}" rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
    });

    // Tab Groups
    const tabGroups = document.querySelectorAll("tab-group");
    lines.push(`Tab Groups Count: ${tabGroups.length}`);
    tabGroups.forEach((g, idx) => {
      const label = g.label || g.getAttribute("label") || "(no label)";
      const collapsed = g.hasAttribute("collapsed");
      const rect = g.getBoundingClientRect();
      lines.push(`  Group #${idx + 1} "${label}": collapsed=${collapsed} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
    });

    // Settings Modal
    const modal = document.getElementById("zentral-settings-modal");
    lines.push(`Settings Modal: ${modal ? "Present in DOM" : "Not open"}`);

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Real-time Layout & DOM Observers
  // -------------------------------------------------------------------------
  function setupLayoutObservers() {
    // 1. Root & Sidebar Layout Attribute Observer
    const rootObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (["zen-right-side", "zen-sidebar-collapsed", "zen-single-toolbar", "zentral-label-opacity-below-85"].includes(m.attributeName)) {
          const val = document.documentElement.getAttribute(m.attributeName);
          ZentralLogger.layout("RootAttribute", `Attribute "${m.attributeName}" changed to "${val}"`);
        }
      }
    });
    rootObserver.observe(document.documentElement, { attributes: true });

    // 2. Apps Grid Observer
    const observeGrid = () => {
      const grid = document.getElementById("zen-apps-sidebar-grid");
      if (grid) {
        const gridObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === "attributes" && m.attributeName === "class") {
              const isHoriz = grid.classList.contains("zen-apps-horizontal");
              ZentralLogger.layout("AppsGrid", `Class modified. Horizontal layout: ${isHoriz}`);
            } else if (m.type === "childList") {
              ZentralLogger.layout("AppsGrid", `Grid tiles updated (+${m.addedNodes.length}, -${m.removedNodes.length})`);
            }
          }
        });
        gridObserver.observe(grid, { attributes: true, childList: true, subtree: false });
        ZentralLogger.layout("AppsGrid", "Apps Grid observer attached.");
      }
    };

    // 3. Tab Groups Observer
    const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;
    const tabGroupObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target.tagName?.toUpperCase() === "TAB-GROUP") {
          const group = m.target;
          const label = group.label || group.getAttribute("label") || "(no title)";
          const collapsed = group.hasAttribute("collapsed");
          ZentralLogger.layout("TabGroup", `Group "${label}" attribute "${m.attributeName}" -> collapsed: ${collapsed}`);
        } else if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.tagName?.toUpperCase() === "TAB-GROUP") {
              ZentralLogger.layout("TabGroup", `New Tab Group added: "${node.label || node.getAttribute("label") || "Group"}"`);
            }
          }
        }
      }
    });
    tabGroupObserver.observe(tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["collapsed", "label", "style", "class"] });

    // Initial check
    observeGrid();
    window.addEventListener("resize", () => {
      ZentralLogger.layout("WindowResize", `Resized to ${window.innerWidth}x${window.innerHeight}`);
    }, { passive: true });
  }

  if (document.readyState === "complete") {
    setupLayoutObservers();
  } else {
    window.addEventListener("DOMContentLoaded", setupLayoutObservers, { once: true });
  }

  // -------------------------------------------------------------------------
  // User Interactions & Hit-Test Logger (Clicks, Buttons, Modals)
  // -------------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;
    
    // Apps tile click
    const tile = t.closest(".zen-app-tile");
    if (tile) {
      const appId = tile.getAttribute("data-app-id");
      ZentralLogger.log("UserInteraction", `Clicked App Tile [id="${appId}"]`);
      return;
    }

    // App Panel action buttons
    const btn = t.closest(".zen-app-btn");
    if (btn) {
      ZentralLogger.log("UserInteraction", `Clicked App Panel Action Button [title="${btn.title || btn.className}"]`);
      return;
    }

    // Tab Group pill click
    const group = t.closest("tab-group");
    if (group) {
      const label = group.label || group.getAttribute("label") || "(group)";
      ZentralLogger.log("UserInteraction", `Clicked Tab Group "${label}" [target=${t.className || t.tagName}]`);
      return;
    }

    // Settings Modal elements
    const modal = t.closest("#zentral-settings-modal");
    if (modal) {
      ZentralLogger.log("UserInteraction", `Settings Modal interaction on <${t.tagName.toLowerCase()} id="${t.id}" class="${t.className}">`);
      return;
    }
  }, true);

  // -------------------------------------------------------------------------
  // Shortcut Exporter: Alt + L
  // -------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "l" && e.key !== "L")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exportLog();
  }, true);

  /**
   * Export diagnostic logs to file in workspace logs folder
   */
  function exportLog() {
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      // Output format: console-export-YYYY-M-D_H-M-S.log
      const name = `console-export-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.log`;

      let targetFile = null;

      // 1. Try resolving chrome/logs directory via Firefox XPCOM Services
      try {
        const chromeDir = Services.dirsvc.get("UChrm", Ci.nsIFile);
        const logsDir = chromeDir.clone();
        logsDir.append("logs");
        if (!logsDir.exists()) {
          logsDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
        }
        targetFile = logsDir.clone();
        targetFile.append(name);
      } catch (dirErr) {
        _warn("[Zentral-Logger] Could not resolve UChrm directory:", dirErr);
      }

      if (!targetFile) {
        _error("[Zentral-Logger] Cannot get file handle for export.");
        return;
      }

      const fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      fos.init(targetFile, 0x02 | 0x08 | 0x20, 0o644, 0);

      const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
      cos.init(fos, "UTF-8");

      cos.writeString(`================================================================================\n`);
      cos.writeString(`ZENTRAL-LOGGER DIAGNOSTIC EXPORT — ${now.toISOString()}\n`);
      cos.writeString(`================================================================================\n\n`);

      cos.writeString(captureLayoutDiagnosticSnapshot() + "\n\n");

      cos.writeString(`================================================================================\n`);
      cos.writeString(`EVENT & LAYOUT TRACE LOG (${ringBuffer.length} entries)\n`);
      cos.writeString(`================================================================================\n\n`);

      const content = ringBuffer.length ? ringBuffer.join("\n") : "[No diagnostic events logged]";
      cos.writeString(content);
      cos.writeString(`\n\n================================================================================\n`);
      cos.writeString(`End of export. Log file path: ${targetFile.path}\n`);

      cos.close();
      fos.close();

      _log(`[Zentral-Logger] Log exported successfully to: ${targetFile.path}`);
    } catch (err) {
      _error("[Zentral-Logger] Failed to export log:", err);
    }
  }

  ZentralLogger.log("Zentral-Logger", "Overhauled Zentral-Logger v0.1.6 initialized. Active & logging all layout renderings — Press Alt+L to export logs to logs/ folder.");

})();
