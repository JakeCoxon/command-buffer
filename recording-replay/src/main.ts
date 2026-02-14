import createREGL from "regl";
import { CommandBuffer } from "../../src/commandBuffer";
import { ReglAdapter } from "../../src/reglAdapter";
import { loadFrameRecordingFromFile } from "./recordingLoader";
import { RecordingPlayer } from "./recordingPlayer";

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

// Initial render (empty canvas)
renderFrame();
