// ==UserScript==
// @name         Zentral — Unified Diagnostic Logger
// @description  Comprehensive diagnostic logger capturing console events, DOM interactions, tab group label rendering diagnostics, hit-test element inspection, and panel state.
// @author       Michele Pierini
// @version      v0.1.5a
// @include      main
// ==/UserScript==

"use strict";

(function ZenzeiDiagnosticLogger() {

  if (window.ZenzeiLoggerInitialized) return;
  window.ZenzeiLoggerInitialized = true;

  const MAX_ENTRIES = 3000;
  const ringBuffer = [];

  function ts() {
    return new Date().toISOString().replace("T", " ").slice(0, 23);
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

  // Expose global ZenzeiLogger object
  const ZenzeiLogger = {
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
    inspectTabGroupLabels() {
      const snapshot = captureTabGroupRenderingSnapshot();
      _log(snapshot);
      record("info", "Label-Inspector", snapshot);
      return snapshot;
    },
    get entries() { return [...ringBuffer]; },
    dump()   { ringBuffer.forEach(l => _log(l)); },
    export() { exportLog(); },
    clear()  { ringBuffer.length = 0; }
  };

  window.ZenzeiLogger = ZenzeiLogger;
  window.ZenTabPeekLogger = ZenzeiLogger; // Backward compatibility

  // Intercept standard console output so no logs are missed
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

  // Capture uncaught window errors
  window.addEventListener("error", (e) => {
    record("error", "WindowError", `Uncaught: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  }, true);

  // -------------------------------------------------------------------------
  // Automatic DOM Interaction & Hit-Test Logger
  // Captures clicks, mousedown, mouseup on relevant UI components & labels
  // -------------------------------------------------------------------------
  function formatElement(el) {
    if (!el) return "null";
    const tag = el.tagName ? el.tagName.toLowerCase() : String(el);
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
    return `${tag}${id}${cls}`;
  }

  function getHitTestDetails(e) {
    const targetEl = e.target;
    const topEl = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null;
    
    let targetStyle = {}, topStyle = {};
    if (targetEl && targetEl.nodeType === 1) {
      const cs = window.getComputedStyle(targetEl);
      targetStyle = {
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        display: cs.display,
        position: cs.position,
        visibility: cs.visibility
      };
    }

    if (topEl && topEl.nodeType === 1) {
      const cs = window.getComputedStyle(topEl);
      topStyle = {
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        display: cs.display,
        position: cs.position,
        visibility: cs.visibility
      };
    }

    return {
      target: formatElement(targetEl),
      topAtPoint: formatElement(topEl),
      targetStyle,
      topStyle,
      coords: `(${e.clientX}, ${e.clientY})`
    };
  }

  // Intercept DOM interactions in capture phase (including tab groups & label components)
  const INTERESTING_SELECTORS = "tab-group, .tab-group-label-container, .tab-group-label, .tab-group-icon, .zentral-group-initials, tab, #tabbrowser-tabs, .zen-app-tile, #zen-apps-sidebar-grid, #zen-app-panel-root, #navigator-toolbox, #PersonalToolbar, #nav-bar, #browser";

  window.addEventListener("mousedown", (e) => {
    if (e.target.closest && e.target.closest(INTERESTING_SELECTORS)) {
      const info = getHitTestDetails(e);
      ZenzeiLogger.log("DOM-Event", `mousedown button=${e.button} at ${info.coords} | target=${info.target} (pe:${info.targetStyle.pointerEvents}, z:${info.targetStyle.zIndex}) | topAtPoint=${info.topAtPoint} (pe:${info.topStyle.pointerEvents}, z:${info.topStyle.zIndex})`);
    }
  }, true);

  window.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest(INTERESTING_SELECTORS)) {
      const info = getHitTestDetails(e);
      ZenzeiLogger.log("DOM-Event", `click button=${e.button} at ${info.coords} | target=${info.target} | topAtPoint=${info.topAtPoint}`);
    }
  }, true);

  // -------------------------------------------------------------------------
  // Detailed Tab Group & Label Rendering Inspector
  // -------------------------------------------------------------------------
  function captureTabGroupRenderingSnapshot() {
    const groups = document.querySelectorAll("tab-group");
    if (!groups.length) return "No <tab-group> elements found in workspace DOM.";

    const lines = [];
    lines.push(`--- TAB GROUP LABEL & RENDERING DIAGNOSTIC BREAKDOWN (${groups.length} groups found) ---`);

    groups.forEach((group, index) => {
      const groupLabelText = group.label || group.getAttribute("label") || "(no title)";
      const isCollapsed = group.hasAttribute("collapsed");
      const isSplitView = group.hasAttribute("split-view-group");
      
      lines.push(`\n[Group #${index + 1}] Label: "${groupLabelText}" | Collapsed: ${isCollapsed} | SplitView: ${isSplitView}`);

      // 1. Container (.tab-group-label-container)
      const container = group.querySelector(".tab-group-label-container");
      if (container) {
        const cs = window.getComputedStyle(container);
        const rect = container.getBoundingClientRect();
        lines.push(`  ├─ .tab-group-label-container:`);
        lines.push(`  │    Size & Rect: ${rect.width.toFixed(1)}px x ${rect.height.toFixed(1)}px (at left:${rect.left.toFixed(1)}, top:${rect.top.toFixed(1)})`);
        lines.push(`  │    Display/Layout: display=${cs.display}, flexDir=${cs.flexDirection}, alignSelf=${cs.alignSelf}, width=${cs.width}, height=${cs.height}`);
        lines.push(`  │    Background: ${cs.backgroundColor} | image=${cs.backgroundImage !== 'none' ? 'present' : 'none'}`);
        lines.push(`  │    Border & Radius: border=${cs.border}, borderRadius=${cs.borderRadius}`);
        lines.push(`  │    Box Shadow: ${cs.boxShadow}`);
      } else {
        lines.push(`  ├─ .tab-group-label-container: NOT FOUND`);
      }

      // 2. Text Element (.tab-group-label)
      const labelTextEl = group.querySelector(".tab-group-label");
      if (labelTextEl) {
        const cs = window.getComputedStyle(labelTextEl);
        const rect = labelTextEl.getBoundingClientRect();
        lines.push(`  ├─ .tab-group-label:`);
        lines.push(`  │    Content: "${labelTextEl.textContent}"`);
        lines.push(`  │    Size & Rect: ${rect.width.toFixed(1)}px x ${rect.height.toFixed(1)}px`);
        lines.push(`  │    Typography: color=${cs.color}, fontSize=${cs.fontSize}, fontWeight=${cs.fontWeight}`);
        lines.push(`  │    Overflow/Width: width=${cs.width}, overflow=${cs.overflow}, textOverflow=${cs.textOverflow}, display=${cs.display}`);
      } else {
        lines.push(`  ├─ .tab-group-label: NOT FOUND`);
      }

      // 3. Icon/Chevron Container (.tab-group-icon)
      const iconEl = group.querySelector(".tab-group-icon");
      if (iconEl) {
        const cs = window.getComputedStyle(iconEl);
        const rect = iconEl.getBoundingClientRect();
        const children = Array.from(iconEl.children).map(c => `${c.tagName.toLowerCase()}${c.className ? '.' + c.className.trim().split(/\s+/).join('.') : ''}`);
        
        let beforeCs = {}, afterCs = {};
        try {
          beforeCs = window.getComputedStyle(iconEl, "::before");
          afterCs  = window.getComputedStyle(iconEl, "::after");
        } catch (_) {}
        
        lines.push(`  ├─ .tab-group-icon:`);
        lines.push(`  │    Size & Rect: ${rect.width.toFixed(1)}px x ${rect.height.toFixed(1)}px`);
        lines.push(`  │    Display/Color: display=${cs.display}, color=${cs.color}, bg=${cs.backgroundColor}`);
        lines.push(`  │    Children (${children.length}): [${children.join(", ")}]`);
        lines.push(`  │    ::before: display=${beforeCs.display || 'n/a'}, content=${beforeCs.content || 'n/a'}`);
        lines.push(`  │    ::after: display=${afterCs.display || 'n/a'}, transform=${afterCs.transform || 'n/a'}, maskImage=${afterCs.maskImage && afterCs.maskImage !== 'none' ? 'present' : 'none'}`);
      } else {
        lines.push(`  ├─ .tab-group-icon: NOT FOUND`);
      }

      // 4. Initials Badge (.zentral-group-initials)
      const initialsEl = group.querySelector(".zentral-group-initials");
      if (initialsEl) {
        const cs = window.getComputedStyle(initialsEl);
        lines.push(`  ├─ .zentral-group-initials: display=${cs.display}, text="${initialsEl.textContent}"`);
      }

      // 5. ShadowRoot info
      if (group.shadowRoot) {
        const hasZentralStyle = !!group.shadowRoot.querySelector(".zentral-shadow-style");
        lines.push(`  └─ ShadowRoot: present (hasZentralShadowStyle: ${hasZentralStyle})`);
      } else {
        lines.push(`  └─ ShadowRoot: none`);
      }
    });

    return lines.join("\n");
  }

  // Real-time Tab Group Mutation Observer
  const tabGroupObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target.tagName?.toUpperCase() === "TAB-GROUP") {
        const group = m.target;
        const label = group.label || group.getAttribute("label") || "(no title)";
        const collapsed = group.hasAttribute("collapsed");
        ZenzeiLogger.log("Group-Mutation", `Group "${label}" attribute "${m.attributeName}" mutated (collapsed: ${collapsed})`);
      }
    }
  });

  function startGroupObserver() {
    const tabContainer = document.getElementById("tabbrowser-tabs") || document.body;
    tabGroupObserver.observe(tabContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["collapsed", "label", "style", "class"]
    });
  }

  if (document.readyState === "complete") {
    startGroupObserver();
  } else {
    window.addEventListener("DOMContentLoaded", startGroupObserver);
  }

  // -------------------------------------------------------------------------
  // Log Exporter (Alt+L)
  // -------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "l" && e.key !== "L")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exportLog();
  }, true);

  function exportLog() {
    try {
      const now  = new Date();
      const pad  = n => String(n).padStart(2, "0");
      const name = `zen_tab_peek_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.log`;

      const chromeDir = Services.dirsvc.get("UChrm", Ci.nsIFile);
      const logsDir   = chromeDir.clone();
      logsDir.append("logs");
      if (!logsDir.exists()) {
        logsDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      }
      const file = logsDir.clone();
      file.append(name);

      const fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      fos.init(file, 0x02 | 0x08 | 0x20, 0o644, 0);

      const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
      cos.init(fos, "UTF-8");

      cos.writeString(`Zen Tab Peek & Zenzei Diagnostic Event Log — exported ${now.toISOString()}\n`);
      cos.writeString(`${"=".repeat(80)}\n`);
      cos.writeString(`Window Metrics: ${window.innerWidth}x${window.innerHeight} | DPR: ${window.devicePixelRatio}\n`);
      cos.writeString(`Document Title: ${document.title}\n`);
      cos.writeString(`${"=".repeat(80)}\n\n`);

      cos.writeString(`\n${"=".repeat(80)}\n`);
      cos.writeString(`TAB GROUP LABEL & RENDERING DIAGNOSTIC SNAPSHOT\n`);
      cos.writeString(`${"=".repeat(80)}\n`);
      cos.writeString(captureTabGroupRenderingSnapshot() + "\n\n");

      cos.writeString(`${"=".repeat(80)}\n`);
      cos.writeString(`EVENT LOG TRACE\n`);
      cos.writeString(`${"=".repeat(80)}\n\n`);

      const content = ringBuffer.length
        ? ringBuffer.join("\n")
        : "[No diagnostic events recorded yet]";

      cos.writeString(content);
      cos.writeString(`\n\n${"=".repeat(80)}\n`);
      cos.writeString(`Total log entries: ${ringBuffer.length}\n`);
      cos.close();
      fos.close();

      _log(`[ZenzeiLogger] Log saved successfully to chrome/logs/${name}`);
    } catch (err) {
      _error("[ZenzeiLogger] Failed to export log:", err);
    }
  }

  ZenzeiLogger.log("ZenzeiLogger", "Diagnostic Logger v2.1 initialized. Ready (capturing labels, icons & DOM rendering metrics) — press Alt+L to save logs.");

})();
