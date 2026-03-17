import createREGL from "regl";
import { createBagl } from "bagl-js";
import { Renderer, BaglAdapter, CanvasFontAtlas, FrameCommands, ReglAdapter } from "../../src";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const statsDiv = document.getElementById("stats") as HTMLDivElement;
const pixelRatio = window.devicePixelRatio || 1;

const createAdapter = () => {
  if (true) {
    const bagl = createBagl({ canvas });
    return new BaglAdapter(bagl as any);
  } else {
    const regl = createREGL({ canvas });
    return new ReglAdapter(regl as any);
  }
}
const adapter = createAdapter();
const renderer = new Renderer(adapter, {
  viewport: { rect: { x: 0, y: 0, w: 0, h: 0 }, pixelRatio },
});

const fontAtlasColored = new CanvasFontAtlas(
  "system-ui",
  16,
  "example-font-colored",
  256,
  256,
  pixelRatio,
  1
);
const fontAtlasSciFi = new CanvasFontAtlas(
  "ui-monospace, monospace",
  14,
  "example-font-scifi",
  256,
  256,
  pixelRatio,
  1
);

const RENDER_TIME_WINDOW = 60; // ~1 sec at 60fps
const renderTimeSamples: number[] = [];

let paused = false;
const stats = {
  lastVertexCount: 0,
  lastCmdBefore: 0,
  lastCmdAfter: 0,
  lastRenderMs: 0,
};

type MovingRect = { x: number; y: number; w: number; h: number; color: [number, number, number, number]; vx: number; vy: number };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomColor(): [number, number, number, number] {
  return [rand(0, 256) | 0, rand(0, 256) | 0, rand(0, 256) | 0, 255];
}

const NUM_RECTS = 500;
const rects: MovingRect[] = [];

function initRects() {
  rects.length = 0;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < NUM_RECTS; i++) {
    rects.push({
      x: rand(0, Math.max(0, w - 40)),
      y: rand(0, Math.max(0, h - 40)),
      w: rand(20, 60),
      h: rand(20, 60),
      color: randomColor(),
      vx: rand(-2, 2),
      vy: rand(-2, 2),
    });
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  renderer.setViewport({
    rect: { x: 0, y: 0, w: width, h: height },
    pixelRatio,
  });
  initRects();
}

function drawFrame(time: number) {

  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setFontAtlas(fontAtlasSciFi);
  renderer.beginFrame([24, 24, 28, 255]);

  if (rects.length === 0) initRects();

  const boundsW = w;
  const boundsH = h;
  for (const r of rects) {
    if (!paused) {
      r.x += r.vx;
      r.y += r.vy;
      if (r.x <= 0 || r.x + r.w >= boundsW) r.vx *= -1;
      if (r.y <= 0 || r.y + r.h >= boundsH) r.vy *= -1;
      r.x = Math.max(0, Math.min(boundsW - r.w, r.x));
      r.y = Math.max(0, Math.min(boundsH - r.h, r.y));
    }
    renderer.drawRect({ x: r.x, y: r.y, w: r.w, h: r.h }, r.color);
    const str = `${Math.round(r.x)},${Math.round(r.y)}`;
    renderer.drawText(str, r.x, r.y, [255, 255, 255, 255]);
  }


  const start = performance.now();
  const frame = renderer.endFrame();
  const end = performance.now();

  stats.lastVertexCount = frame.vertices.length / 6;
  stats.lastCmdBefore = frame.rawCommandCount ?? frame.commands.length;
  stats.lastCmdAfter = adapter.getDrawCalls();
  const frameMs = end - start;
  renderTimeSamples.push(frameMs);
  if (renderTimeSamples.length > RENDER_TIME_WINDOW) renderTimeSamples.shift();
  stats.lastRenderMs =
    renderTimeSamples.reduce((a, b) => a + b, 0) / renderTimeSamples.length;
  const renderMsMax =
    renderTimeSamples.length > 0 ? Math.max(...renderTimeSamples) : 0;

  statsDiv.textContent = [
    `vertices: ${stats.lastVertexCount}`,
    `commands: ${stats.lastCmdBefore} → ${stats.lastCmdAfter}`,
    `draw calls: ${adapter.getDrawCalls()}`,
    `render: ${stats.lastRenderMs.toFixed(2)} ms (avg)`,
    `max: ${renderMsMax.toFixed(2)} ms`,
  ].join("\n");

  requestAnimationFrame(drawFrame);
}

canvas.addEventListener("click", () => {
  paused = !paused;
});

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);