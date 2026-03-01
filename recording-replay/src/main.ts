import "@fontsource/roboto";
import createREGL from "regl";
import { CommandBuffer } from "../../src/commandBuffer";
import { ReglAdapter } from "../../src/reglAdapter";
import { loadFrameRecordingFromFile } from "./recordingLoader";
import { RecordingPlayer } from "./recordingPlayer";
import { FrameRecording } from "./frameRecording";

/**
 * Explicitly load a font by creating a FontFace and adding it to document.fonts
 */
async function loadFont(fontFamily: string, fontSource?: string): Promise<void> {
  if (!document.fonts) {
    console.warn("Font Loading API not available");
    // Fallback: create a hidden element with the font to trigger loading
    const testElement = document.createElement("div");
    testElement.style.fontFamily = fontFamily;
    testElement.style.position = "absolute";
    testElement.style.visibility = "hidden";
    testElement.style.fontSize = "1px";
    testElement.textContent = "test";
    document.body.appendChild(testElement);
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(testElement);
    return;
  }

  // Check if font is already loaded
  if (document.fonts.check(`1em "${fontFamily}"`) || 
      document.fonts.check(`400 1em "${fontFamily}"`) ||
      document.fonts.check(`normal 1em "${fontFamily}"`)) {
    return;
  }

  // If fontSource is provided, load it explicitly
  if (fontSource) {
    try {
      const fontFace = new FontFace(fontFamily, fontSource);
      await fontFace.load();
      // Add font to document.fonts (TypeScript may not have the correct type)
      (document.fonts as any).add(fontFace);
    } catch (error) {
      console.warn(`Failed to load font ${fontFamily}:`, error);
    }
  }

  // Trigger font loading by creating a test element
  const testElement = document.createElement("div");
  testElement.style.fontFamily = fontFamily;
  testElement.style.position = "absolute";
  testElement.style.visibility = "hidden";
  testElement.style.fontSize = "1px";
  testElement.textContent = "test";
  document.body.appendChild(testElement);
  
  // Force a reflow to trigger font loading
  testElement.offsetHeight;
  
  // Wait for fonts to be ready
  await document.fonts.ready;

  // Verify font is loaded with retries
  let retries = 10;
  while (retries > 0) {
    if (document.fonts.check(`1em "${fontFamily}"`) || 
        document.fonts.check(`400 1em "${fontFamily}"`) ||
        document.fonts.check(`normal 1em "${fontFamily}"`)) {
      document.body.removeChild(testElement);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    retries--;
  }

  document.body.removeChild(testElement);
  console.warn(`Font "${fontFamily}" may not be fully loaded`);
}

/**
 * Preload common fonts (like Roboto) at startup
 */
async function preloadFonts(): Promise<void> {
  // Load Roboto font explicitly
  await loadFont("Roboto");
  
  // Wait for all fonts to be ready
  if (document.fonts) {
    await document.fonts.ready;
  }
}

/**
 * Ensure fonts are loaded before building atlas
 */
async function ensureFontsLoaded(fonts: Set<string>): Promise<void> {
  if (fonts.size === 0) return;

  // First, ensure Roboto is loaded if it's in the set
  if (fonts.has("Roboto")) {
    await loadFont("Roboto");
  }

  // Check if document.fonts API is available
  if (document.fonts && document.fonts.check) {
    // Wait for fonts to be ready
    await document.fonts.ready;
    
    // Verify all fonts are loaded
    const missingFonts: string[] = [];
    for (const font of fonts) {
      // Try different font weight/size combinations to check if font is available
      const fontLoaded = 
        document.fonts.check(`1em "${font}"`) ||
        document.fonts.check(`400 1em "${font}"`) ||
        document.fonts.check(`normal 1em "${font}"`);
      
      if (!fontLoaded) {
        missingFonts.push(font);
        // Try to load it explicitly
        await loadFont(font);
      }
    }
    
    if (missingFonts.length > 0) {
      console.warn(`Some fonts may not be loaded: ${missingFonts.join(", ")}`);
      // Wait a bit more for fonts that might still be loading
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  } else {
    // Fallback: wait a bit for fonts to load if document.fonts is not available
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Extract unique fonts from a frame recording
 */
function extractFontsFromRecording(recording: FrameRecording): Set<string> {
  const fonts = new Set<string>();
  for (const textRect of recording.textRects) {
    fonts.add(textRect.font);
  }
  return fonts;
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const stats = document.getElementById("stats") as HTMLDivElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;

if (!canvas || !stats || !fileInput) {
  throw new Error("Required DOM elements not found");
}

const regl = createREGL({ canvas });
const adapter = new ReglAdapter(regl as any);

let commandBuffer: CommandBuffer | null = null;
let recordingPlayer: RecordingPlayer | null = null;
let currentRecording: any = null;

// Initialize with default viewport
const defaultViewport = {
  rect: { x: 0, y: 0, w: 800, h: 600 },
  pixelRatio: window.devicePixelRatio || 1,
};

commandBuffer = new CommandBuffer(defaultViewport);

function resizeCanvas(width: number, height: number, pixelRatio: number) {
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

async function loadRecording(file: File) {
  try {
    stats.textContent = "Loading recording...";
    
    const recording = await loadFrameRecordingFromFile(file);
    currentRecording = recording;

    // Ensure fonts are loaded before building texture atlas
    const fontsToLoad = extractFontsFromRecording(recording);
    await ensureFontsLoaded(fontsToLoad);

    // Initialize canvas size from recording metadata
    const { canvasWidth, canvasHeight, pixelRatio } = recording.metadata;
    resizeCanvas(canvasWidth, canvasHeight, pixelRatio);

    // Create new command buffer with recording viewport
    const logicalPixels = recording.state.viewport.logicalPixels;
    const viewport = {
      rect: {
        x: logicalPixels.x,
        y: logicalPixels.y,
        w: logicalPixels.w,
        h: logicalPixels.h,
      },
      pixelRatio,
    };
    commandBuffer = new CommandBuffer(viewport);

    // Create recording player and load recording
    recordingPlayer = new RecordingPlayer();
    recordingPlayer.loadRecording(recording);

    stats.textContent = `Loaded recording\nVersion: ${recording.version}\nCommands: ${recording.commands.length}\nText rects: ${recording.textRects.length}`;

    // Render the frame
    renderFrame();
  } catch (error) {
    stats.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("Failed to load recording:", error);
  }
}

function renderFrame() {
  if (!commandBuffer || !recordingPlayer || !currentRecording) {
    return;
  }

  const start = performance.now();

  // Reset command buffer
  const logicalPixels = currentRecording.state.viewport.logicalPixels;
  const pixelRatio = currentRecording.metadata.pixelRatio;
  commandBuffer.reset({
    rect: {
      x: logicalPixels.x,
      y: logicalPixels.y,
      w: logicalPixels.w,
      h: logicalPixels.h,
    },
    pixelRatio,
  });

  // Play recording into command buffer
  recordingPlayer.play(commandBuffer);

  // Flush and render
  const frame = commandBuffer.flush();
  adapter.render(frame);

  const end = performance.now();
  const renderMs = end - start;
  const vertexCount = frame.vertices.length / 6;

  if (currentRecording) {
    stats.textContent = [
      `Version: ${currentRecording.version}`,
      `Commands: ${currentRecording.commands.length}`,
      `Text rects: ${currentRecording.textRects.length}`,
      `Vertices: ${vertexCount}`,
      `Render: ${renderMs.toFixed(2)} ms`,
      `Draw calls: ${adapter.drawCalls}`,
    ].join("\n");
  }
}

// Handle file input
fileInput.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    loadRecording(file);
  }
});

// Preload fonts at startup
preloadFonts().catch(err => {
  console.warn("Failed to preload fonts:", err);
});

// Initial render (empty canvas)
renderFrame();

// Mouse control timeline
// document.addEventListener("mousemove", (e) => {
//   if (recordingPlayer) {
//     recordingPlayer.maxCommands = Math.floor(e.clientX / canvas.width * currentRecording.commands.length);
//     renderFrame();
//   }
// });