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
const debugPanel = document.getElementById("debugPanel") as HTMLDivElement;
const debugToggle = document.getElementById("debugToggle") as HTMLButtonElement;
const debugClose = document.getElementById("debugClose") as HTMLButtonElement;
const debugCanvas = document.getElementById("debugCanvas") as HTMLCanvasElement;
const debugAtlasInfo = document.getElementById("debugAtlasInfo") as HTMLDivElement;
const debugGlyphInfo = document.getElementById("debugGlyphInfo") as HTMLDivElement;
const debugPositionInfo = document.getElementById("debugPositionInfo") as HTMLDivElement;
const debugUVInfo = document.getElementById("debugUVInfo") as HTMLDivElement;
const debugMetricsInfo = document.getElementById("debugMetricsInfo") as HTMLDivElement;
const debugShowGrid = document.getElementById("debugShowGrid") as HTMLInputElement;
const debugShowBoxes = document.getElementById("debugShowBoxes") as HTMLInputElement;
const debugShowCoords = document.getElementById("debugShowCoords") as HTMLInputElement;
const debugLogAll = document.getElementById("debugLogAll") as HTMLButtonElement;
const debugExport = document.getElementById("debugExport") as HTMLButtonElement;

let debugView: DebugView | null = null;
let debugVisible = false;
let selectedGlyph: string | null = null;

if (debugCanvas) {
  debugCanvas.width = 560;
  debugCanvas.height = 400;
  debugView = new DebugView(debugCanvas);
}

// Toggle debug panel
if (debugToggle) {
  debugToggle.addEventListener("click", () => {
    debugVisible = !debugVisible;
    if (debugPanel) {
      debugPanel.style.display = debugVisible ? "flex" : "none";
    }
  });
}

if (debugClose) {
  debugClose.addEventListener("click", () => {
    debugVisible = false;
    if (debugPanel) {
      debugPanel.style.display = "none";
    }
  });
}

// Debug controls
if (debugShowGrid) {
  debugShowGrid.addEventListener("change", (e) => {
    if (debugView) {
      debugView.setShowGrid((e.target as HTMLInputElement).checked);
    }
  });
}

if (debugShowBoxes) {
  debugShowBoxes.addEventListener("change", (e) => {
    if (debugView) {
      debugView.setShowBoundingBoxes((e.target as HTMLInputElement).checked);
    }
  });
}

if (debugShowCoords) {
  debugShowCoords.addEventListener("change", (e) => {
    if (debugView) {
      debugView.setShowCoordinates((e.target as HTMLInputElement).checked);
    }
  });
}

if (debugLogAll) {
  debugLogAll.addEventListener("click", () => {
    const debugInfo = fontAtlas.getDebugInfo();
    console.log("[Atlas] All glyphs:", debugInfo);
    for (const glyph of debugInfo.glyphs) {
      console.log(
        `  '${glyph.char}': logical(${glyph.logical.x}, ${glyph.logical.y}, ${glyph.logical.width}, ${glyph.logical.height}) ` +
        `pixel(${glyph.pixel.x}, ${glyph.pixel.y}, ${glyph.pixel.width}, ${glyph.pixel.height}) ` +
        `UV(${glyph.uv.u1.toFixed(4)}, ${glyph.uv.v1.toFixed(4)}, ${glyph.uv.u2.toFixed(4)}, ${glyph.uv.v2.toFixed(4)})`
      );
    }
  });
}

if (debugExport) {
  debugExport.addEventListener("click", () => {
    const atlasCanvas = fontAtlas.getCanvas();
    const link = document.createElement("a");
    link.download = "font-atlas.png";
    link.href = atlasCanvas.toDataURL();
    link.click();
  });
}

// Handle glyph selection
if (debugCanvas && debugView) {
  debugCanvas.addEventListener("debugGlyphClick", ((e: CustomEvent) => {
    const glyph = debugView!.findGlyphAt(fontAtlas, e.detail.x, e.detail.y);
    selectedGlyph = glyph;
    if (debugView) {
      debugView.setSelectedGlyph(glyph);
    }
    updateDebugInfo();
  }) as EventListener);
}

function updateDebugInfo() {
  if (!debugVisible) return;

  const debugInfo = fontAtlas.getDebugInfo();
  
  if (debugAtlasInfo) {
    debugAtlasInfo.textContent = 
      `Atlas: ${debugInfo.dimensions.logical.width}x${debugInfo.dimensions.logical.height} ` +
      `(${debugInfo.dimensions.pixel.width}x${debugInfo.dimensions.pixel.height} @ ${debugInfo.pixelRatio}x)`;
  }

  if (selectedGlyph) {
    const glyph = debugInfo.glyphs.find((g) => g.char === selectedGlyph);
    if (glyph) {
      if (debugGlyphInfo) {
        debugGlyphInfo.textContent = `Selected: '${glyph.char}' (${glyph.char.charCodeAt(0)})`;
      }
      if (debugPositionInfo) {
        debugPositionInfo.textContent = 
          `Position (logical): (${glyph.logical.x}, ${glyph.logical.y}, ${glyph.logical.width}, ${glyph.logical.height})\n` +
          `Position (pixel): (${glyph.pixel.x}, ${glyph.pixel.y}, ${glyph.pixel.width}, ${glyph.pixel.height})`;
      }
      if (debugUVInfo) {
        debugUVInfo.textContent = 
          `UV: (${glyph.uv.u1.toFixed(4)}, ${glyph.uv.v1.toFixed(4)}) → (${glyph.uv.u2.toFixed(4)}, ${glyph.uv.v2.toFixed(4)})`;
      }
      if (debugMetricsInfo) {
        debugMetricsInfo.textContent = 
          `Metrics: ${glyph.metrics.width}x${glyph.metrics.ascend + glyph.metrics.descend} ` +
          `(ascend: ${glyph.metrics.ascend}, descend: ${glyph.metrics.descend})`;
      }
    }
  } else {
    if (debugGlyphInfo) debugGlyphInfo.textContent = "Selected: -";
    if (debugPositionInfo) debugPositionInfo.textContent = "Position: -";
    if (debugUVInfo) debugUVInfo.textContent = "UV: -";
    if (debugMetricsInfo) debugMetricsInfo.textContent = "Metrics: -";
  }
}

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
  if (debugVisible && debugView) {
    debugView.render(fontAtlas);
    updateDebugInfo();
  }

  requestAnimationFrame(drawFrame);
}

// Initialize
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
