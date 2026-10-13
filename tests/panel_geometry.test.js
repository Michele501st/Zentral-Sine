/**
 * tests/panel_geometry.test.js
 * Unit tests for zentral_panel_geometry.uc.js using Node.js built-in assert module.
 */

const assert = require("assert");
const Geometry = require("../JS/zentral_panel_geometry.uc.js");

console.log("Running ZentralPanelGeometry tests...");

// 1. clampRect
{
  const bounds = { left: 50, top: 20, width: 1000, height: 800 };

  // Normal inside
  const normal = Geometry.clampRect({ x: 200, y: 100, w: 400, h: 500 }, bounds);
  assert.strictEqual(normal.x, 200);
  assert.strictEqual(normal.y, 100);
  assert.strictEqual(normal.w, 400);
  assert.strictEqual(normal.h, 500);

  // Left & Top overflow
  const leftTop = Geometry.clampRect({ x: 10, y: -10, w: 400, h: 500 }, bounds);
  assert.strictEqual(leftTop.x, 50);
  assert.strictEqual(leftTop.y, 20);

  // Right & Bottom overflow
  const rightBottom = Geometry.clampRect({ x: 800, y: 600, w: 400, h: 500 }, bounds);
  assert.strictEqual(rightBottom.x, 50 + 1000 - 400); // 650
  assert.strictEqual(rightBottom.y, 20 + 800 - 500);  // 320

  // Minimum dimensions enforcement
  const tooSmall = Geometry.clampRect({ x: 200, y: 100, w: 100, h: 100 }, bounds, { minW: 320, minH: 360 });
  assert.strictEqual(tooSmall.w, 320);
  assert.strictEqual(tooSmall.h, 360);

  // Degenerate / zero / NaN inputs resilience
  const zeroRect = Geometry.clampRect({ x: 0, y: 0, w: 0, h: 0 }, bounds, { minW: 320, minH: 360 });
  assert.strictEqual(zeroRect.w, 320);
  assert.strictEqual(zeroRect.h, 360);
  assert.strictEqual(zeroRect.x, 50);
  assert.strictEqual(zeroRect.y, 20);

  const nanRect = Geometry.clampRect({ x: NaN, y: NaN, w: NaN, h: NaN }, bounds, { minW: 320, minH: 360 });
  assert.strictEqual(nanRect.w, 320);
  assert.strictEqual(nanRect.h, 360);
  assert.strictEqual(nanRect.x, 50);
  assert.strictEqual(nanRect.y, 20);

  // Overflow / OS-window beyond screen limit testing
  const overflowOptions = { allowOverflow: true, minVisibleMargin: 80 };
  // Dragged partially off left edge
  const offLeft = Geometry.clampRect({ x: -200, y: 100, w: 400, h: 500 }, bounds, { minW: 320, minH: 360 }, overflowOptions);
  assert.strictEqual(offLeft.x, -200); // permitted within margin
  assert.strictEqual(offLeft.y, 100);

  // Dragged excessively off left edge: minX = bounds.left - w + 80 = 50 - 400 + 80 = -270
  const tooFarLeft = Geometry.clampRect({ x: -400, y: 100, w: 400, h: 500 }, bounds, { minW: 320, minH: 360 }, overflowOptions);
  assert.strictEqual(tooFarLeft.x, -270); // leaves exactly 80px visible

  // Dragged excessively off right edge: maxX = bounds.left + bounds.width - 80 = 50 + 1000 - 80 = 970
  const tooFarRight = Geometry.clampRect({ x: 1900, y: 100, w: 400, h: 500 }, bounds, { minW: 320, minH: 360 }, overflowOptions);
  assert.strictEqual(tooFarRight.x, 970);

  // Off top edge: must stay reachable at bounds.top
  const offTop = Geometry.clampRect({ x: 200, y: -50, w: 400, h: 500 }, bounds, { minW: 320, minH: 360 }, overflowOptions);
  assert.strictEqual(offTop.y, 20); // bounds.top

  // Dragged excessively off bottom edge: maxY = bounds.top + bounds.height - 80 = 20 + 800 - 80 = 740
  const tooFarBottom = Geometry.clampRect({ x: 200, y: 1000, w: 400, h: 500 }, bounds, { minW: 320, minH: 360 }, overflowOptions);
  assert.strictEqual(tooFarBottom.y, 740);

  console.log("✓ clampRect passed");
}

// 2. getDockSlots (Sidebar Placement, Standard vs Collapsed vs Opposite)
{
  const params = {
    contentRect: { left: 250, right: 1908, top: 40, bottom: 1068, width: 1658, height: 1028 },
    sidebarRect: { left: 0, right: 240, width: 240, height: 1080 },
    isSidebarRight: false,
    isPlacementVerticalBar: false,
    isSidebarCollapsed: false,
    gap: 12,
    collapsedGap: 7,
    panelWidth: 420,
    topInset: 40,
    windowWidth: 1920,
    windowHeight: 1080
  };

  const slots = Geometry.getDockSlots(params);
  // Sidebar slot on left, adjacent to sidebar right (240 + 12 = 252)
  assert.strictEqual(slots.sidebar.side, "left");
  assert.strictEqual(slots.sidebar.x, 252);
  assert.strictEqual(slots.sidebar.w, 420);
  assert.strictEqual(slots.sidebar.y, 40);

  // Opposite slot on screen right edge (1920 - 12 - 420 = 1488)
  assert.strictEqual(slots.opposite.side, "right");
  assert.strictEqual(slots.opposite.x, 1488);
  assert.strictEqual(slots.opposite.w, 420);

  // Collapsed sidebar scenario (gap = 7)
  const collapsedSlots = Geometry.getDockSlots({
    ...params,
    sidebarRect: { left: 0, right: 48, width: 48, height: 1080 },
    isSidebarCollapsed: true
  });
  assert.strictEqual(collapsedSlots.sidebar.x, 48 + 7); // 55
  assert.strictEqual(collapsedSlots.opposite.x, 1920 - 12 - 420);

  console.log("✓ getDockSlots (Sidebar) passed");
}

// 3. getDockSlots (Vertical Bar Placement)
{
  const params = {
    contentRect: { left: 50, right: 1860, top: 40, bottom: 1068, width: 1810, height: 1028 },
    sidebarRect: { left: 0, right: 240, width: 240, height: 1080 },
    vbRect: { left: 1876, right: 1920, width: 44, height: 1080 },
    isSidebarRight: false,
    isPlacementVerticalBar: true,
    isSidebarCollapsed: false,
    isVbRevealed: true,
    gap: 12,
    collapsedGap: 7,
    panelWidth: 420,
    topInset: 40,
    windowWidth: 1920,
    windowHeight: 1080
  };

  const slots = Geometry.getDockSlots(params);
  // Vertical bar is opposite Zen sidebar -> on right. Sidebar slot attaches to VB (1920 - (44 + 12) - 420 = 1444)
  assert.strictEqual(slots.sidebar.side, "right");
  assert.strictEqual(slots.sidebar.x, 1444);

  // Opposite slot attaches to Zen sidebar on left (240 + 12 = 252)
  assert.strictEqual(slots.opposite.side, "left");
  assert.strictEqual(slots.opposite.x, 252);

  // When VB is autohidden/not revealed, offset does not include vb width
  const hiddenVbSlots = Geometry.getDockSlots({ ...params, isVbRevealed: false });
  assert.strictEqual(hiddenVbSlots.sidebar.x, 1920 - 12 - 420);

  console.log("✓ getDockSlots (Vertical Bar) passed");
}

// 4. hitTestSnapZone
{
  const bounds = { left: 100, right: 1800 };
  assert.strictEqual(Geometry.hitTestSnapZone(120, bounds, 40, false), "sidebar");
  assert.strictEqual(Geometry.hitTestSnapZone(1780, bounds, 40, false), "opposite");
  assert.strictEqual(Geometry.hitTestSnapZone(500, bounds, 40, false), null);

  // When attached to right by default, sides are reversed
  assert.strictEqual(Geometry.hitTestSnapZone(120, bounds, 40, true), "opposite");
  assert.strictEqual(Geometry.hitTestSnapZone(1780, bounds, 40, true), "sidebar");

  // Panel border proximity hit testing
  assert.strictEqual(Geometry.hitTestSnapZone({ pointerX: 500, panelRect: { x: 110, w: 400 } }, bounds, 40, false), "sidebar");
  assert.strictEqual(Geometry.hitTestSnapZone({ pointerX: 500, panelRect: { x: 1380, w: 400 } }, bounds, 40, false), "opposite");
  assert.strictEqual(Geometry.hitTestSnapZone({ pointerX: 500, panelRect: { x: 500, w: 400 } }, bounds, 40, false), null);

  // Slot-based proximity hit testing (Zen Browser layout with right sidebar)
  const slotParams = {
    contentRect: { left: 50, right: 1612, top: 40, bottom: 1068, width: 1562, height: 1028 },
    sidebarRect: { left: 1624, right: 1920, width: 296, height: 1080 },
    isSidebarRight: true,
    isPlacementVerticalBar: false,
    isSidebarCollapsed: false,
    gap: 12,
    collapsedGap: 7,
    panelWidth: 420,
    topInset: 40,
    windowWidth: 1920,
    windowHeight: 1080
  };
  const zenSlots = Geometry.getDockSlots(slotParams);
  // zenSlots.sidebar is on right: x = 1624 - 12 - 420 = 1192, w = 420 -> rightEdge = 1612
  // zenSlots.opposite is on left: x = 12, w = 420 -> leftEdge = 12

  // Panel approaching right docking zone (sidebar on right)
  // Panel right edge at 1550 -> distance to 1612 is 62px <= 80px threshold
  assert.strictEqual(
    Geometry.hitTestSnapZone({ pointerX: 1300, panelRect: { x: 1130, w: 420 } }, zenSlots, 80),
    "sidebar"
  );

  // Panel approaching left docking zone (opposite on left)
  // Panel left edge at 70 -> distance to 12 is 58px <= 80px threshold
  assert.strictEqual(
    Geometry.hitTestSnapZone({ pointerX: 200, panelRect: { x: 70, w: 420 } }, zenSlots, 80),
    "opposite"
  );

  // Panel approaching left docking zone using DOMRect format {left, width}
  assert.strictEqual(
    Geometry.hitTestSnapZone({ pointerX: 500, panelRect: { left: 60, width: 420 } }, zenSlots),
    "opposite"
  );

  // Panel dragged partially off-screen on the left (x = -30px)
  assert.strictEqual(
    Geometry.hitTestSnapZone({ pointerX: 400, panelRect: { x: -30, w: 420 } }, zenSlots),
    "opposite"
  );

  console.log("✓ hitTestSnapZone passed");
}

// 5. computeResize
{
  const start = { x: 400, y: 300, w: 400, h: 400 };

  // South-East
  const se = Geometry.computeResize("se", start, 50, 60);
  assert.strictEqual(se.w, 450);
  assert.strictEqual(se.h, 460);
  assert.strictEqual(se.x, 400);
  assert.strictEqual(se.y, 300);

  // North-West
  const nw = Geometry.computeResize("nw", start, -30, -40);
  assert.strictEqual(nw.w, 430);
  assert.strictEqual(nw.h, 440);
  assert.strictEqual(nw.x, 370);
  assert.strictEqual(nw.y, 260);

  // South-East with swapped argument order (start, "se")
  const seReversed = Geometry.computeResize(start, "se", 50, 60);
  assert.strictEqual(seReversed.w, 450);
  assert.strictEqual(seReversed.h, 460);

  // Single-axis East ("e") and South ("s")
  const eOnly = Geometry.computeResize("e", start, 40, 0);
  assert.strictEqual(eOnly.w, 440);
  assert.strictEqual(eOnly.h, 400);

  const sOnly = Geometry.computeResize("s", start, 0, 70);
  assert.strictEqual(sOnly.w, 400);
  assert.strictEqual(sOnly.h, 470);

  // Minimum constraint clamping
  const minClamp = Geometry.computeResize("se", start, -200, -200, { minW: 320, minH: 360 });
  assert.strictEqual(minClamp.w, 320);
  assert.strictEqual(minClamp.h, 360);

  console.log("✓ computeResize passed");
}

// 6. pickPillSide
{
  const bounds = { left: 0, width: 1000 };
  // Panel close to right boundary -> must flip to left
  assert.strictEqual(Geometry.pickPillSide({ x: 700, w: 280 }, bounds, 44, "right"), "left");

  // Panel close to left boundary -> must flip to right
  assert.strictEqual(Geometry.pickPillSide({ x: 20, w: 300 }, bounds, 44, "left"), "right");

  // Middle position honors preferred
  assert.strictEqual(Geometry.pickPillSide({ x: 400, w: 300 }, bounds, 44, "right"), "right");
  assert.strictEqual(Geometry.pickPillSide({ x: 400, w: 300 }, bounds, 44, "left"), "left");

  // Off-screen defensive pill placement
  const offScreenBounds = { left: 0, width: 1920 };
  // Partially off left edge (spaceLeft is negative): pill must be placed on visible right side
  assert.strictEqual(Geometry.pickPillSide({ x: -100, w: 400 }, offScreenBounds, 44, "left"), "right");
  // Partially off right edge (spaceRight is negative): pill must be placed on visible left side
  assert.strictEqual(Geometry.pickPillSide({ x: 1800, w: 400 }, offScreenBounds, 44, "right"), "left");

  console.log("✓ pickPillSide passed");
}

// 7. Detachment & Session Cache Sanitization Tests
{
  const bounds = { left: 12, top: 40, width: 1896, height: 988 };

  // Test startRect format { x, y, w, h } vs { left, top, width, height }
  const startRect = { x: 1200, y: 12, w: 420, h: 1016, left: 1200, top: 12, width: 420, height: 1016 };
  const rawTop = (typeof startRect.top === "number" && !isNaN(startRect.top)) ? startRect.top : bounds.top;
  const rawHeight = (typeof startRect.height === "number" && !isNaN(startRect.height) && startRect.height > 0) ? startRect.height : bounds.height;
  const newY = rawTop + 16;
  const newH = Math.max(360, rawHeight - 32);
  assert.strictEqual(newY, 28);
  assert.strictEqual(newH, 984);
  assert.ok(!isNaN(newY));
  assert.ok(!isNaN(newH));

  // Test degenerate saved cache (0-height or NaN from prior crash)
  const poisonedCache = { x: 725, y: 0, w: 420, h: 0 };
  const isValidCache = (
    poisonedCache &&
    typeof poisonedCache.w === "number" && !isNaN(poisonedCache.w) && poisonedCache.w >= 320 &&
    typeof poisonedCache.h === "number" && !isNaN(poisonedCache.h) && poisonedCache.h >= 200
  );
  assert.strictEqual(isValidCache, false);

  // Clamp on sanitized minimum
  const rescued = Geometry.clampRect(poisonedCache, bounds, { minW: 320, minH: 360 });
  assert.strictEqual(rescued.w, 420);
  assert.strictEqual(rescued.h, 360);
  assert.strictEqual(rescued.y, 40); // clamped to bounds.top

  console.log("✓ detachment sanitization & cache validation passed");
}

console.log("All ZentralPanelGeometry unit tests passed successfully!");

