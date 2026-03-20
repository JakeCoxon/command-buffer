import type { DemoDefinition } from "./types";
import { createMovingRectsDemo } from "../demos/movingRectsDemo";
import { createColoredDemoModule } from "../demos/coloredDemoModule";
import { createSciFiDemoModule } from "../demos/sciFiDemoModule";
import { createRecordingReplayDemo } from "../demos/recordingReplayDemo";
import { createTextAtlasDemo } from "../demos/textAtlasDemo";

export const demoRegistry: DemoDefinition[] = [
  {
    id: "moving-rects",
    label: "Moving Rects",
    create: createMovingRectsDemo,
  },
  {
    id: "colored",
    label: "Colored HUD",
    create: createColoredDemoModule,
  },
  {
    id: "sci-fi",
    label: "Sci-Fi Terminal",
    create: createSciFiDemoModule,
  },
  {
    id: "recording-replay",
    label: "Recording Replay",
    create: createRecordingReplayDemo,
  },
  {
    id: "text-atlas",
    label: "Text Atlas",
    create: createTextAtlasDemo,
  },
];
