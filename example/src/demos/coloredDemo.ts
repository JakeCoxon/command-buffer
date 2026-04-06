import type { Renderer } from "../../../src";
import { RendererContext } from "../../../src/renderer";

export function drawColoredDemo(ctx: RendererContext, time: number, w: number, h: number): void {
  drawHudPanel(ctx, 40, 40, 200, 120, [80 / 255, 180 / 255, 1]);
  drawHudPanel(ctx, 300, 60, 220, 120, [1, 180 / 255, 80 / 255]);
  drawHudPanel(ctx, w - 320, 40, 260, 140, [70 / 255, 220 / 255, 200 / 255]);

  drawRadar(ctx, 110, h - 120, 80, time);
  drawCrosshair(ctx, w - 180, h - 260, 26);

  const radius = 50 + Math.sin(time / 1000) * 20;
  ctx.setFillColor([1, 120 / 255, 180 / 255]);
  ctx.drawCircle(160, 260, radius);
  ctx.setFillColor([100 / 255, 220 / 255, 1]);
  ctx.drawArc(160, 260, radius + 18, 0.2, Math.PI * 1.4);
  ctx.setFillColor([1, 200 / 255, 100 / 255]);
  ctx.drawArc(160, 260, radius + 34, Math.PI * 1.2, Math.PI * 1.9);
  ctx.setFillColor([80 / 255, 140 / 255, 220 / 255]);
  ctx.drawArc(160, 260, radius + 52, 0.0, Math.PI * 0.8);

  const bracketSize = 28;
  ctx.setStrokeColor([140 / 255, 220 / 255, 1]);
  ctx.setLineWidth(3);
  ctx.drawLine(40, 40, 40 + bracketSize, 40);
  ctx.drawLine(40, 40, 40, 40 + bracketSize);
  ctx.drawLine(w - 40 - bracketSize, 40, w - 40, 40);
  ctx.drawLine(w - 40, 40, w - 40, 40 + bracketSize);
  ctx.drawLine(40, h - 40, 40 + bracketSize, h - 40);
  ctx.drawLine(40, h - 40 - bracketSize, 40, h - 40);
  ctx.drawLine(w - 40 - bracketSize, h - 40, w - 40, h - 40);
  ctx.drawLine(w - 40, h - 40 - bracketSize, w - 40, h - 40);

  ctx.setFillColor([30 / 255, 120 / 255, 180 / 255]);
  ctx.drawRect({ x: 60, y: h - 200, w: 220, h: 80 });
  ctx.setFillColor([120 / 255, 220 / 255, 1]);
  ctx.drawRect({ x: 80, y: h - 180, w: 180, h: 40 });

  ctx.setStrokeColor([120 / 255, 1, 160 / 255]);
  ctx.setLineWidth(8);
  ctx.drawLine(40, h - 60, w - 40, h - 120);
  ctx.setStrokeColor([80 / 255, 150 / 255, 200 / 255]);
  ctx.setLineWidth(2);
  ctx.drawLine(40, h - 80, w - 120, h - 160);
  ctx.setStrokeColor([90 / 255, 140 / 255, 200 / 255]);
  ctx.setLineWidth(1.5);
  ctx.drawLine(60, 220, w - 60, 220);
  ctx.setStrokeColor([50 / 255, 90 / 255, 140 / 255]);
  ctx.setLineWidth(1.0);
  ctx.drawLine(60, 240, w - 60, 240);

  for (let i = 0; i < 12; i++) {
    const x = 80 + i * 40;
    const y = 200;
    ctx.setStrokeColor([70 / 255, 130 / 255, 190 / 255]);
    ctx.setLineWidth(1.5);
    ctx.drawLine(x, y, x, y + (i % 3 === 0 ? 18 : 10));
  }

  for (let i = 0; i < 6; i++) {
    const x = w - 300 + i * 40;
    const y = h - 140;
    ctx.setFillColor([40 / 255, 90 / 255, 140 / 255]);
    ctx.drawRect({ x, y, w: 28, h: 60 });
    ctx.setFillColor([140 / 255, 230 / 255, 1]);
    ctx.drawRect({ x: x + 4, y: y + 6, w: 20, h: 10 + (i % 3) * 12 });
  }

  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 36;
    const y = h - 280;
    const barHeight = 60 + Math.sin(time / 800 + i) * 20;
    ctx.setFillColor([80 / 255, 180 / 255, 240 / 255]);
    ctx.drawRect({ x, y: y + (80 - barHeight), w: 24, h: barHeight });
  }

  for (let i = 0; i < 6; i++) {
    const startX = w * 0.35 + i * 30;
    const startY = h * 0.35;
    ctx.setStrokeColor([40 / 255, 80 / 255, 120 / 255]);
    ctx.setLineWidth(1);
    ctx.drawLine(startX, startY, startX - 60, startY + 120);
  }

  drawHudPanel(ctx, w - 360, h - 220, 300, 160, [120 / 255, 200 / 255, 1]);
  ctx.setFillColor([60 / 255, 140 / 255, 200 / 255]);
  ctx.drawRect({ x: w - 320, y: h - 190, w: 240, h: 12 });
  ctx.setFillColor([120 / 255, 220 / 255, 1]);
  ctx.drawRect({ x: w - 320, y: h - 168, w: 180, h: 8 });
  ctx.setFillColor([80 / 255, 160 / 255, 220 / 255]);
  ctx.drawRect({ x: w - 320, y: h - 148, w: 200, h: 6 });

  for (let i = 0; i < 5; i++) {
    const cx = w - 330;
    const cy = h - 190 + i * 24;
    ctx.setFillColor([60 / 255, 150 / 255, 220 / 255]);
    ctx.drawCircle(cx, cy, 6);
    ctx.setFillColor([200 / 255, 240 / 255, 1]);
    ctx.drawCircle(cx, cy, 2);
  }

  ctx.setFillColor([200 / 255, 240 / 255, 1]);
  ctx.drawText("Command Buffer Demo", 260, 50);
  ctx.drawText(`Time: ${(time / 1000).toFixed(1)}s`, 260, 80);
  ctx.drawText(`FPS: ${(1000 / (time % 1000)).toFixed(0)}`, 260, 110);
  ctx.drawText("STATUS", 152, 52);
  ctx.drawText("RADAR", 182, h - 148);
  ctx.drawText("SYSTEM", w - 418, h - 198);
}

function drawHudPanel(
  ctx: RendererContext,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number]
) {
  ctx.setFillColor([30 / 255, 60 / 255, 90 / 255]);
  ctx.drawRoundedRect({ x, y, w, h }, 12);
  ctx.setFillColor(accent);
  ctx.drawRect({ x: x + 12, y: y + 12, w: w - 24, h: 6 });
  ctx.setFillColor([80 / 255, 160 / 255, 220 / 255]);
  ctx.drawRect({ x: x + 12, y: y + 26, w: w - 60, h: 4 });
  ctx.setFillColor([50 / 255, 120 / 255, 160 / 255]);
  ctx.drawRect({ x: x + 12, y: y + h - 20, w: w - 24, h: 6 });
}

function drawRadar(ctx: RendererContext, x: number, y: number, radius: number, time: number) {
  const sweep = (time / 1200) % (Math.PI * 2);
  ctx.setFillColor([30 / 255, 120 / 255, 90 / 255]);
  ctx.drawCircle(x, y, radius);
  ctx.setFillColor([80 / 255, 220 / 255, 170 / 255]);
  ctx.drawArc(x, y, radius, sweep - 0.4, sweep + 0.4);
  ctx.setFillColor([60 / 255, 180 / 255, 140 / 255]);
  ctx.drawArc(x, y, radius * 0.7, sweep - 0.2, sweep + 0.2);
  ctx.setStrokeColor([40 / 255, 100 / 255, 80 / 255]);
  ctx.setLineWidth(1.2);
  ctx.drawLine(x - radius, y, x + radius, y);
  ctx.drawLine(x, y - radius, x, y + radius);
}

function drawCrosshair(ctx: RendererContext, x: number, y: number, size: number) {
  ctx.setFillColor([120 / 255, 200 / 255, 1]);
  ctx.drawCircle(x, y, size);
  ctx.setStrokeColor([200 / 255, 240 / 255, 1]);
  ctx.setLineWidth(2);
  ctx.drawLine(x - size - 6, y, x - size + 10, y);
  ctx.drawLine(x + size - 10, y, x + size + 6, y);
  ctx.drawLine(x, y - size - 6, x, y - size + 10);
  ctx.drawLine(x, y + size - 10, x, y + size + 6);
}
