// ==UserScript==
// @name         Zentral-Logger
// @description  Comprehensive diagnostic logger for Zentral (Apps Grid, Tab Groups, Settings & Layout Renderings).
// @author       Michele Pierini
// @version      v0.1.6
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

  function isLoggerEnabled() {
    try {
      if (Services.prefs.prefHasUserValue("zen.workspace.zentral.debug")) {
        return Services.prefs.getBoolPref("zen.workspace.zentral.debug");
      }
      if (Services.prefs.prefHasUserValue("zentral.logger.enabled")) {
        return Services.prefs.getBoolPref("zentral.logger.enabled");
      }
      return Services.prefs.getBoolPref("zen.workspace.zentral.debug", false);
    } catch (_) {
      try {
        return Services.prefs.getBoolPref("zentral.logger.enabled", false);
      } catch (_) {
        return false;
      }
    }
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

  function record(level, tag, message) {
    if (!isLoggerEnabled()) return; // DO NOT COLLECT DATA IF DISABLED
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
      if (!isLoggerEnabled()) return;
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _log(`[${tag}] ${msg}`);
      record("log", tag, msg);
    },
    warn(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _warn(`[${tag}] ${msg}`);
      record("warn", tag, msg);
    },
    error(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _error(`[${tag}] ${msg}`);
      record("error", tag, msg);
    },
    debug(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _debug(`[${tag}] ${msg}`);
      record("debug", tag, msg);
    },
    info(tag, ...args) {
      if (!isLoggerEnabled()) return;
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      _info(`[${tag}] ${msg}`);
      record("info", tag, msg);
    },
    layout(component, details) {
      if (!isLoggerEnabled()) return;
      const msg = typeof details === "object" ? JSON.stringify(details) : String(details);
      _log(`[Zentral-Layout:${component}] ${msg}`);
      record("layout", `Layout:${component}`, msg);
    },
    inspectLayout() {
      if (!isLoggerEnabled()) return "";
      const snapshot = captureLayoutDiagnosticSnapshot();
      _log(snapshot);
      record("info", "LayoutInspector", snapshot);
      return snapshot;
    },
    get entries() { return isLoggerEnabled() ? [...ringBuffer] : []; },
    dump()   { if (isLoggerEnabled()) ringBuffer.forEach(l => _log(l)); },
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
      if (!isLoggerEnabled()) return; // Fast return: no stringifying, no regex matching, no overhead
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
    if (!isLoggerEnabled()) return;
    record("error", "WindowError", `Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  };
  const onUnhandledRej = (e) => {
    if (!isLoggerEnabled()) return;
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

    // =========================================================================
    // Sidebar & Compact Mode Material / Theme Inspector
    // =========================================================================
    lines.push(`\n=== SIDEBAR & COMPACT MODE MATERIAL / THEME INSPECTOR ===`);
    
    // 1. All relevant CSS Custom Properties on :root
    try {
      const rootCS = window.getComputedStyle(document.documentElement);
      const cssVars = [];
      for (let i = 0; i < rootCS.length; i++) {
        const prop = rootCS[i];
        if (prop.startsWith("--zen-") || prop.startsWith("--toolbox-") || prop.startsWith("--toolbar-") || prop.startsWith("--tab-") || prop.startsWith("--arrowpanel-")) {
          const val = rootCS.getPropertyValue(prop)?.trim();
          if (val) cssVars.push(`  ${prop}: ${val}`);
        }
      }
      lines.push(`CSS Variables on :root (${cssVars.length}):\n${cssVars.join("\n") || "  (none)"}`);
    } catch (e) {
      lines.push(`CSS Variables on :root: Error reading variables (${e.message})`);
    }

    // 2. Element-by-Element Computed Style Dumps
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
      "appcontent",
      "tabbrowser-tabpanels",
      "TabsToolbar",
      "nav-bar",
      "zen-appcontent-navbar-wrapper",
      "zen-main-app-wrapper",
      "titlebar",
      "zen-sidebar-top-buttons",
      "zen-sidebar-bottom-buttons",
      "zen-current-workspace-indicator",
      "zentral-apps-vertical-bar",
      "zen-apps-sidebar-grid"
    ];

    inspectIds.forEach(id => {
      try {
        let el = (id === "main-window") ? document.documentElement : document.getElementById(id);
        if (!el) el = document.querySelector("." + id);
        if (!el) {
          lines.push(`\n[Element: #${id}] Not found in DOM`);
          return;
        }

        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const attrs = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(" ");

        lines.push(`\n[Element: <${el.tagName.toLowerCase()} id="${el.id || id}" class="${el.className}">]`);
        lines.push(`  Rect: ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)})`);
        lines.push(`  Attributes: ${attrs || "(none)"}`);
        lines.push(`  -moz-appearance: ${cs.MozAppearance || cs.appearance}`);
        lines.push(`  background: ${cs.background}`);
        lines.push(`  background-color: ${cs.backgroundColor}`);
        lines.push(`  background-image: ${cs.backgroundImage}`);
        lines.push(`  background-attachment: ${cs.backgroundAttachment}`);
        lines.push(`  background-position: ${cs.backgroundPosition}`);
        lines.push(`  background-size: ${cs.backgroundSize}`);
        lines.push(`  background-repeat: ${cs.backgroundRepeat}`);
        lines.push(`  background-clip: ${cs.backgroundClip}`);
        lines.push(`  backdrop-filter: ${cs.backdropFilter}`);
        lines.push(`  -webkit-backdrop-filter: ${cs.webkitBackdropFilter}`);
        lines.push(`  box-shadow: ${cs.boxShadow}`);
        lines.push(`  border: ${cs.border}`);
        lines.push(`  border-radius: ${cs.borderRadius}`);
        lines.push(`  opacity: ${cs.opacity}`);
        lines.push(`  mix-blend-mode: ${cs.mixBlendMode}`);
        lines.push(`  filter: ${cs.filter}`);
        lines.push(`  position: ${cs.position} | z-index: ${cs.zIndex}`);

        // Check ::before pseudo-element
        try {
          const csBefore = window.getComputedStyle(el, "::before");
          if (csBefore && csBefore.content && csBefore.content !== "none") {
            lines.push(`  ::before -> content: ${csBefore.content} | bg: ${csBefore.background} | bg-color: ${csBefore.backgroundColor} | bg-image: ${csBefore.backgroundImage} | backdrop: ${csBefore.backdropFilter} | pos: ${csBefore.position} | inset: ${csBefore.inset}`);
          }
        } catch (_) {}

        // Check ::after pseudo-element
        try {
          const csAfter = window.getComputedStyle(el, "::after");
          if (csAfter && csAfter.content && csAfter.content !== "none") {
            lines.push(`  ::after -> content: ${csAfter.content} | bg: ${csAfter.background} | bg-color: ${csAfter.backgroundColor} | bg-image: ${csAfter.backgroundImage} | backdrop: ${csAfter.backdropFilter} | pos: ${csAfter.position} | inset: ${csAfter.inset}`);
          }
        } catch (_) {}
      } catch (elemErr) {
        lines.push(`\n[Element: #${id}] Error inspecting element: ${elemErr.message}`);
      }
    });

    // 3. Descendants of #navigator-toolbox with backgrounds / filters / pseudo-elements
    try {
      const toolbox = document.getElementById("navigator-toolbox");
      if (toolbox) {
        lines.push(`\n=== NAVIGATOR-TOOLBOX DESCENDANTS INSPECTION ===`);
        const allDescendants = toolbox.querySelectorAll("*");
        lines.push(`Total Descendants in #navigator-toolbox: ${allDescendants.length}`);
        allDescendants.forEach(child => {
          try {
            const cs = window.getComputedStyle(child);
            const hasBg = (cs.backgroundColor && cs.backgroundColor !== "transparent" && cs.backgroundColor !== "rgba(0, 0, 0, 0)") ||
                          (cs.backgroundImage && cs.backgroundImage !== "none") ||
                          (cs.backdropFilter && cs.backdropFilter !== "none") ||
                          (cs.boxShadow && cs.boxShadow !== "none");
            const csBefore = window.getComputedStyle(child, "::before");
            const hasBefore = csBefore && csBefore.content && csBefore.content !== "none" && (
              (csBefore.backgroundColor && csBefore.backgroundColor !== "transparent" && csBefore.backgroundColor !== "rgba(0, 0, 0, 0)") ||
              (csBefore.backgroundImage && csBefore.backgroundImage !== "none") ||
              (csBefore.backdropFilter && csBefore.backdropFilter !== "none")
            );
            const csAfter = window.getComputedStyle(child, "::after");
            const hasAfter = csAfter && csAfter.content && csAfter.content !== "none" && (
              (csAfter.backgroundColor && csAfter.backgroundColor !== "transparent" && csAfter.backgroundColor !== "rgba(0, 0, 0, 0)") ||
              (csAfter.backgroundImage && csAfter.backgroundImage !== "none") ||
              (csAfter.backdropFilter && csAfter.backdropFilter !== "none")
            );

            if (hasBg || hasBefore || hasAfter || child.id === "titlebar" || child.id === "TabsToolbar" || child.id === "nav-bar" || child.id === "vertical-tabs") {
              lines.push(`  Child <${child.tagName.toLowerCase()} id="${child.id || 'no-id'}" class="${child.className}">`);
              lines.push(`    bg: ${cs.background} | bg-color: ${cs.backgroundColor} | bg-image: ${cs.backgroundImage} | backdrop: ${cs.backdropFilter} | shadow: ${cs.boxShadow}`);
              if (hasBefore) {
                lines.push(`    ::before -> content: ${csBefore.content} | bg: ${csBefore.background} | bg-image: ${csBefore.backgroundImage} | backdrop: ${csBefore.backdropFilter}`);
              }
              if (hasAfter) {
                lines.push(`    ::after -> content: ${csAfter.content} | bg: ${csAfter.background} | bg-image: ${csAfter.backgroundImage} | backdrop: ${csAfter.backdropFilter}`);
              }
            }
          } catch (_) {}
        });
      }
    } catch (e) {
      lines.push(`Error inspecting descendants: ${e.message}`);
    }

    // 4. Matching CSS rules from styleSheets
    try {
      lines.push(`\n=== MATCHING CSS RULES FOR SIDEBAR & COMPACT MODE ===`);
      const matchedRules = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            if (rule.selectorText && (
              rule.selectorText.includes("navigator-toolbox") ||
              rule.selectorText.includes("zen-compact-mode") ||
              rule.selectorText.includes("browserSidebarContainer") ||
              rule.selectorText.includes("tabbrowser-tabbox") ||
              rule.selectorText.includes("TabsToolbar")
            )) {
              if (rule.cssText && (
                rule.cssText.includes("background") ||
                rule.cssText.includes("backdrop-filter") ||
                rule.cssText.includes("box-shadow") ||
                rule.cssText.includes("border") ||
                rule.cssText.includes("opacity")
              )) {
                matchedRules.push(`  ${rule.cssText}`);
              }
            }
          }
        } catch (_) {}
      }
      lines.push(`Matching CSS Rules (${matchedRules.length}):\n${matchedRules.slice(0, 100).join("\n") || "  (none)"}`);
    } catch (e) {
      lines.push(`Error reading stylesheets: ${e.message}`);
    }

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Real-time Layout & DOM Observers
  // -------------------------------------------------------------------------
  let cleanupObservers = [];

  function setupLayoutObservers() {
    // 1. Root & Sidebar Layout Attribute Observer
    const rootObserver = new MutationObserver((mutations) => {
      if (!isLoggerEnabled()) return;
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
        if (!isLoggerEnabled()) return;
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
      if (!isLoggerEnabled()) return;
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
        if (!isLoggerEnabled()) return;
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
      if (!isLoggerEnabled()) return;
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
      if (!isLoggerEnabled()) return;
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
      if (!isLoggerEnabled()) return;
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
      if (!isLoggerEnabled()) return;
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
  // Deep Tab Drag & Split View Diagnostic Tracer
  // -------------------------------------------------------------------------
  function setupTabDragAndSplitViewTracer() {
    function getElementSummary(el) {
      if (!el) return "(null)";
      const tag = el.tagName?.toLowerCase() || "(no-tag)";
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className ? `.${String(el.className).trim().replace(/\s+/g, ".")}` : "";
      const label = el.getAttribute?.("label") || el.label || el.textLabel?.textContent || "";
      const isSplitTab = el.splitView || el.group?.hasAttribute?.("split-view-group") || false;
      const isPending = el.hasAttribute?.("pending") || false;
      const groupId = el.group?.id || el.getAttribute?.("zen-tab-group-id") || "";
      return `<${tag}${id}${cls}> label="${label}" isSplitTab=${isSplitTab} isPending=${isPending} groupId="${groupId}"`;
    }

    function getCallerStack() {
      try {
        const stack = new Error().stack || "";
        const lines = stack.split("\n").slice(2, 6).map(l => l.trim()).filter(Boolean);
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
      ZentralLogger.log("DragTracer:MouseDown", `MouseDown on ${getElementSummary(el)} | coords=(${e.clientX},${e.clientY}) | activeTab="${activeTab?.label || activeTab?.textLabel?.textContent || ''}"`);
    };

    const onTabStripMouseUp = (e) => {
      if (!isLoggerEnabled() || e.button !== 0) return;
      const target = e.target;
      if (!target?.closest?.("tab, tabbrowser-tab, tab-group, .tab-group-label-container")) return;
      const el = target.closest("tab, tabbrowser-tab, tab-group");
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("DragTracer:MouseUp", `MouseUp on ${getElementSummary(el)} | coords=(${e.clientX},${e.clientY}) | activeTab="${activeTab?.label || activeTab?.textLabel?.textContent || ''}"`);
    };

    tabContainer.addEventListener("mousedown", onTabStripMouseDown, true);
    tabContainer.addEventListener("mouseup", onTabStripMouseUp, true);
    cleanupObservers.push(() => {
      tabContainer.removeEventListener("mousedown", onTabStripMouseDown, true);
      tabContainer.removeEventListener("mouseup", onTabStripMouseUp, true);
    });

    // 2. Trace Native Drag Lifecycle
    const onDragStart = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("DragTracer:DragStart", `DragStart on ${getElementSummary(target)} | activeTab="${activeTab?.label || ''}" | types=[${Array.from(e.dataTransfer?.types || []).join(",")}]`);
    };

    const onDragEnd = (e) => {
      if (!isLoggerEnabled()) return;
      const target = e.target;
      const activeTab = window.gBrowser?.selectedTab;
      ZentralLogger.log("DragTracer:DragEnd", `DragEnd on ${getElementSummary(target)} | activeTab="${activeTab?.label || ''}" | dropEffect="${e.dataTransfer?.dropEffect}"`);
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
      ZentralLogger.log("DragTracer:Drop", `Drop on target ${getElementSummary(target)} | draggedItem=${draggedItemSummary} | activeTab="${activeTab?.label || ''}"`);
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
      ZentralLogger.log("DragTracer:TabSelect", `TabSelect fired -> New Active Tab: ${getElementSummary(newTab)} | Caller Stack: ${stack}`);
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
            ZentralLogger.log("SplitView:splitTabs", `splitTabs called | gridType="${gridType}" | initialIndex=${initialIndex} | tabs=[${tabList}] | stack: ${stack}`);
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
            ZentralLogger.log("SplitView:activateSplitView", `activateSplitView called | groupId="${groupId}" | tabs=[${tabList}] | stack: ${stack}`);
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
            ZentralLogger.log("SplitView:deactivateCurrentSplitView", `deactivateCurrentSplitView called | stack: ${stack}`);
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
          ZentralLogger.log("DragTracer:startTabDrag", `startTabDrag invoked for ${getElementSummary(tab)} | activeTab="${activeTab?.label || ''}" | options=(${optionsStr}) | stack: ${stack}`);
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
    setupTabDragAndSplitViewTracer();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setupLayoutObservers();
      setupTabContextMenuTracer();
      setupTabDragAndSplitViewTracer();
    }, { once: true });
  }

  ZentralLogger.log("Zentral-Logger", "Overhauled Zentral-Logger v0.1.7 initialized. Tab Drag & Split View diagnostic tracing active. Press Alt+L to export logs.");

})();
