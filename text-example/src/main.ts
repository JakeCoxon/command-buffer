import createREGL from "regl";
import { Renderer, ReglAdapter, CanvasFontAtlas, FontkitFontAtlas, PrebuiltFontAtlas } from "../../src";
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

// Create and set font atlas
// const fontAtlas = new CanvasFontAtlas(
//   "sans-serif",
//   24,
//   "font-atlas",
//   256,
//   256,
//   pixelRatio,
//   1
// );

// const fontKitAtlas = new FontkitFontAtlas(
//   Lora,
//   24,
//   "font-atlas",
//   256,
//   256,
//   pixelRatio,
//   1,
//   2 // 4x supersampling for better antialiasing
// );

// await fontKitAtlas.load();
// console.log("fontKitAtlas loaded", fontKitAtlas.getDebugInfo());

// Load prebuilt font atlas (atlas.json + atlas.png in public/ from pnpm run build-font-atlas -- --out text-example/public)
const fontAtlas = await PrebuiltFontAtlas.load(atlasJsonUrl, atlasPngUrl);
console.log("PrebuiltFontAtlas loaded", fontAtlas.getDebugInfo());

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

const gradientTexture = createOpacityGradientTexture();
adapter.registerTexture("opacity-gradient", gradientTexture);

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
    { u1: 0, v1: 0, u2: 1, v2: 1 }, // Full texture UVs
    [255, 255, 255, 255], // White color (opacity comes from texture)
    "opacity-gradient"
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
  renderer.drawText("Numbers: 0123456789", 50, 250, textColor);
  renderer.drawText("Symbols: !@#$%^&*()", 50, 290, textColor);
  renderer.drawText("Mixed: Hello, World! 42", 50, 330, textColor);

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
