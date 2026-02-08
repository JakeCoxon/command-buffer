import { Rect, Color, Viewport } from "./types";

export type DrawTrianglesCommand = {
  type: "drawTriangles";
  offset: number; // vertex offset
  count: number; // vertex count
};

export type ClearCommand = {
  type: "clear";
  color: Color;
  alpha: number;
};

export type SetViewportCommand = {
  type: "setViewport";
  viewport: Viewport;
};

export type PushLayerCommand = {
  type: "pushLayer";
  key: string;
  rect: Rect;
};

export type PopLayerCommand = {
  type: "popLayer";
};

export type Command =
  | DrawTrianglesCommand
  | ClearCommand
  | SetViewportCommand
  | PushLayerCommand
  | PopLayerCommand;

export type FrameCommands = {
  vertices: Float32Array;
  commands: Command[];
};
