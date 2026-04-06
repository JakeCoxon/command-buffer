import type { Renderer } from "../../../src";
import { RendererContext } from "../../../src/renderer";

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
  ctx: RendererContext,
  time: number,
  w: number,
  h: number,
  stats: SciFiDemoStats
): void {
  // Title
  ctx.setFillColor(WHITE);
  ctx.drawText("COMMAND BUFFER", 24, 28);
  ctx.setStrokeColor(GREY);
  ctx.setLineWidth(1);
  ctx.drawLine(24, 50, 220, 50);

  // Data readouts with brackets
  const timeStr = (time / 1000).toFixed(2);
  const fps = (1000 / 16).toFixed(0);
  ctx.setFillColor(DIM);
  ctx.drawText("TIME", 24, 68);
  ctx.setFillColor(WHITE);
  ctx.drawText(timeStr, 24, 86);
  drawBracketFrame(ctx, 20, 64, 88, 32);
  ctx.setFillColor(DIM);
  ctx.drawText("FPS", 124, 68);
  ctx.setFillColor(WHITE);
  ctx.drawText(fps, 124, 86);
  drawBracketFrame(ctx, 120, 64, 56, 32);
  ctx.setFillColor(DIM);
  ctx.drawText("STATUS", 24, 118);
  ctx.setFillColor(WHITE);
  ctx.drawText("ONLINE", 24, 136);
  drawBracketFrame(ctx, 20, 114, 72, 32);
  ctx.setFillColor(RED);
  ctx.drawRect({ x: 98, y: 128, w: 6, h: 6 });

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
      drawSystemPanel(ctx, px, py, panelW, panelH, time, opts);
    }
  }

  // Radar
  const gridEndX = gridStartX + cols * (panelW + gap);
  const radarX = gridEndX + 90;
  const radarY = h - 140;
  const radarRadius = 70;
  const radarPad = 16;
  drawRadarSweep(ctx, radarX, radarY, radarRadius, time);
  drawAcquisitionBracket(ctx, radarX, radarY, time);
  ctx.setFillColor(DIM);
  ctx.drawText("RADAR", radarX - 28, radarY - radarRadius - 20);
  drawBracketFrame(
    ctx,
    radarX - radarRadius - radarPad,
    radarY - radarRadius - radarPad - 22,
    (radarRadius + radarPad) * 2,
    radarRadius * 2 + radarPad * 2 + 22,
    12
  );

  // Right-side readout + primitive showcase (rounded shapes, arcs, polygons)
  const rx = w - 220;
  const outH = 248;
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(1);
  ctx.drawRectOutline({ x: rx, y: 24, w: 196, h: outH });
  ctx.setFillColor(WHITE);
  ctx.drawText("OUTPUT", rx + 8, 42);
  ctx.setStrokeColor(DIM);
  ctx.setLineWidth(0.8);
  ctx.drawLine(rx + 8, 56, rx + 188, 56);
  ctx.setFillColor(DIM);
  ctx.drawText("VRTX", rx + 8, 74);
  ctx.setFillColor(GREY);
  ctx.drawText("--", rx + 120, 74);
  ctx.setFillColor(DIM);
  ctx.drawText("CMD", rx + 8, 92);
  ctx.setFillColor(GREY);
  ctx.drawText("--", rx + 120, 92);
  ctx.drawText("DRAW", rx + 8, 110, DIM);
  ctx.setFillColor(GREY);
  ctx.drawText("--", rx + 120, 110);
  drawBracketFrame(ctx, rx + 116, 70, 64, 48, 8);

  ctx.setFillColor(DIM);
  ctx.drawText("BUS", rx + 8, 128);
  ctx.drawRoundedRect({ x: rx + 8, y: 138, w: 180, h: 22 }, 6);
  ctx.setFillColor(CYAN);
  ctx.setLineWidth(1);
  ctx.drawRoundedRectOutline({ x: rx + 8, y: 138, w: 180, h: 22 }, 6);
  const syncPhase = (time / 2600) % 1;
  const gx = rx + 98;
  const gy = 198;
  ctx.setFillColor(DIM);
  ctx.drawText("SYNC", rx + 8, 172);
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(1.1);
  ctx.drawArcOutline(gx, gy, 28, -Math.PI * 0.82, Math.PI * 0.82);
  ctx.setFillColor(AMBER);
  ctx.setLineWidth(28);
  ctx.drawArc(gx, gy, 23, -Math.PI * 0.82, -Math.PI * 0.82 + Math.PI * 1.64 * syncPhase);
  ctx.setStrokeColor(RED);
  ctx.setLineWidth(1);
  ctx.drawTriangleOutline(gx, gy - 38, gx - 8, gy - 52, gx + 8, gy - 52);
  ctx.setFillColor([0.25, 0.28, 0.32, 1]);
  ctx.drawTriangle(gx - 14, gy + 44, gx + 14, gy + 44, gx, gy + 58);
  ctx.setFillColor([0.12, 0.35, 0.38, 0.85]);
  ctx.drawQuad(
    rx + 138,
    218,
    rx + 184,
    226,
    rx + 174,
    252,
    rx + 122,
    244,
  );
  ctx.setStrokeColor(GREY);
  ctx.setLineWidth(1);
  ctx.drawQuadOutline(rx + 138, 218, rx + 184, 226, rx + 174, 252, rx + 122, 244);

  // Grid lines
  for (let i = 1; i <= 4; i++) {
    const gx = w * 0.25 * i;
    ctx.setStrokeColor(DIM);
    ctx.setLineWidth(0.5);
    ctx.drawLine(gx, 0, gx, h);
  }
  for (let i = 1; i <= 4; i++) {
    const gy = h * 0.25 * i;
    ctx.setStrokeColor(DIM);
    ctx.setLineWidth(0.5);
    ctx.drawLine(0, gy, w, gy);
  }

  // Bottom stats
  const statY = h - 44;
  const statBoxH = 20;
  const statBoxY = statY - 15;
  ctx.setFillColor(DIM);
  ctx.drawText("VRTX", 24, statY);
  ctx.setFillColor(WHITE);
  ctx.drawText(String(stats.lastVertexCount), 64, statY);
  drawBracketFrame(ctx, 60, statBoxY, 56, statBoxH, 6);
  ctx.setFillColor(DIM);
  ctx.drawText("CMD", 128, statY);
  ctx.setFillColor(WHITE);
  ctx.drawText(`${stats.lastCmdBefore}→${stats.lastCmdAfter}`, 164, statY);
  drawBracketFrame(ctx, 160, statBoxY, 52, statBoxH, 6);
  ctx.setFillColor(DIM);
  ctx.drawText("MS", 220, statY);
  ctx.setFillColor(WHITE);
  ctx.drawText(stats.lastRenderMs.toFixed(2), 248, statY);
  drawBracketFrame(ctx, 244, statBoxY, 48, statBoxH, 6);

  ctx.resetTransform();
}

function drawBracket(
  ctx: RendererContext,
  cx: number,
  cy: number,
  size: number,
  thickness: number,
  corner: "tl" | "tr" | "bl" | "br"
) {
  const t = thickness;
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(t);
  if (corner === "tl") {
    ctx.drawLine(cx, cy, cx + size, cy);
    ctx.drawLine(cx, cy, cx, cy + size);
  } else if (corner === "tr") {
    ctx.drawLine(cx - size, cy, cx, cy);
    ctx.drawLine(cx, cy, cx, cy + size);
  } else if (corner === "bl") {
    ctx.drawLine(cx, cy - size, cx, cy);
    ctx.drawLine(cx, cy, cx + size, cy);
  } else {
    ctx.drawLine(cx, cy - size, cx, cy);
    ctx.drawLine(cx - size, cy, cx, cy);
  }
}

function drawBracketFrame(
  ctx: RendererContext,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number = 12
) {
  drawBracket(ctx, x, y, size, 1.5, "tl");
  drawBracket(ctx, x + w, y, size, 1.5, "tr");
  drawBracket(ctx, x, y + h, size, 1.5, "bl");
  drawBracket(ctx, x + w, y + h, size, 1.5, "br");
}

function drawRadarSweep(
  ctx: RendererContext,
  cx: number,
  cy: number,
  radius: number,
  time: number
) {
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(1.2);
  ctx.drawCircleOutline(cx, cy, radius);
  ctx.setStrokeColor(DIM);
  ctx.setLineWidth(0.8);
  ctx.drawCircleOutline(cx, cy, radius * 0.5);
  ctx.setFillColor(WEDGE_FILL);
  ctx.setLineWidth(28);
  const sweep = (time / 2000) % (Math.PI * 2);
  const wedge = 0.42;
  const ex = cx + Math.cos(sweep) * radius;
  const ey = cy + Math.sin(sweep) * radius;
  ctx.drawArc(cx, cy, radius * 0.92, sweep - wedge, sweep + wedge * 0.15);
  ctx.setStrokeColor(RED);
  ctx.setLineWidth(1);
  ctx.drawLine(cx, cy, ex, ey);
  ctx.setFillColor(CYAN);
  ctx.setLineWidth(16);
  ctx.drawCircle(ex, ey, 5);
  ctx.setFillColor(AMBER);
  ctx.setLineWidth(12);
  ctx.setStrokeColor(RED);
  ctx.setLineWidth(1.2);
  ctx.drawLine(cx, cy, ex, ey);
  ctx.setFillColor(CYAN);
  ctx.setLineWidth(16);
  ctx.drawCircle(ex, ey, 5);
  ctx.setFillColor(AMBER);
  ctx.setLineWidth(12);
  ctx.drawCircle(cx - radius * 0.35, cy + radius * 0.22, 3);
  ctx.setStrokeColor(GREY);
  ctx.setLineWidth(0.9);
  ctx.drawArcOutline(cx, cy, radius * 0.72, sweep + 0.9, sweep + 2.1);
  ctx.setStrokeColor(DIM);
  ctx.setLineWidth(0.8);
  ctx.drawLine(cx - radius, cy, cx + radius, cy);
  ctx.drawLine(cx, cy - radius, cx, cy + radius);
}

/** Rotating lock geometry: translate → rotate → scale, then save/restore nesting. */
function drawAcquisitionBracket(
  ctx: RendererContext,
  cx: number,
  cy: number,
  time: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((time / 2400) * (Math.PI * 2));
  ctx.scale(1.12, 1.12);
  ctx.save();
  ctx.rotate(Math.PI / 4);
  const s = 22;
  ctx.setFillColor([0.2, 0.85, 0.95, 0.12]);
  ctx.drawRoundedRect({ x: -s, y: -s, w: s * 2, h: s * 2 }, 4);
  ctx.setStrokeColor(CYAN);
  ctx.setLineWidth(1);
  ctx.drawRoundedRectOutline({ x: -s, y: -s, w: s * 2, h: s * 2 }, 4);
  ctx.restore();
  const d = 36;
  ctx.setFillColor(CYAN);
  ctx.drawTriangle(-d, 0, -d - 12, -8, -d - 12, 8);
  ctx.drawTriangle(d, 0, d + 12, -8, d + 12, 8);
  ctx.drawTriangle(0, -d, -8, -d - 12, 8, -d - 12);
  ctx.drawTriangle(0, d, -8, d + 12, 8, d + 12);
  ctx.setFillColor([0.95, 0.55, 0.15, 0.35]);
  ctx.drawQuad(-10, -10, 12, -7, 9, 11, -14, 8);
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(0.9);
  ctx.drawQuadOutline(-10, -10, 12, -7, 9, 11, -14, 8);
  ctx.restore();
}

function drawSystemPanel(
  ctx: RendererContext,
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
  ctx.setStrokeColor(WHITE);
  ctx.setLineWidth(1);
  ctx.drawRectOutline({ x, y, w, h });
  ctx.setFillColor(WHITE);
  ctx.drawText(title, x + 8, y + 20);
  ctx.setStrokeColor(DIM);
  ctx.setLineWidth(0.8);
  ctx.drawLine(x + 8, y + 34, x + w - 8, y + 34);
  ctx.setFillColor(DIM);
  ctx.drawText("RANK", x + 8, y + 50);
  ctx.setFillColor(WHITE);
  ctx.drawText(rank, x + 70, y + 50);
  ctx.setFillColor(DIM);
  ctx.drawText("BUFFER", x + 8, y + 72);
  ctx.setFillColor(WHITE);
  ctx.drawText(status, x + 70, y + 72);
  drawBracketFrame(ctx, x + 66, y + 36, 40, 20, 6);
  if (indicator) {
    ctx.setFillColor(RED);
    ctx.drawRect({ x: x + w - 22, y: y + 64, w: 6, h: 6 });
  }
  const barY = y + 100;
  const barStep = (w - 24) / barCount;
  for (let i = 0; i < barCount; i++) {
    const bx = x + 8 + i * barStep;
    const bw = Math.max(8, barStep - 4);
    const bh = 20 + Math.sin(time / 400 + barPhase + i * 0.8) * 12;
    ctx.setFillColor(i % 3 === 0 ? WHITE : GREY);
    ctx.drawRect({ x: bx, y: barY + (24 - bh), w: bw, h: bh });
  }
  ctx.setFillColor(DIM);
  ctx.drawText("OUT", x + 8, barY + 30);
}
