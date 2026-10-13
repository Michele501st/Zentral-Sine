// ==UserScript==
// @name           Zentral-Panel-Geometry
// @description    Pure geometry calculations for Zentral floating app panels, snap zones, and docking layout.
// @author         Michele Pierini
// @version        v1.1.0
// @include        main
// ==/UserScript==

(function (root, factory) {
  const exported = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  const win = (typeof window !== "undefined") ? window : null;
  const glob = (typeof globalThis !== "undefined") ? globalThis : null;
  if (win) {
    win.ZentralPanelGeometry = exported;
  }
  if (glob) {
    glob.ZentralPanelGeometry = exported;
  }
  if (root && root !== win && root !== glob) {
    root.ZentralPanelGeometry = exported;
  }
  try {
    if (typeof window !== "undefined") window.ZentralPanelGeometry = exported;
    if (typeof globalThis !== "undefined") globalThis.ZentralPanelGeometry = exported;
    console.log("[ZentralGeometry] ZentralPanelGeometry v1.1.0 loaded successfully.");
  } catch (_) {}
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * Clamps a rectangle within boundary dimensions, respecting minimum dimensions and optional overflow.
   * Defensively sanitizes invalid or degenerate input dimensions.
   * When options.allowOverflow is true, permits the panel to be moved partially off-screen like standard
   * OS windows (preserving at least minVisibleMargin on-screen so it is never unreachable).
   * @param {{x: number, y: number, w: number, h: number}} rect - Target rectangle
   * @param {{top: number, left: number, width: number, height: number}} bounds - Available bounding box
   * @param {{minW?: number, minH?: number}} [min] - Minimum allowed dimensions
   * @param {{allowOverflow?: boolean, minVisibleMargin?: number}} [options] - Overflow configuration
   * @returns {{x: number, y: number, w: number, h: number}} Clamped rectangle
   */
  function clampRect(rect, bounds, min = {}, options = {}) {
    const minW = min.minW ?? 320;
    const minH = min.minH ?? 360;

    const availableW = Math.max(minW, bounds.width);
    const availableH = Math.max(minH, bounds.height);

    const inputW = (rect && typeof rect.w === "number" && !isNaN(rect.w) && rect.w > 0) ? rect.w : minW;
    const inputH = (rect && typeof rect.h === "number" && !isNaN(rect.h) && rect.h > 0) ? rect.h : minH;

    let w = Math.max(minW, Math.min(inputW, availableW));
    let h = Math.max(minH, Math.min(inputH, availableH));

    const allowOverflow = options.allowOverflow ?? false;
    const minVisible = options.minVisibleMargin ?? 80;

    let minX, maxX;
    if (allowOverflow) {
      // Allows moving partially off-screen horizontally, keeping at least minVisible px on screen
      minX = bounds.left - w + minVisible;
      maxX = bounds.left + bounds.width - minVisible;
    } else {
      minX = bounds.left;
      maxX = bounds.left + bounds.width - w;
    }

    const inputX = (rect && typeof rect.x === "number" && !isNaN(rect.x)) ? rect.x : bounds.left;
    let x = (bounds.width < w && !allowOverflow) ? bounds.left : Math.max(minX, Math.min(inputX, maxX));

    let minY, maxY;
    if (allowOverflow) {
      // Top stays reachable so titlebar / controls remain accessible
      minY = bounds.top;
      maxY = bounds.top + bounds.height - minVisible;
    } else {
      minY = bounds.top;
      maxY = bounds.top + bounds.height - h;
    }

    const inputY = (rect && typeof rect.y === "number" && !isNaN(rect.y)) ? rect.y : bounds.top;
    let y = (bounds.height < h && !allowOverflow) ? bounds.top : Math.max(minY, Math.min(inputY, maxY));

    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h)
    };
  }

  /**
   * Computes dock slot rectangles based on browser window layout and autohide state.
   * @param {Object} params
   * @param {{left: number, right: number, top: number, bottom: number, width: number, height: number}} params.contentRect
   * @param {{left: number, right: number, width: number, height: number}} [params.sidebarRect]
   * @param {{width: number, left: number, right: number}} [params.vbRect]
   * @param {boolean} [params.isSidebarRight] - True if Zen sidebar is on the right
   * @param {boolean} [params.isPlacementVerticalBar] - True if Zentral apps are placed in opposite vertical bar
   * @param {boolean} [params.isSidebarCollapsed] - True if Zen sidebar is physically collapsed/thin
   * @param {boolean} [params.isVbRevealed] - True if vertical bar is expanded/revealed
   * @param {number} [params.gap] - Normal spacing gap (default 12)
   * @param {number} [params.collapsedGap] - Gap when sidebar is collapsed (default 7)
   * @param {number} [params.panelWidth] - Width for the docked slot (default 420)
   * @param {number} [params.topInset] - Top inset from content area / navbar
   * @param {number} [params.windowWidth] - Window inner width
   * @param {number} [params.windowHeight] - Window inner height
   * @returns {{
   *   sidebar: {x: number, y: number, w: number, h: number, side: 'left'|'right'},
   *   opposite: {x: number, y: number, w: number, h: number, side: 'left'|'right'}
   * }}
   */
  function getDockSlots(params) {
    const {
      contentRect,
      sidebarRect,
      vbRect,
      isSidebarRight = false,
      isPlacementVerticalBar = false,
      isSidebarCollapsed = false,
      isVbRevealed = true,
      gap = 12,
      collapsedGap = 7,
      panelWidth = 420,
      topInset = 12,
      windowWidth = (typeof window !== "undefined" ? window.innerWidth : 1920),
      windowHeight = (typeof window !== "undefined" ? window.innerHeight : 1080)
    } = params;

    const sideGap = isSidebarCollapsed ? collapsedGap : gap;
    const top = Math.max(gap, Math.round(topInset));
    const height = Math.max(200, Math.round(windowHeight - top - gap));
    const w = Math.max(320, Math.round(panelWidth));

    let sidebarSlot = null;
    let oppositeSlot = null;

    if (isPlacementVerticalBar) {
      const isVbRight = !isSidebarRight;
      const vbWidth = (vbRect && vbRect.width > 0) ? vbRect.width : 44;
      const vbOffset = (isVbRevealed ? vbWidth : 0) + sideGap;

      if (isVbRight) {
        // Vertical bar on right (sidebarSlot)
        const sbX = windowWidth - vbOffset - w;
        sidebarSlot = { x: sbX, y: top, w, h: height, side: "right" };

        // Opposite side is the Zen sidebar on left
        let oppLeft = gap;
        if (sidebarRect && sidebarRect.width > 0) {
          oppLeft = Math.max(gap, Math.round(sidebarRect.right) + sideGap);
        }
        oppositeSlot = { x: oppLeft, y: top, w, h: height, side: "left" };
      } else {
        // Vertical bar on left (sidebarSlot)
        const sbX = vbOffset;
        sidebarSlot = { x: sbX, y: top, w, h: height, side: "left" };

        // Opposite side is Zen sidebar on right
        let oppRightOffset = gap;
        if (sidebarRect && sidebarRect.width > 0) {
          oppRightOffset = Math.max(gap, Math.round(windowWidth - sidebarRect.left) + sideGap);
        }
        const oppX = windowWidth - oppRightOffset - w;
        oppositeSlot = { x: oppX, y: top, w, h: height, side: "right" };
      }
    } else {
      // Standard Sidebar placement
      if (isSidebarRight) {
        let sbRightOffset = gap;
        if (sidebarRect && sidebarRect.width > 0) {
          sbRightOffset = Math.max(gap, Math.round(windowWidth - sidebarRect.left) + sideGap);
        }
        const sbX = windowWidth - sbRightOffset - w;
        sidebarSlot = { x: sbX, y: top, w, h: height, side: "right" };

        // Opposite side is the screen left edge
        oppositeSlot = { x: gap, y: top, w, h: height, side: "left" };
      } else {
        let sbLeft = gap;
        if (sidebarRect && sidebarRect.width > 0) {
          sbLeft = Math.max(gap, Math.round(sidebarRect.right) + sideGap);
        }
        sidebarSlot = { x: sbLeft, y: top, w, h: height, side: "left" };

        // Opposite side is the screen right edge
        const oppX = windowWidth - gap - w;
        oppositeSlot = { x: oppX, y: top, w, h: height, side: "right" };
      }
    }

    return { sidebar: sidebarSlot, opposite: oppositeSlot };
  }

  /**
   * Tests whether a pointer or floating panel border falls within an edge snap threshold for docking.
   * Supports both computed dock slots ({ sidebar, opposite }) and legacy content boundaries.
   * @param {number|{pointerX?: number, panelRect?: {x: number, y: number, w: number, h: number}}} pointerOrOptions
   * @param {{sidebar?: Object, opposite?: Object, left?: number, right?: number}} boundsOrSlots
   * @param {number} [threshold=80] - Snap trigger distance in pixels
   * @param {boolean} [isSidebarAttachedRight=false] - Used in legacy boundary mode
   * @returns {'sidebar'|'opposite'|null} Hit snap target or null
   */
  function hitTestSnapZone(pointerOrOptions, boundsOrSlots, threshold = 100, isSidebarAttachedRight = false) {
    if (!boundsOrSlots) return null;
    let pointerX = null;
    let panelRect = null;

    if (typeof pointerOrOptions === "number") {
      pointerX = pointerOrOptions;
    } else if (pointerOrOptions && typeof pointerOrOptions === "object") {
      pointerX = typeof pointerOrOptions.pointerX === "number" ? pointerOrOptions.pointerX : null;
      panelRect = pointerOrOptions.panelRect || null;
    }

    const pX = (panelRect && typeof panelRect.x === "number" && !isNaN(panelRect.x))
      ? panelRect.x
      : ((panelRect && typeof panelRect.left === "number" && !isNaN(panelRect.left)) ? panelRect.left : null);

    const pW = (panelRect && typeof panelRect.w === "number" && !isNaN(panelRect.w))
      ? panelRect.w
      : ((panelRect && typeof panelRect.width === "number" && !isNaN(panelRect.width)) ? panelRect.width : 0);

    const pRight = (pX !== null) ? (pX + pW) : null;

    // 1. Precise Slot-Based Detection (preferred)
    if (boundsOrSlots.sidebar && boundsOrSlots.opposite) {
      const slots = boundsOrSlots;
      const leftSlot = (slots.sidebar.side === "left") ? slots.sidebar : slots.opposite;
      const rightSlot = (slots.sidebar.side === "right") ? slots.sidebar : slots.opposite;

      const leftEdge = leftSlot.x;
      const rightEdge = rightSlot.x + rightSlot.w;

      // Near left dock slot: panel left border close to or past leftEdge, or pointer near leftEdge
      const nearLeft = (
        (pX !== null && pX <= (leftEdge + threshold)) ||
        (pointerX !== null && pointerX <= (leftEdge + threshold + 40))
      );

      // Near right dock slot: panel right border close to or past rightEdge, or pointer near rightEdge
      const nearRight = (
        (pRight !== null && pRight >= (rightEdge - threshold)) ||
        (pointerX !== null && pointerX >= (rightEdge - threshold - 40))
      );

      if (nearLeft && nearRight) {
        if (pX === null) return (leftSlot === slots.sidebar) ? "sidebar" : "opposite";
        const distLeft = Math.abs(pX - leftEdge);
        const distRight = Math.abs(pRight - rightEdge);
        return (distLeft <= distRight)
          ? ((leftSlot === slots.sidebar) ? "sidebar" : "opposite")
          : ((rightSlot === slots.sidebar) ? "sidebar" : "opposite");
      }

      if (nearLeft) {
        return (leftSlot === slots.sidebar) ? "sidebar" : "opposite";
      }
      if (nearRight) {
        return (rightSlot === slots.sidebar) ? "sidebar" : "opposite";
      }
      return null;
    }

    // 2. Legacy bounds mode fallback
    const bounds = boundsOrSlots;
    if (typeof bounds.left === "number" && typeof bounds.right === "number") {
      const nearLeft = (pointerX !== null && pointerX <= (bounds.left + threshold)) ||
                       (pX !== null && pX <= (bounds.left + threshold));

      const nearRight = (pointerX !== null && pointerX >= (bounds.right - threshold)) ||
                        (pRight !== null && pRight >= (bounds.right - threshold));

      if (nearLeft) {
        return isSidebarAttachedRight ? "opposite" : "sidebar";
      }
      if (nearRight) {
        return isSidebarAttachedRight ? "sidebar" : "opposite";
      }
    }

    return null;
  }

  /**
   * Computes resized rectangle based on active resize handle direction and pointer deltas.
   * @param {string} dir - Resize direction: 'n','s','e','w','ne','nw','se','sw'
   * @param {{x: number, y: number, w: number, h: number}} startRect
   * @param {number} dx - Total X movement from start
   * @param {number} dy - Total Y movement from start
   * @param {{minW?: number, minH?: number}} [min] - Minimum dimensions
   * @param {{top: number, left: number, width: number, height: number}} [bounds] - Viewport/content bounds
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  function computeResize(arg1, arg2, dx, dy, min = {}, bounds = null) {
    const dir = (typeof arg1 === "string") ? arg1 : (typeof arg2 === "string" ? arg2 : "se");
    const startRect = (typeof arg1 === "object" && arg1 !== null) ? arg1 : (typeof arg2 === "object" && arg2 !== null ? arg2 : { x: 0, y: 0, w: 420, h: 600 });

    const minW = min?.minW ?? 320;
    const minH = min?.minH ?? 360;

    let { x, y, w, h } = startRect;

    // Horizontal adjustments
    if (dir.includes("e")) {
      w = Math.max(minW, startRect.w + dx);
    } else if (dir.includes("w")) {
      const requestedW = startRect.w - dx;
      if (requestedW >= minW) {
        w = requestedW;
        x = startRect.x + dx;
      } else {
        w = minW;
        x = startRect.x + (startRect.w - minW);
      }
    }

    // Vertical adjustments
    if (dir.includes("s")) {
      h = Math.max(minH, startRect.h + dy);
    } else if (dir.includes("n")) {
      const requestedH = startRect.h - dy;
      if (requestedH >= minH) {
        h = requestedH;
        y = startRect.y + dy;
      } else {
        h = minH;
        y = startRect.y + (startRect.h - minH);
      }
    }

    if (bounds) {
      return clampRect({ x, y, w, h }, bounds, { minW, minH }, { allowOverflow: true, minVisibleMargin: 80 });
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h)
    };
  }

  /**
   * Determines which side of a floating panel the control pill should appear on.
   * Defensively handles partially off-screen windows.
   * @param {{x: number, w: number}} panelRect - Position and width of floating panel
   * @param {{left: number, width: number}} bounds - Container bounds
   * @param {number} [pillWidth=44] - Control pill width plus clearance
   * @param {'left'|'right'} [preferredSide='right'] - Hovered/preferred side
   * @returns {'left'|'right'}
   */
  function pickPillSide(panelRect, bounds, pillWidth = 44, preferredSide = "right") {
    const spaceRight = (bounds.left + bounds.width) - (panelRect.x + panelRect.w);
    const spaceLeft = panelRect.x - bounds.left;

    // If window is shifted off left edge, right side is on-screen
    if (spaceLeft < pillWidth && spaceRight >= pillWidth) {
      return "right";
    }
    // If window is shifted off right edge, left side is on-screen
    if (spaceRight < pillWidth && spaceLeft >= pillWidth) {
      return "left";
    }

    if (preferredSide === "right") {
      if (spaceRight >= pillWidth) return "right";
      if (spaceLeft >= pillWidth) return "left";
      return "right";
    } else {
      if (spaceLeft >= pillWidth) return "left";
      if (spaceRight >= pillWidth) return "right";
      return "left";
    }
  }

  return {
    clampRect,
    getDockSlots,
    hitTestSnapZone,
    computeResize,
    pickPillSide
  };
});
