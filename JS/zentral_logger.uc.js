// ==UserScript==
// @name         Zentral-Logger
// @description  Comprehensive diagnostic logger for Zentral (Apps Grid, Tab Groups, Settings & Layout Renderings).
// @author       Michele Pierini
// @version      v0.1.7
// @include      main
// ==/UserScript==

"use strict";

(function ZentralLoggerModule() {
  // Clean up any previously attached listeners if reloading
  if (window._zentralLoggerCleanup && typeof window._zentralLoggerCleanup === "function") {
    try { window._zentralLoggerCleanup(); } catch (_) {}
  }

  const MAX_ENTRIES = 8000;
  const ringBuffer = window._zentralLoggerRingBuffer || [];
  window._zentralLoggerRingBuffer = ringBuffer;

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
  const onWinError = (e) => {
    record("error", "WindowError", `Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  };
  const onUnhandledRej = (e) => {
    record("error", "UnhandledRejection", `Reason: ${e.reason?.message || e.reason}`);
  };
  window.addEventListener("error", onWinError, true);
  window.addEventListener("unhandledrejection", onUnhandledRej, true);

  // -------------------------------------------------------------------------
  // Layout & DOM Diagnostic Snapshots
  // -------------------------------------------------------------------------
  function captureLayoutDiagnosticSnapshot() {
    const lines = [];
    lines.push(`=== ZENTRAL LAYOUT DIAGNOSTIC SNAPSHOT (${ts()}) ===`);
    lines.push(`Window Dimensions: ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio})`);
    
    // Root layout attributes
    const root = document.documentElement;
    const attrs = Array.from(root.attributes).map(a => `${a.name}="${a.value}"`).join(" | "); 
    lines.push(`Root Attributes: ${attrs}`);
    
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
      const childTabs = g.querySelectorAll("tab, tabbrowser-tab, .tabbrowser-tab").length;
      lines.push(`  Group #${idx + 1} "${label}" [id="${g.id || 'none'}"]: collapsed=${collapsed} childTabs=${childTabs} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`);
    });

    // Native Context Menus in DOM
    const tabCtx = document.getElementById("tabContextMenu");
    lines.push(`Tab Context Menu (#tabContextMenu): ${tabCtx ? `Present in DOM (children: ${tabCtx.children.length})` : "Not found"}`);

    // Settings Modal
    const modal = document.getElementById("zentral-settings-modal");
    lines.push(`Settings Modal: ${modal ? "Present in DOM" : "Not open"}`);

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Real-time Layout & DOM Observers
  // -------------------------------------------------------------------------
  let cleanupObservers = [];

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
    cleanupObservers.push(() => rootObserver.disconnect());

    // 2. Apps Grid Observer
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
      cleanupObservers.push(() => gridObserver.disconnect());
      ZentralLogger.layout("AppsGrid", "Apps Grid observer attached.");
    }

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
    cleanupObservers.push(() => tabGroupObserver.disconnect());
  }

  // -------------------------------------------------------------------------
  // Tab Context Menu & Right-Click Diagnostic Tracer
  // -------------------------------------------------------------------------
  function setupTabContextMenuTracer() {
    function dumpMenuChildren(popup, prefix) {
      prefix = prefix || "  ";
      if (!popup || !popup.children) return ["[Empty Popup]"];
      const lines = [];
      const children = Array.from(popup.children);
      lines.push(`${prefix}Total items: ${children.length}`);
      children.forEach((el, i) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className ? `.${el.className.trim().replace(/\s+/g, ".")}` : "";
        const label = el.getAttribute("label") || el.label || "";
        const text = el.textContent ? el.textContent.trim().replace(/\s+/g, " ") : "";
        const l10n = el.getAttribute("data-l10n-id") ? `[data-l10n-id="${el.getAttribute("data-l10n-id")}"]` : "";
        const hidden = el.hidden || el.hasAttribute("hidden") || el.getAttribute("collapsed") === "true";
        const disabled = el.disabled || el.getAttribute("disabled") === "true";
        const zGroupId = el.getAttribute("zentral-group-id") ? `[zentral-group-id="${el.getAttribute("zentral-group-id")}"]` : "";
        const colorVar = el.style.getPropertyValue("--tab-group-color") || el.style.getPropertyValue("--menu-icon-color") || "";

        let details = `${prefix}[${i}] <${tag}${id}${cls}${zGroupId}${l10n}>`;
        if (label) details += ` label="${label}"`;
        if (text && text !== label) details += ` textContent="${text}"`;
        if (colorVar) details += ` color="${colorVar}"`;
        if (hidden) details += " (HIDDEN)";
        if (disabled) details += " (DISABLED)";

        lines.push(details);

        if (tag === "menu") {
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
      const target = e.target;
      const tab = target?.closest ? target.closest("tab, tabbrowser-tab, .tabbrowser-tab") : null;
      const group = target?.closest ? target.closest("tab-group:not([split-view-group])") : null;
      const tabStrip = target?.closest ? target.closest("#tabbrowser-tabs, .tabbrowser-tabs") : null;

      const tabInfo = tab ? {
        label: tab.label || tab.getAttribute("label") || "(unnamed tab)",
        selected: tab.selected || tab.hasAttribute("selected"),
        pinned: tab.pinned || tab.hasAttribute("pinned"),
        group: tab.group?.id || tab.getAttribute("group") || (tab.closest("tab-group")?.getAttribute("label") || "none"),
        userContextId: tab.getAttribute("usercontextid") || 0,
        index: tab._tPos !== undefined ? tab._tPos : (tab.parentElement ? Array.from(tab.parentElement.children).indexOf(tab) : -1)
      } : null;

      const groupInfo = group ? {
        id: group.id || "(no-id)",
        label: group.label || group.getAttribute("label") || "(no-label)",
        collapsed: group.hasAttribute("collapsed")
      } : null;

      ZentralLogger.log("TabContextMenu:RightClick", {
        targetTag: target.tagName,
        targetClass: target.className,
        targetId: target.id,
        coords: { clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY },
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
        for (const m of mutations) {
          if (m.type === "childList") {
            const added = Array.from(m.addedNodes).filter(n => n.nodeType === 1).map(n => `<${n.tagName.toLowerCase()} id="${n.id || ''}" label="${n.getAttribute('label') || n.label || ''}">`).join(", ");
            const removed = Array.from(m.removedNodes).filter(n => n.nodeType === 1).map(n => `<${n.tagName.toLowerCase()} id="${n.id || ''}" label="${n.getAttribute('label') || n.label || ''}">`).join(", ");
            ZentralLogger.log("TabContextMenu:Mutation", `Popup <${popup.tagName.toLowerCase()} id="${popup.id || 'no-id'}"> children changed: +[${added}] -[${removed}]`);
          } else if (m.type === "attributes") {
            ZentralLogger.log("TabContextMenu:Mutation", `Popup item <${m.target.tagName.toLowerCase()} id="${m.target.id || 'no-id'}"> attr "${m.attributeName}" -> "${m.target.getAttribute(m.attributeName)}"`);
          }
        }
      });
      observer.observe(popup, { childList: true, subtree: true, attributes: true, attributeFilter: ["label", "hidden", "disabled", "class"] });
      cleanupObservers.push(() => observer.disconnect());
    }

    const onPopupShowing = (e) => {
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;

      attachPopupObserver(popup);
      const parentMenu = popup.parentNode ? `<${popup.parentNode.tagName.toLowerCase()} id="${popup.parentNode.id || ''}" label="${popup.parentNode.getAttribute?.('label') || ''}">` : "(none)";
      const triggerNode = popup.triggerNode ? `<${popup.triggerNode.tagName.toLowerCase()} class="${popup.triggerNode.className || ''}">` : "(none)";
      
      ZentralLogger.log("TabContextMenu:PopupShowing", `[Showing] <${tag} id="${popup.id || 'no-id'}" class="${popup.className || ''}"> | Parent: ${parentMenu} | TriggerNode: ${triggerNode}`);
      
      const dump = dumpMenuChildren(popup, "  ");
      ZentralLogger.log("TabContextMenu:Structure", `DOM State for <${popup.id || popup.tagName}> at popupshowing:\n${dump.join("\n")}`);
    };
    window.addEventListener("popupshowing", onPopupShowing, true);
    cleanupObservers.push(() => window.removeEventListener("popupshowing", onPopupShowing, true));

    const onPopupShown = (e) => {
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;

      const dump = dumpMenuChildren(popup, "  ");
      ZentralLogger.log("TabContextMenu:PopupShown", `[Shown] <${tag} id="${popup.id || 'no-id'}"> Visible State:\n${dump.join("\n")}`);
    };
    window.addEventListener("popupshown", onPopupShown, true);
    cleanupObservers.push(() => window.removeEventListener("popupshown", onPopupShown, true));

    const onPopupHiding = (e) => {
      const popup = e.target;
      if (!popup || !popup.tagName) return;
      const tag = popup.tagName.toLowerCase();
      if (tag !== "menupopup" && tag !== "panel") return;
      ZentralLogger.log("TabContextMenu:PopupHiding", `[Hiding] <${tag} id="${popup.id || 'no-id'}">`);
    };
    window.addEventListener("popuphiding", onPopupHiding, true);
    cleanupObservers.push(() => window.removeEventListener("popuphiding", onPopupHiding, true));

    // 3. Command execution within tab context menus
    const onCommand = (e) => {
      const target = e.target;
      if (target && target.closest && (target.closest("#tabContextMenu") || target.closest("#zentral-tabgroup-context-menu") || target.closest("[id*='TabToGroup']") || target.closest("menupopup"))) {
        const id = target.id || "(no-id)";
        const label = target.getAttribute("label") || target.label || "(no-label)";
        const parentPopup = target.closest("menupopup")?.id || "(no-popup-id)";
        const zGroupId = target.getAttribute("zentral-group-id") || "";
        ZentralLogger.log("TabContextMenu:CommandExecuted", `Executed command on <${target.tagName.toLowerCase()} id="${id}" label="${label}"> in popup #${parentPopup} (zentralGroupId="${zGroupId}")`);
      }
    };
    window.addEventListener("command", onCommand, true);
    cleanupObservers.push(() => window.removeEventListener("command", onCommand, true));
  }

  // -------------------------------------------------------------------------
  // User Interactions & Hit-Test Logger (Clicks, Buttons, Modals)
  // -------------------------------------------------------------------------
  const onClick = (e) => {
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
   * Export diagnostic logs to file in workspace logs folder
   */
  function exportLog() {
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
        _warn("[Zentral-Logger] Could not resolve export directory:", dirErr);
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

  // Register cleanup handler on window for hot-reloading
  window._zentralLoggerCleanup = () => {
    cleanupObservers.forEach(fn => { try { fn(); } catch (_) {} });
    cleanupObservers = [];
  };

  // Respect Diagnostics Prefs
  const Services = globalThis.Services || Components.classes["@mozilla.org/network/services;1"].getService(Components.interfaces.nsIServiceManager).getServiceByContractID("@mozilla.org/preferences-service;1").QueryInterface(Components.interfaces.nsIPrefBranch);
  let loggerEnabled = false;
  try {
    loggerEnabled = Services.prefs.getBoolPref("zentral.logger.enabled");
  } catch (e) {
    loggerEnabled = false;
  }

  // Listen to UI Capture button
  window.addEventListener("ZentralCaptureLog", () => {
    exportLog();
  });

  // Run observers & tracers ONLY if enabled
  if (document.readyState === "complete") {
    setupLayoutObservers();
    setupTabContextMenuTracer();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setupLayoutObservers();
      setupTabContextMenuTracer();
    }, { once: true });
  }

  ZentralLogger.log("Zentral-Logger", "Overhauled Zentral-Logger v0.1.7 initialized. Tab Context Menu diagnostic tracing active. Press Alt+L to export logs.");

})();
