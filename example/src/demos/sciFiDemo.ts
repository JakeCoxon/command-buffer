import type { Renderer } from "../../../src";

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const GREY: [number, number, number, number] = [180, 180, 180, 255];
const DIM: [number, number, number, number] = [80, 80, 80, 255];
const RED: [number, number, number, number] = [255, 60, 60, 255];

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
  renderer.drawText("COMMAND BUFFER", 24, 28, WHITE, undefined, 1.2);
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
  renderer.drawText("RADAR", radarX - 28, radarY - radarRadius - 20, DIM);
  drawBracketFrame(
    renderer,
    radarX - radarRadius - radarPad,
    radarY - radarRadius - radarPad - 22,
    (radarRadius + radarPad) * 2,
    radarRadius * 2 + radarPad * 2 + 22,
    12
  );

  // Right-side readout
  const rx = w - 220;
  renderer.drawRectOutline({ x: rx, y: 24, w: 196, h: 120 }, 1, WHITE);
  renderer.drawText("OUTPUT", rx + 8, 42, WHITE);
  renderer.drawLine(rx + 8, 56, rx + 188, 56, 0.8, DIM);
  renderer.drawText("VRTX", rx + 8, 74, DIM);
  renderer.drawText("--", rx + 120, 74, GREY);
  renderer.drawText("CMD", rx + 8, 92, DIM);
  renderer.drawText("--", rx + 120, 92, GREY);
  renderer.drawText("DRAW", rx + 8, 110, DIM);
  renderer.drawText("--", rx + 120, 110, GREY);
  drawBracketFrame(renderer, rx + 116, 70, 64, 48, 8);

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
  const ex = cx + Math.cos(sweep) * radius;
  const ey = cy + Math.sin(sweep) * radius;
  renderer.drawLine(cx, cy, ex, ey, 1.2, RED);
  renderer.drawLine(cx - radius, cy, cx + radius, cy, 0.8, DIM);
  renderer.drawLine(cx, cy - radius, cx, cy + radius, 0.8, DIM);
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
