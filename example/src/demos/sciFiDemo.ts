import type { Renderer } from "../../../src";

const WHITE: [number, number, number, number] = [1, 1, 1, 1];
const GREY: [number, number, number, number] = [0.7, 0.7, 0.7, 1];
const DIM: [number, number, number, number] = [0.3, 0.3, 0.3, 1];
const RED: [number, number, number, number] = [1, 0.23, 0.23, 1];
const CYAN: [number, number, number, number] = [0.2, 0.85, 0.95, 1];
const AMBER: [number, number, number, number] = [0.95, 0.72, 0.25, 1];
const WEDGE_FILL: [number, number, number, number] = [0.15, 0.45, 0.5, 0.28];

export interface SciFiDemoStats {
  lastVertexCount: number;
  lastCmdBefore: number;
  lastCmdAfter: number;
  lastRenderMs: number;
}

export function drawSciFiDemo(
  renderer: Renderer,
  time: number,
  w: number,
  h: number,
  stats: SciFiDemoStats
): void {
  // Title
  renderer.drawText("COMMAND BUFFER", 24, 28, WHITE);
  renderer.drawLine(24, 50, 220, 50, 1, GREY);

  // Data readouts with brackets
  const timeStr = (time / 1000).toFixed(2);
  const fps = (1000 / 16).toFixed(0);
  renderer.drawText("TIME", 24, 68, DIM);
  renderer.drawText(timeStr, 24, 86, WHITE);
  drawBracketFrame(renderer, 20, 64, 88, 32);
  renderer.drawText("FPS", 124, 68, DIM);
  renderer.drawText(fps, 124, 86, WHITE);
  drawBracketFrame(renderer, 120, 64, 56, 32);
  renderer.drawText("STATUS", 24, 118, DIM);
  renderer.drawText("ONLINE", 24, 136, WHITE);
  drawBracketFrame(renderer, 20, 114, 72, 32);
  renderer.drawRect({ x: 98, y: 128, w: 6, h: 6 }, RED);

  // Panel grid
  const panelW = 180;
  const panelH = 140;
  const gap = 12;
  const cols = 3;
  const rows = 2;
  const gridStartX = 24;
  const gridStartY = 168;
  const panelVariants: Array<{
    title: string;
    rank: string;
    status: string;
    barPhase: number;
    barCount?: number;
    indicator?: boolean;
  }> = [
    { title: "SYS A", rank: "0028", status: "OK", barPhase: 0, indicator: true },
    { title: "SYS B", rank: "0035", status: "OK", barPhase: 1.2, barCount: 6 },
    { title: "SYS C", rank: "0008", status: "IDLE", barPhase: 2.1 },
    { title: "SYS D", rank: "0042", status: "OK", barPhase: 0.7, barCount: 10, indicator: true },
    { title: "SYS E", rank: "0015", status: "WARN", barPhase: 1.8 },
    { title: "SYS F", rank: "0022", status: "OK", barPhase: 3.0, barCount: 7 },
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const px = gridStartX + col * (panelW + gap);
      const py = gridStartY + row * (panelH + gap);
      const opts = panelVariants[idx] ?? panelVariants[0];
      drawSystemPanel(renderer, px, py, panelW, panelH, time, opts);
    }
  }

  // Radar
  const gridEndX = gridStartX + cols * (panelW + gap);
  const radarX = gridEndX + 90;
  const radarY = h - 140;
  const radarRadius = 70;
  const radarPad = 16;
  drawRadarSweep(renderer, radarX, radarY, radarRadius, time);
  drawAcquisitionBracket(renderer, radarX, radarY, time);
  renderer.drawText("RADAR", radarX - 28, radarY - radarRadius - 20, DIM);
  drawBracketFrame(
    renderer,
    radarX - radarRadius - radarPad,
    radarY - radarRadius - radarPad - 22,
    (radarRadius + radarPad) * 2,
    radarRadius * 2 + radarPad * 2 + 22,
    12
  );

  // Right-side readout + primitive showcase (rounded shapes, arcs, polygons)
  const rx = w - 220;
  const outH = 248;
  renderer.drawRectOutline({ x: rx, y: 24, w: 196, h: outH }, 1, WHITE);
  renderer.drawText("OUTPUT", rx + 8, 42, WHITE);
  renderer.drawLine(rx + 8, 56, rx + 188, 56, 0.8, DIM);
  renderer.drawText("VRTX", rx + 8, 74, DIM);
  renderer.drawText("--", rx + 120, 74, GREY);
  renderer.drawText("CMD", rx + 8, 92, DIM);
  renderer.drawText("--", rx + 120, 92, GREY);
  renderer.drawText("DRAW", rx + 8, 110, DIM);
  renderer.drawText("--", rx + 120, 110, GREY);
  drawBracketFrame(renderer, rx + 116, 70, 64, 48, 8);

  renderer.drawText("BUS", rx + 8, 128, DIM);
  renderer.drawRoundedRect({ x: rx + 8, y: 138, w: 180, h: 22 }, 6, [0.08, 0.1, 0.12, 1]);
  renderer.drawRoundedRectOutline({ x: rx + 8, y: 138, w: 180, h: 22 }, 6, 1, CYAN);
  const syncPhase = (time / 2600) % 1;
  const gx = rx + 98;
  const gy = 198;
  renderer.drawText("SYNC", rx + 8, 172, DIM);
  renderer.drawArcOutline(gx, gy, 28, -Math.PI * 0.82, Math.PI * 0.82, 1.1, WHITE, 36);
  renderer.drawArc(gx, gy, 23, -Math.PI * 0.82, -Math.PI * 0.82 + Math.PI * 1.64 * syncPhase, AMBER, 28);
  renderer.drawTriangleOutline(gx, gy - 38, gx - 8, gy - 52, gx + 8, gy - 52, 1, RED);
  renderer.drawTriangle(gx - 14, gy + 44, gx + 14, gy + 44, gx, gy + 58, [0.25, 0.28, 0.32, 1]);
  renderer.drawQuad(
    rx + 138,
    218,
    rx + 184,
    226,
    rx + 174,
    252,
    rx + 122,
    244,
    [0.12, 0.35, 0.38, 0.85]
  );
  renderer.drawQuadOutline(rx + 138, 218, rx + 184, 226, rx + 174, 252, rx + 122, 244, 1, GREY);

  // Grid lines
  for (let i = 1; i <= 4; i++) {
    const gx = w * 0.25 * i;
    renderer.drawLine(gx, 0, gx, h, 0.5, DIM);
  }
  for (let i = 1; i <= 4; i++) {
    const gy = h * 0.25 * i;
    renderer.drawLine(0, gy, w, gy, 0.5, DIM);
  }

  // Bottom stats
  const statY = h - 44;
  const statBoxH = 20;
  const statBoxY = statY - 15;
  renderer.drawText("VRTX", 24, statY, DIM);
  renderer.drawText(String(stats.lastVertexCount), 64, statY, WHITE);
  drawBracketFrame(renderer, 60, statBoxY, 56, statBoxH, 6);
  renderer.drawText("CMD", 128, statY, DIM);
  renderer.drawText(`${stats.lastCmdBefore}→${stats.lastCmdAfter}`, 164, statY, WHITE);
  drawBracketFrame(renderer, 160, statBoxY, 52, statBoxH, 6);
  renderer.drawText("MS", 220, statY, DIM);
  renderer.drawText(stats.lastRenderMs.toFixed(2), 248, statY, WHITE);
  drawBracketFrame(renderer, 244, statBoxY, 48, statBoxH, 6);

  renderer.resetTransform();
}

function drawBracket(
  renderer: Renderer,
  cx: number,
  cy: number,
  size: number,
  thickness: number,
  corner: "tl" | "tr" | "bl" | "br"
) {
  const t = thickness;
  if (corner === "tl") {
    renderer.drawLine(cx, cy, cx + size, cy, t, WHITE);
    renderer.drawLine(cx, cy, cx, cy + size, t, WHITE);
  } else if (corner === "tr") {
    renderer.drawLine(cx - size, cy, cx, cy, t, WHITE);
    renderer.drawLine(cx, cy, cx, cy + size, t, WHITE);
  } else if (corner === "bl") {
    renderer.drawLine(cx, cy - size, cx, cy, t, WHITE);
    renderer.drawLine(cx, cy, cx + size, cy, t, WHITE);
  } else {
    renderer.drawLine(cx, cy - size, cx, cy, t, WHITE);
    renderer.drawLine(cx - size, cy, cx, cy, t, WHITE);
  }
}

function drawBracketFrame(
  renderer: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number = 12
) {
  drawBracket(renderer, x, y, size, 1.5, "tl");
  drawBracket(renderer, x + w, y, size, 1.5, "tr");
  drawBracket(renderer, x, y + h, size, 1.5, "bl");
  drawBracket(renderer, x + w, y + h, size, 1.5, "br");
}

function drawRadarSweep(
  renderer: Renderer,
  cx: number,
  cy: number,
  radius: number,
  time: number
) {
  renderer.drawCircleOutline(cx, cy, radius, 1.2, WHITE, 32);
  renderer.drawCircleOutline(cx, cy, radius * 0.5, 0.8, DIM, 24);
  const sweep = (time / 2000) % (Math.PI * 2);
  const wedge = 0.42;
  renderer.drawArc(cx, cy, radius * 0.92, sweep - wedge, sweep + wedge * 0.15, WEDGE_FILL, 28);
  const ex = cx + Math.cos(sweep) * radius;
  const ey = cy + Math.sin(sweep) * radius;
  renderer.drawLine(cx, cy, ex, ey, 1.2, RED);
  renderer.drawCircle(ex, ey, 5, CYAN, 16);
  renderer.drawCircle(cx - radius * 0.35, cy + radius * 0.22, 3, AMBER, 12);
  renderer.drawArcOutline(cx, cy, radius * 0.72, sweep + 0.9, sweep + 2.1, 0.9, GREY, 20);
  renderer.drawLine(cx - radius, cy, cx + radius, cy, 0.8, DIM);
  renderer.drawLine(cx, cy - radius, cx, cy + radius, 0.8, DIM);
}

/** Rotating lock geometry: translate → rotate → scale, then save/restore nesting. */
function drawAcquisitionBracket(
  renderer: Renderer,
  cx: number,
  cy: number,
  time: number
) {
  renderer.save();
  renderer.translate(cx, cy);
  renderer.rotate((time / 2400) * (Math.PI * 2));
  renderer.scale(1.12, 1.12);
  renderer.save();
  renderer.rotate(Math.PI / 4);
  const s = 22;
  renderer.drawRoundedRect({ x: -s, y: -s, w: s * 2, h: s * 2 }, 4, [0.2, 0.85, 0.95, 0.12]);
  renderer.drawRoundedRectOutline({ x: -s, y: -s, w: s * 2, h: s * 2 }, 4, 1, CYAN);
  renderer.restore();
  const d = 36;
  renderer.drawTriangle(-d, 0, -d - 12, -8, -d - 12, 8, CYAN);
  renderer.drawTriangle(d, 0, d + 12, -8, d + 12, 8, CYAN);
  renderer.drawTriangle(0, -d, -8, -d - 12, 8, -d - 12, CYAN);
  renderer.drawTriangle(0, d, -8, d + 12, 8, d + 12, CYAN);
  renderer.drawQuad(-10, -10, 12, -7, 9, 11, -14, 8, [0.95, 0.55, 0.15, 0.35]);
  renderer.drawQuadOutline(-10, -10, 12, -7, 9, 11, -14, 8, 0.9, WHITE);
  renderer.restore();
}

function drawSystemPanel(
  renderer: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
  opts: {
    title: string;
    rank: string;
    status: string;
    barPhase: number;
    barCount?: number;
    indicator?: boolean;
  }
) {
  const { title, rank, status, barPhase, barCount = 8, indicator = false } = opts;
  renderer.drawRectOutline({ x, y, w, h }, 1, WHITE);
  renderer.drawText(title, x + 8, y + 20, WHITE);
  renderer.drawLine(x + 8, y + 34, x + w - 8, y + 34, 0.8, DIM);
  renderer.drawText("RANK", x + 8, y + 50, DIM);
  renderer.drawText(rank, x + 70, y + 50, WHITE);
  renderer.drawText("BUFFER", x + 8, y + 72, DIM);
  renderer.drawText(status, x + 70, y + 72, WHITE);
  drawBracketFrame(renderer, x + 66, y + 36, 40, 20, 6);
  if (indicator) {
    renderer.drawRect({ x: x + w - 22, y: y + 64, w: 6, h: 6 }, RED);
  }
  const barY = y + 100;
  const barStep = (w - 24) / barCount;
  for (let i = 0; i < barCount; i++) {
    const bx = x + 8 + i * barStep;
    const bw = Math.max(8, barStep - 4);
    const bh = 20 + Math.sin(time / 400 + barPhase + i * 0.8) * 12;
    renderer.drawRect({ x: bx, y: barY + (24 - bh), w: bw, h: bh }, i % 3 === 0 ? WHITE : GREY);
  }
  renderer.drawText("OUT", x + 8, barY + 30, DIM);
}
