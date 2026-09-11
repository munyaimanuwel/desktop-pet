// Pure habitat geometry for the floor-walking pet.
// No Electron imports so the math stays unit-testable with node:test.

// The floor is the bottom of the display work area (excludes the taskbar/Dock).
function floorY(workArea, windowHeight) {
  return workArea.y + workArea.height - windowHeight;
}

// Keep X inside a work area. Y is deliberately not clamped here.
function clampX(workArea, x, windowWidth) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - windowWidth;
  if (maxX <= minX) return minX;
  return Math.min(Math.max(x, minX), maxX);
}

// Other usable displays to hop to (ignore mirrored/tiny virtual displays).
function otherDisplays(displays, currentId) {
  return (displays || []).filter(
    (d) => d && d.workArea && d.id !== currentId && d.workArea.width > 200
  );
}

// Prefer a horizontally adjacent monitor so a hop reads as "walk to the edge,
// step across". Fall back to any other display (stacked monitors jump).
function pickHopTarget(current, others, random = Math.random) {
  if (!others || !others.length) return null;
  const currentArea = current.workArea;
  const adjacent = others.filter((d) => {
    const area = d.workArea;
    return (
      Math.abs(currentArea.x + currentArea.width - area.x) < 8 ||
      Math.abs(area.x + area.width - currentArea.x) < 8
    );
  });
  const pool = adjacent.length ? adjacent : others;
  return pool[Math.floor(random() * pool.length)];
}

// Where to land on the destination work area: inset from the arriving edge,
// facing inward. Stacked/diagonal displays land near the current X.
function hopLanding(destArea, fromArea, windowWidth, random = Math.random) {
  if (Math.abs(fromArea.x + fromArea.width - destArea.x) < 8) {
    return { x: destArea.x + 24, facing: 1 };
  }
  if (Math.abs(destArea.x + destArea.width - fromArea.x) < 8) {
    return { x: destArea.x + destArea.width - windowWidth - 24, facing: -1 };
  }
  return { x: clampX(destArea, fromArea.x, windowWidth), facing: random() < 0.5 ? -1 : 1 };
}

// The edge of the current work area to walk to before hopping toward dest.
function hopEdgeX(currentArea, destArea, windowWidth) {
  const destIsRight = destArea.x >= currentArea.x;
  const maxX = currentArea.x + currentArea.width - windowWidth;
  const raw = destIsRight ? maxX - 12 : currentArea.x + 12;
  return clampX(currentArea, raw, windowWidth);
}

module.exports = { floorY, clampX, otherDisplays, pickHopTarget, hopLanding, hopEdgeX };
