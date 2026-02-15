import createREGL from "regl";
import { CommandBuffer } from "../../src/commandBuffer";
import { ReglAdapter } from "../../src/reglAdapter";
import { FontAtlas } from "./fontAtlas";
import { TextRenderer } from "./textRenderer";
import { DebugView } from "./debugView";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const stats = document.getElementById("stats") as HTMLDivElement;

if (!canvas) {
  throw new Error("Canvas element not found");
}

const regl = createREGL({ canvas });
const pixelRatio = window.devicePixelRatio || 1;

// Initialize CommandBuffer
const commandBuffer = new CommandBuffer({
  rect: { x: 0, y: 0, w: 0, h: 0 },
  pixelRatio,
});

// Initialize ReglAdapter
const adapter = new ReglAdapter(regl as any);

// Create font atlas
const fontAtlas = new FontAtlas(
  "sans-serif",
  24,
  "font-atlas",
  256,
  256,
  pixelRatio
);

// Debug logging disabled by default (enable with fontAtlas.setDebug(true) if needed)

// Register texture with ReglAdapter
adapter.registerTexture(fontAtlas.getTextureId(), fontAtlas.getCanvas());

// Handle atlas expansion - re-register texture when canvas resizes
fontAtlas.onExpansion(() => {
  adapter.unregisterTexture(fontAtlas.getTextureId());
  adapter.registerTexture(fontAtlas.getTextureId(), fontAtlas.getCanvas());
});

// Handle texture updates when glyphs are added
fontAtlas.onUpdate(() => {
  adapter.updateTexture(fontAtlas.getTextureId(), fontAtlas.getCanvas());
});

// Create text renderer
const textRenderer = new TextRenderer(commandBuffer, fontAtlas);

// Debug view setup
const debugView = new DebugView(fontAtlas);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  commandBuffer.setViewport({
    rect: { x: 0, y: 0, w: width, h: height },
    pixelRatio,
  });
}

function drawFrame(time: number) {
  // Clear the buffer
  commandBuffer.clear([24, 24, 28, 255], 1);

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Draw some sample text
  const textColor: [number, number, number, number] = [200, 220, 255, 255];
  const accentColor: [number, number, number, number] = [100, 200, 255, 255];

  // Title
  textRenderer.drawText("Font Atlas Text Rendering", 50, 50, accentColor);

  // Sample paragraph
  const sampleText =
    "This is a demonstration of text rendering using a font atlas. " +
    "Each glyph is rendered once to a canvas texture and cached for reuse. " +
    "The atlas uses binary tree space partitioning to efficiently pack glyphs.";

  textRenderer.drawTextWrapped(sampleText, 50, 100, w - 100, textColor);

  // Show some different text
  textRenderer.drawText("Numbers: 0123456789", 50, 250, textColor);
  textRenderer.drawText("Symbols: !@#$%^&*()", 50, 290, textColor);
  textRenderer.drawText("Mixed: Hello, World! 42", 50, 330, textColor);

  // Performance stats
  const glyphCount = fontAtlas.getGlyphCount();
  textRenderer.drawText(
    `Cached Glyphs: ${glyphCount}`,
    50,
    h - 100,
    [150, 200, 150, 255]
  );

  // Flush and render
  const frame = commandBuffer.flush();
  const start = performance.now();

  adapter.render(frame);

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
  if (debugView) {
    debugView.update(fontAtlas);
  }

  requestAnimationFrame(drawFrame);
}

// Initialize
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
