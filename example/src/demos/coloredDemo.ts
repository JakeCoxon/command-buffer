import type { Renderer } from "../../../src";

export function drawColoredDemo(renderer: Renderer, time: number, w: number, h: number): void {
  drawHudPanel(renderer, 40, 40, 200, 120, [80 / 255, 180 / 255, 1]);
  drawHudPanel(renderer, 300, 60, 220, 120, [1, 180 / 255, 80 / 255]);
  drawHudPanel(renderer, w - 320, 40, 260, 140, [70 / 255, 220 / 255, 200 / 255]);

  drawRadar(renderer, 110, h - 120, 80, time);
  drawCrosshair(renderer, w - 180, h - 260, 26);

  const radius = 50 + Math.sin(time / 1000) * 20;
  renderer.drawCircle(160, 260, radius, [1, 120 / 255, 180 / 255]);
  renderer.drawArc(160, 260, radius + 18, 0.2, Math.PI * 1.4, [100 / 255, 220 / 255, 1], 40);
  renderer.drawArc(160, 260, radius + 34, Math.PI * 1.2, Math.PI * 1.9, [1, 200 / 255, 100 / 255], 30);
  renderer.drawArc(160, 260, radius + 52, 0.0, Math.PI * 0.8, [80 / 255, 140 / 255, 220 / 255], 20);

  const bracketSize = 28;
  renderer.drawLine(40, 40, 40 + bracketSize, 40, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(40, 40, 40, 40 + bracketSize, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(w - 40 - bracketSize, 40, w - 40, 40, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(w - 40, 40, w - 40, 40 + bracketSize, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(40, h - 40, 40 + bracketSize, h - 40, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(40, h - 40 - bracketSize, 40, h - 40, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(w - 40 - bracketSize, h - 40, w - 40, h - 40, 3, [140 / 255, 220 / 255, 1]);
  renderer.drawLine(w - 40, h - 40 - bracketSize, w - 40, h - 40, 3, [140 / 255, 220 / 255, 1]);

  renderer.drawRect({ x: 60, y: h - 200, w: 220, h: 80 }, [30 / 255, 120 / 255, 180 / 255]);
  renderer.drawRect({ x: 80, y: h - 180, w: 180, h: 40 }, [120 / 255, 220 / 255, 1]);

  renderer.drawLine(40, h - 60, w - 40, h - 120, 8, [120 / 255, 1, 160 / 255]);
  renderer.drawLine(40, h - 80, w - 120, h - 160, 2, [80 / 255, 150 / 255, 200 / 255]);
  renderer.drawLine(60, 220, w - 60, 220, 1.5, [90 / 255, 140 / 255, 200 / 255]);
  renderer.drawLine(60, 240, w - 60, 240, 1.0, [50 / 255, 90 / 255, 140 / 255]);

  for (let i = 0; i < 12; i++) {
    const x = 80 + i * 40;
    const y = 200;
    renderer.drawLine(x, y, x, y + (i % 3 === 0 ? 18 : 10), 1.5, [70 / 255, 130 / 255, 190 / 255]);
  }

  for (let i = 0; i < 6; i++) {
    const x = w - 300 + i * 40;
    const y = h - 140;
    renderer.drawRect({ x, y, w: 28, h: 60 }, [40 / 255, 90 / 255, 140 / 255]);
    renderer.drawRect({ x: x + 4, y: y + 6, w: 20, h: 10 + (i % 3) * 12 }, [140 / 255, 230 / 255, 1]);
  }

  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 36;
    const y = h - 280;
    const barHeight = 60 + Math.sin(time / 800 + i) * 20;
    renderer.drawRect({ x, y: y + (80 - barHeight), w: 24, h: barHeight }, [80 / 255, 180 / 255, 240 / 255]);
  }

  for (let i = 0; i < 6; i++) {
    const startX = w * 0.35 + i * 30;
    const startY = h * 0.35;
    renderer.drawLine(startX, startY, startX - 60, startY + 120, 1, [40 / 255, 80 / 255, 120 / 255]);
  }

  drawHudPanel(renderer, w - 360, h - 220, 300, 160, [120 / 255, 200 / 255, 1]);
  renderer.drawRect({ x: w - 320, y: h - 190, w: 240, h: 12 }, [60 / 255, 140 / 255, 200 / 255]);
  renderer.drawRect({ x: w - 320, y: h - 168, w: 180, h: 8 }, [120 / 255, 220 / 255, 1]);
  renderer.drawRect({ x: w - 320, y: h - 148, w: 200, h: 6 }, [80 / 255, 160 / 255, 220 / 255]);

  for (let i = 0; i < 5; i++) {
    const cx = w - 330;
    const cy = h - 190 + i * 24;
    renderer.drawCircle(cx, cy, 6, [60 / 255, 150 / 255, 220 / 255], 24);
    renderer.drawCircle(cx, cy, 2, [200 / 255, 240 / 255, 1], 12);
  }

  renderer.drawText("Command Buffer Demo", 260, 50, [200 / 255, 240 / 255, 1]);
  renderer.drawText(`Time: ${(time / 1000).toFixed(1)}s`, 260, 80, [150 / 255, 200 / 255, 1]);
  renderer.drawText(`FPS: ${(1000 / (time % 1000)).toFixed(0)}`, 260, 110, [120 / 255, 180 / 255, 240 / 255]);
  renderer.drawText("STATUS", 152, 52, [80 / 255, 180 / 255, 1]);
  renderer.drawText("RADAR", 182, h - 148, [30 / 255, 120 / 255, 90 / 255]);
  renderer.drawText("SYSTEM", w - 418, h - 198, [120 / 255, 200 / 255, 1]);
}

function drawHudPanel(
  renderer: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number]
) {
  renderer.drawRoundedRect({ x, y, w, h }, 12, [30 / 255, 60 / 255, 90 / 255]);
  renderer.drawRect({ x: x + 12, y: y + 12, w: w - 24, h: 6 }, accent);
  renderer.drawRect({ x: x + 12, y: y + 26, w: w - 60, h: 4 }, [80 / 255, 160 / 255, 220 / 255]);
  renderer.drawRect({ x: x + 12, y: y + h - 20, w: w - 24, h: 6 }, [50 / 255, 120 / 255, 160 / 255]);
}

function drawRadar(renderer: Renderer, x: number, y: number, radius: number, time: number) {
  const sweep = (time / 1200) % (Math.PI * 2);
  renderer.drawCircle(x, y, radius, [30 / 255, 120 / 255, 90 / 255]);
  renderer.drawArc(x, y, radius, sweep - 0.4, sweep + 0.4, [80 / 255, 220 / 255, 170 / 255], 24);
  renderer.drawArc(x, y, radius * 0.7, sweep - 0.2, sweep + 0.2, [60 / 255, 180 / 255, 140 / 255], 16);
  renderer.drawLine(x - radius, y, x + radius, y, 1.2, [40 / 255, 100 / 255, 80 / 255]);
  renderer.drawLine(x, y - radius, x, y + radius, 1.2, [40 / 255, 100 / 255, 80 / 255]);
}

function drawCrosshair(renderer: Renderer, x: number, y: number, size: number) {
  renderer.drawCircle(x, y, size, [120 / 255, 200 / 255, 1], 30);
  renderer.drawLine(x - size - 6, y, x - size + 10, y, 2, [200 / 255, 240 / 255, 1]);
  renderer.drawLine(x + size - 10, y, x + size + 6, y, 2, [200 / 255, 240 / 255, 1]);
  renderer.drawLine(x, y - size - 6, x, y - size + 10, 2, [200 / 255, 240 / 255, 1]);
  renderer.drawLine(x, y + size - 10, x, y + size + 6, 2, [200 / 255, 240 / 255, 1]);
}
