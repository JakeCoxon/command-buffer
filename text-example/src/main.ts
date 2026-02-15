import createREGL from "regl";
import { Renderer, ReglAdapter } from "../../src";
import { DebugView } from "./debugView";

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
  fontFamily: "sans-serif",
  fontSize: 24,
  fontAtlasSize: { width: 256, height: 256 },
  fontAtlasPadding: 1
});

// Debug view setup
const debugView = new DebugView(renderer.getFontAtlas());

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
  const glyphCount = renderer.getFontAtlas().getGlyphCount();
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
  if (debugView) {
    debugView.update(renderer.getFontAtlas());
  }

  requestAnimationFrame(drawFrame);
}

// Initialize
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
