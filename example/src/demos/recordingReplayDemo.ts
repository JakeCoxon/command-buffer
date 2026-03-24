import createREGL from "regl";
import { CommandBuffer } from "../../../src/commandBuffer";
import { ReglAdapter } from "../../../src/adapters/reglAdapter";
import { RecordingPlayer } from "./recordingReplay/recordingPlayer";
import { loadFrameRecordingFromFile } from "./recordingReplay/recordingLoader";
import type { FrameRecording } from "./recordingReplay/frameRecording";
import type { DemoCreateContext, DemoInstance, DemoSize } from "../app/types";

export function createRecordingReplayDemo(context: DemoCreateContext): DemoInstance {
  const regl = createREGL({ canvas: context.canvas }) as any;
  const adapter = new ReglAdapter(regl as any);

  const defaultViewport = {
    rect: { x: 0, y: 0, w: context.initialSize.width, h: context.initialSize.height },
    pixelRatio: context.initialSize.pixelRatio,
  };

  let commandBuffer: CommandBuffer | null = new CommandBuffer(defaultViewport);
  let recordingPlayer: RecordingPlayer | null = null;
  let recording: FrameRecording | null = null;
  let dirty = true;
  let size = context.initialSize;

  const statsLines: string[] = ["Load a frame recording JSON to replay a capture."];

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.className = "demo-hidden-file-input";

  const loadButton = document.createElement("button");
  loadButton.type = "button";
  loadButton.className = "demo-control-btn";
  loadButton.textContent = "Load Recording JSON";
  loadButton.addEventListener("click", () => fileInput.click());

  context.controlsRoot.appendChild(loadButton);
  context.controlsRoot.appendChild(fileInput);

  async function ensureFontReady(): Promise<void> {
    if (!document.fonts) return;
    await document.fonts.ready;
  }

  function setStatusLines(lines: string[]): void {
    statsLines.length = 0;
    statsLines.push(...lines);
  }

  function createViewportFromRecording(source: FrameRecording) {
    const logical = source.state.viewport.logicalPixels;
    return {
      rect: {
        x: logical.x,
        y: logical.y,
        w: logical.w,
        h: logical.h,
      },
      pixelRatio: source.metadata.pixelRatio,
    };
  }

  function renderLoadedRecording(): void {
    if (!commandBuffer || !recordingPlayer || !recording) return;

    const start = performance.now();
    const viewport = createViewportFromRecording(recording);

    commandBuffer.reset(viewport);
    recordingPlayer.play(commandBuffer);
    const frame = commandBuffer.flush();
    adapter.render(frame);

    const end = performance.now();
    const vertexCount = frame.vertices.length / 6;

    setStatusLines([
      `version: ${recording.version}`,
      `commands: ${recording.commands.length}`,
      `text rects: ${recording.textRects.length}`,
      `vertices: ${vertexCount}`,
      `draw calls: ${adapter.getDrawCalls()}`,
      `render: ${(end - start).toFixed(2)} ms`,
    ]);
  }

  async function loadRecording(file: File): Promise<void> {
    try {
      setStatusLines(["Loading recording..."]);
      const loaded = await loadFrameRecordingFromFile(file);
      recording = loaded;

      await ensureFontReady();

      recordingPlayer = new RecordingPlayer();
      recordingPlayer.loadRecording(loaded);
      commandBuffer = new CommandBuffer(createViewportFromRecording(loaded));

      dirty = true;
      setStatusLines([
        `loaded: ${file.name}`,
        `version: ${loaded.version}`,
        `commands: ${loaded.commands.length}`,
        `text rects: ${loaded.textRects.length}`,
      ]);
    } catch (error) {
      setStatusLines([
        `load failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }

  const onFileChange = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    void loadRecording(file);
  };

  fileInput.addEventListener("change", onFileChange);

  function onResize(nextSize: DemoSize): void {
    size = nextSize;
    if (!recording && commandBuffer) {
      commandBuffer.reset({
        rect: { x: 0, y: 0, w: size.width, h: size.height },
        pixelRatio: size.pixelRatio,
      });
      dirty = true;
    }
  }

  function render(): void {
    if (!dirty) return;
    dirty = false;

    if (!recording || !recordingPlayer || !commandBuffer) {
      regl.clear({ color: [0.09, 0.09, 0.11, 1], depth: 1 });
      setStatusLines([
        "Load a frame recording JSON to replay a capture.",
        `canvas: ${size.width}x${size.height} @${size.pixelRatio.toFixed(2)}x`,
      ]);
      return;
    }

    renderLoadedRecording();
  }

  return {
    render,
    onResize,
    getStatsLines: () => statsLines,
    destroy: () => {
      fileInput.removeEventListener("change", onFileChange);
      if (typeof regl.destroy === "function") {
        regl.destroy();
      }
    },
  };
}
