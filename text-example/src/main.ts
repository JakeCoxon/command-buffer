import createREGL from "regl";
import { Renderer, ReglAdapter, CanvasFontAtlas, FontkitFontAtlas, PrebuiltFontAtlas, type Texture } from "../../src";
import type { FontAtlas } from "../../src/fontAtlas";
import { DebugView } from "./debugView";

import Lora from "./Lora-Medium.ttf?url";
import atlasJsonUrl from "./atlas.json?url";
import atlasPngUrl from "./atlas.png?url";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const stats = document.getElementById("stats") as HTMLDivElement;

if (!canvas) {
  throw new Error("Canvas element not found");
}

const regl = createREGL({ canvas });
const pixelRatio = window.devicePixelRatio || 1;

// Initialize adapter and renderer
const adapter = new ReglAdapter(regl as any);
const renderer = new Renderer(adapter, {
  viewport: { rect: { x: 0, y: 0, w: 0, h: 0 }, pixelRatio },
});

// Load all three font atlas types
const canvasFontAtlas = new CanvasFontAtlas(
  "Lora",
  24,
  "font-atlas-canvas",
  256,
  256,
  pixelRatio,
  1
);

const fontKitAtlas = new FontkitFontAtlas(
  Lora,
  24,
  "font-atlas-fontkit",
  256,
  256,
  pixelRatio,
  1,
  2
);
await fontKitAtlas.load();

const prebuiltFontAtlas = await PrebuiltFontAtlas.load(atlasJsonUrl, atlasPngUrl);

// Default atlas for title/paragraph (prebuilt)
const fontAtlas = prebuiltFontAtlas;

// Create opacity gradient texture for transparency testing
function createOpacityGradientTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error("Failed to get 2D context for gradient texture");
  }
  
  // Create a gradient from fully opaque (left) to fully transparent (right)
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");   // Fully opaque white
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)"); // 50% opacity
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");    // Fully transparent
  
  // Fill with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  return canvas;
}

const gradientCanvas = createOpacityGradientTexture();
const gradientTexture: Texture = {
  id: "opacity-gradient",
  getSource: () => gradientCanvas,
  needsUpdate: () => false,
};

// Debug view setup
const debugView = new DebugView(renderer);

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
}

function drawFrame(time: number) {
  const start = performance.now();

  // Begin frame
  renderer.beginFrame([24, 24, 28, 255]);

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Draw some sample text
  const textColor: [number, number, number, number] = [200, 220, 255, 255];
  const accentColor: [number, number, number, number] = [100, 200, 255, 255];

  renderer.setFontAtlas(fontAtlas);

  // Draw opacity gradient texture to test transparency
  const gradientRect = {
    x: w - 300,
    y: 50,
    w: 250,
    h: 100,
  };
  renderer.drawTexturedRect(
    gradientRect,
    { u1: 0, v1: 0, u2: 1, v2: 1 },
    [255, 255, 255, 255],
    gradientTexture
  );

  // Title
  renderer.drawText("Font Atlas Text Rendering", 50, 50, accentColor);

  // Sample paragraph
  const sampleText =
    "This is a demonstration of text rendering using a font atlas. " +
    "Each glyph is rendered once to a canvas texture and cached for reuse. " +
    "The atlas uses binary tree space partitioning to efficiently pack glyphs.";

  renderer.drawTextWrapped(sampleText, 50, 100, w - 100, textColor);

  // Show some different text
  // renderer.drawText("Numbers: 0123456789", 50, 250, textColor);
  // renderer.drawText("Symbols: !@#$%^&*()", 50, 290, textColor);
  // renderer.drawText("Mixed: Hello, World! 42", 50, 330, textColor);

  // Scaled text with metric lines and per-glyph bounds, repeated for each atlas type
  const metricsSampleString = "Hg";
  const metricsScale = 10;
  const metricsX = 50;
  const labelColor: [number, number, number, number] = [180, 180, 200, 255];
  const glyphBoundsColor: [number, number, number, number] = [220, 180, 220, 255];
  const lineThickness = 1.5;
  const verticalGap = 280;

  function drawMetricsDemoForAtlas(atlas: FontAtlas, startY: number, title: string) {
    renderer.setFontAtlas(atlas);
    renderer.drawText(title, metricsX, startY - 18, labelColor);
    const metricsY = startY;

    renderer.drawText(metricsSampleString, metricsX, metricsY, textColor, undefined, metricsScale);

    const runWidth = renderer.measureText(metricsSampleString) * metricsScale;
    const lineMetrics = renderer.getLineMetrics(metricsSampleString);
    const ascend = lineMetrics.ascend * metricsScale;
    const descend = lineMetrics.descend * metricsScale;
    const x2 = metricsX + runWidth;

    let gx = metricsX;
    for (const char of metricsSampleString) {
      if (char.charCodeAt(0) === 10 || char.charCodeAt(0) === 13) continue;
      atlas.addGlyph(char);
      const gd = atlas.getGlyphData(char);
      if (gd) {
        const m = gd.metrics;
        const gw = m.width * metricsScale;
        const gh = (m.ascend + m.descend) * metricsScale;
        const gy = metricsY - m.ascend * metricsScale;
        renderer.drawRectOutline({ x: gx, y: gy, w: gw, h: gh }, 1, glyphBoundsColor);
        gx += m.width * metricsScale;
      }
    }

    renderer.drawLine(metricsX, metricsY, x2, metricsY, lineThickness, [255, 180, 80, 255]);
    renderer.drawLine(metricsX, metricsY - ascend, x2, metricsY - ascend, lineThickness, [80, 220, 120, 255]);
    renderer.drawLine(metricsX, metricsY + descend, x2, metricsY + descend, lineThickness, [80, 140, 255, 255]);
    renderer.drawRectOutline(
      { x: metricsX, y: metricsY - ascend, w: runWidth, h: ascend + descend },
      1.5,
      [200, 200, 220, 255]
    );

    const labelOffset = runWidth + 10;
    renderer.drawText("baseline", metricsX + labelOffset, metricsY, labelColor);
    renderer.drawText("ascender", metricsX + labelOffset, metricsY - ascend, labelColor);
    renderer.drawText("descender", metricsX + labelOffset, metricsY + descend, labelColor);
    renderer.drawText("bounds", metricsX + labelOffset, metricsY - ascend + 10, labelColor);
  }

  let metricsY = 400;
  drawMetricsDemoForAtlas(prebuiltFontAtlas, metricsY, "PrebuiltFontAtlas");
  metricsY += verticalGap;
  drawMetricsDemoForAtlas(canvasFontAtlas, metricsY, "CanvasFontAtlas");
  metricsY += verticalGap;
  drawMetricsDemoForAtlas(fontKitAtlas, metricsY, "FontkitFontAtlas");

  // Restore atlas for stats / debug view
  renderer.setFontAtlas(fontAtlas);

  // Performance stats
  const glyphCount = renderer.fontAtlas?.getGlyphCount() || 0;
  renderer.drawText(
    `Cached Glyphs: ${glyphCount}`,
    50,
    h - 100,
    [150, 200, 150, 255]
  );

  // End frame (handles texture updates and rendering)
  const frame = renderer.endFrame();

  const end = performance.now();
  const renderMs = end - start;
  const vertexCount = frame.vertices.length / 6;
  const texturedVertexCount = frame.texturedVertices
    ? frame.texturedVertices.length / 8
    : 0;

  // Update stats
  stats.textContent = [
    `vertices: ${vertexCount}`,
    `textured: ${texturedVertexCount}`,
    `commands: ${frame.commands.length}`,
    `draw calls: ${adapter.getDrawCalls()}`,
    `textures: ${adapter.getTextureCount()}`,
    `render: ${renderMs.toFixed(2)} ms`,
    `glyphs: ${glyphCount}`,
  ].join("\n");

  // Update debug view
  if (debugView && renderer.fontAtlas) {
    debugView.update(renderer.fontAtlas);
  }

  requestAnimationFrame(drawFrame);
}

// Initialize
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
