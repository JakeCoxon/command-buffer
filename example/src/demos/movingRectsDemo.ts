import { createBagl } from "bagl-js";
import { Renderer, BaglAdapter, CanvasFontAtlas } from "../../../src";
import type { DemoCreateContext, DemoInstance, DemoSize } from "../app/types";

type MovingRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number, number];
  vx: number;
  vy: number;
};

const NUM_RECTS = 2000;
const INTERACTION_RADIUS = 140;
const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
const INTERACTION_STRENGTH = 0.12;
const INTERACTION_REPEL = 0.15;
const VELOCITY_DAMPING = 0.995;
const MAX_SPEED = 10;
const RENDER_TIME_WINDOW = 60;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomColor(): [number, number, number, number] {
  return [rand(0, 1), rand(0, 1), rand(0, 1), 1];
}

export function createMovingRectsDemo(context: DemoCreateContext): DemoInstance {
  const bagl = createBagl({ canvas: context.canvas });
  const adapter = new BaglAdapter(bagl as any);
  const renderer = new Renderer(adapter);

  const fontAtlas = new CanvasFontAtlas(
    "ui-monospace, monospace",
    8,
    "example-font-moving-rects",
    256,
    256,
    context.initialSize.pixelRatio,
    1
  );

  let size = context.initialSize;
  let paused = false;
  let lastFrameTime = 0;
  const rects: MovingRect[] = [];
  const renderTimeSamples: number[] = [];

  const mouse = {
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    active: false,
    lastMoveTime: 0,
  };

  const stats = {
    lastVertexCount: 0,
    lastCmdBefore: 0,
    lastCmdAfter: 0,
    lastRenderMs: 0,
    lastRenderMaxMs: 0,
  };

  const statsLines: string[] = [];

  function initRects(): void {
    rects.length = 0;
    for (let i = 0; i < NUM_RECTS; i++) {
      rects.push({
        x: rand(0, Math.max(0, size.width - 40)),
        y: rand(0, Math.max(0, size.height - 40)),
        w: rand(20, 60),
        h: rand(20, 60),
        color: randomColor(),
        vx: rand(-2, 2),
        vy: rand(-2, 2),
      });
    }
  }

  function updateStatsLines(): void {
    statsLines.length = 0;
    statsLines.push(`vertices: ${stats.lastVertexCount}`);
    statsLines.push(`commands: ${stats.lastCmdBefore} -> ${stats.lastCmdAfter}`);
    statsLines.push(`draw calls: ${adapter.getDrawCalls()}`);
    statsLines.push(`render: ${stats.lastRenderMs.toFixed(2)} ms (avg)`);
    statsLines.push(`max: ${stats.lastRenderMaxMs.toFixed(2)} ms`);
    statsLines.push(`click canvas: ${paused ? "resume" : "pause"}`);
  }

  function resize(nextSize: DemoSize): void {
    size = nextSize;
    renderer.setViewport({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });
    initRects();
  }

  function onPointerMove(event: PointerEvent): void {
    const rect = context.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!mouse.active) {
      mouse.prevX = x;
      mouse.prevY = y;
    }
    mouse.x = x;
    mouse.y = y;
    mouse.vx = x - mouse.prevX;
    mouse.vy = y - mouse.prevY;
    mouse.prevX = x;
    mouse.prevY = y;
    mouse.active = true;
    mouse.lastMoveTime = performance.now();
  }

  function render(time: number): void {
    if (lastFrameTime === 0) lastFrameTime = time;
    const dt = Math.max(0.5, Math.min(2.0, (time - lastFrameTime) / (1000 / 60)));
    lastFrameTime = time;
    const mouseRecentlyMoved = mouse.active && time - mouse.lastMoveTime < 150;

    renderer.setFontAtlas(fontAtlas);
    renderer.beginFrame({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });

    if (rects.length === 0) {
      initRects();
    }

    for (const r of rects) {
      if (!paused) {
        if (mouseRecentlyMoved) {
          const cx = r.x + r.w * 0.5;
          const cy = r.y + r.h * 0.5;
          const dx = cx - mouse.x;
          const dy = cy - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < INTERACTION_RADIUS_SQ) {
            const dist = Math.sqrt(distSq) || 1;
            const falloff = 1 - dist / INTERACTION_RADIUS;
            const repelX = (dx / dist) * falloff * INTERACTION_REPEL;
            const repelY = (dy / dist) * falloff * INTERACTION_REPEL;
            r.vx += (mouse.vx * INTERACTION_STRENGTH + repelX) * dt;
            r.vy += (mouse.vy * INTERACTION_STRENGTH + repelY) * dt;
          }
        }

        r.vx *= VELOCITY_DAMPING;
        r.vy *= VELOCITY_DAMPING;
        const speedSq = r.vx * r.vx + r.vy * r.vy;
        if (speedSq > MAX_SPEED * MAX_SPEED) {
          const inv = MAX_SPEED / Math.sqrt(speedSq);
          r.vx *= inv;
          r.vy *= inv;
        }

        r.x += r.vx * dt;
        r.y += r.vy * dt;
        if (r.x <= 0 || r.x + r.w >= size.width) r.vx *= -1;
        if (r.y <= 0 || r.y + r.h >= size.height) r.vy *= -1;
        r.x = Math.max(0, Math.min(size.width - r.w, r.x));
        r.y = Math.max(0, Math.min(size.height - r.h, r.y));
      }
      renderer.drawRect({ x: r.x, y: r.y, w: r.w, h: r.h }, r.color);
      renderer.drawText(`${Math.round(r.x)},${Math.round(r.y)}`, r.x, r.y, [1, 1, 1, 1]);
    }

    const start = performance.now();
    const frame = renderer.endFrame();
    const end = performance.now();

    stats.lastVertexCount = frame.vertices.length / 6;
    stats.lastCmdBefore = frame.rawCommandCount ?? frame.commands.length;
    stats.lastCmdAfter = adapter.getDrawCalls();

    const frameMs = end - start;
    renderTimeSamples.push(frameMs);
    if (renderTimeSamples.length > RENDER_TIME_WINDOW) {
      renderTimeSamples.shift();
    }
    stats.lastRenderMs =
      renderTimeSamples.reduce((sum, sample) => sum + sample, 0) / renderTimeSamples.length;
    stats.lastRenderMaxMs = renderTimeSamples.length ? Math.max(...renderTimeSamples) : 0;

    updateStatsLines();
  }

  resize(context.initialSize);
  updateStatsLines();

  return {
    render,
    onResize: resize,
    onPointerMove,
    onPointerEnter: onPointerMove,
    onPointerLeave: () => {
      mouse.active = false;
      mouse.vx = 0;
      mouse.vy = 0;
    },
    onClick: () => {
      paused = !paused;
      updateStatsLines();
    },
    getStatsLines: () => statsLines,
  };
}
