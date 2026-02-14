export type Viewport = {
  hardwarePixels: { w: number; h: number };
  logicalPixels: { x: number; y: number; w: number; h: number };
};

export type DrawCircleCommand = {
  type: "drawCircle";
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  filled: boolean;
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawArcCommand = {
  type: "drawArc";
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  color: [number, number, number];
  filled: boolean;
  lineWidth?: number;
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawLineCommand = {
  type: "drawLine";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  color: [number, number, number];
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawRectCommand = {
  type: "drawRect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawRoundedRectCommand = {
  type: "drawRoundedRect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: [number, number, number];
  filled: boolean;
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawRenderLayerCommand = {
  type: "drawRenderLayer";
  x: number;
  y: number;
  layerKey: string;
  opacity: number;
  layerDepth: number;
  sequence: number;
  viewport: Viewport;
};

export type DrawCommand =
  | DrawCircleCommand
  | DrawArcCommand
  | DrawLineCommand
  | DrawRectCommand
  | DrawRoundedRectCommand
  | DrawRenderLayerCommand;

export type TextRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  text: string;
  size: number;
  font: string;
  lineHeight?: number;
};

export type LayerRecording = {
  key: string;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  commandIndices: number[];
  children: number[];
};

export type FrameRecording = {
  version: string;
  metadata: {
    timestamp: number;
    canvasWidth: number;
    canvasHeight: number;
    pixelRatio: number;
  };
  state: {
    clearColor: [number, number, number];
    clearAlpha: number;
    viewport: {
      hardwarePixels: { w: number; h: number };
      logicalPixels: { x: number; y: number; w: number; h: number };
    };
    projectionMatrix: string; // Base64-encoded Float32Array
    modelViewMatrix: string; // Base64-encoded Float32Array
  };
  commands: DrawCommand[];
  textRects: TextRect[];
  layers: LayerRecording[];
};

/**
 * Decode a base64-encoded Float32Array to a Float32Array
 */
export function decodeFloatArray(encoded: string): Float32Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

/**
 * Decode a base64-encoded matrix (16 floats representing a 4x4 matrix)
 */
export function decodeMatrix(encoded: string): Float32Array {
  return decodeFloatArray(encoded);
}
