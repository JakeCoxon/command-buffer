import { FrameCommands, Command } from "./commands";
import { Viewport } from "./types";

type ReglLike = ((config: any) => any) & {
  prop: (name: string) => any;
  clear: (options: { color: number[]; depth?: number }) => void;
};

type ReglAdapterOptions = {
  clear?: { color: [number, number, number, number] };
};

export class ReglAdapter {
  private readonly drawShapes: any;
  private currentViewport: Viewport | null = null;
  private surfaceSize: { w: number; h: number } | null = null;

  constructor(private readonly regl: ReglLike, private readonly options: ReglAdapterOptions = {}) {
    this.drawShapes = this.createShapePipeline();
  }

  render(frame: FrameCommands) {
    for (const command of frame.commands) {
      this.executeCommand(command, frame);
    }
  }

  private executeCommand(command: Command, frame: FrameCommands) {
    switch (command.type) {
      case "clear":
        this.regl.clear({
          color: this.toClearColor(command.color, command.alpha),
          depth: 1,
        });
        return;
      case "setViewport": {
        this.currentViewport = command.viewport;
        const rect = command.viewport.rect;
        if (rect.x === 0 && rect.y === 0) {
          this.surfaceSize = { w: rect.w, h: rect.h };
        }
        return;
      }
      case "pushLayer":
        // TODO: allocate/bind FBO and set viewport to layer rect.
        return;
      case "popLayer":
        // TODO: restore FBO and viewport.
        return;
      case "drawTriangles": {
        const stride = 24;
        const offsetBytes = command.offset * stride;
        const projection = this.currentViewport ? this.orthoTopLeft(this.currentViewport) : this.identity();
        this.drawShapes({
          vertices: frame.vertices,
          offsetBytes,
          colorOffsetBytes: offsetBytes + 8,
          count: command.count,
          projection,
          viewport: this.currentViewport ? this.toViewport(this.currentViewport) : undefined,
        });
        return;
      }
    }
  }

  private createShapePipeline() {
    return this.regl({
      vert: `
        precision mediump float;
        attribute vec2 aPosition;
        attribute vec4 aColor;
        varying vec4 vColor;
        uniform mat4 uProjectionMatrix;
        void main() {
          gl_Position = uProjectionMatrix * vec4(aPosition, 0.0, 1.0);
          vColor = aColor;
        }
      `,
      frag: `
        precision mediump float;
        varying vec4 vColor;
        void main() {
          gl_FragColor = vColor;
        }
      `,
      attributes: {
        aPosition: {
          buffer: this.regl.prop("vertices"),
          offset: this.regl.prop("offsetBytes"),
          stride: 24,
        },
        aColor: {
          buffer: this.regl.prop("vertices"),
          offset: this.regl.prop("colorOffsetBytes"),
          stride: 24,
        },
      },
      uniforms: {
        uProjectionMatrix: this.regl.prop("projection"),
      },
      count: this.regl.prop("count"),
      primitive: "triangles",
      viewport: this.regl.prop("viewport"),
      blend: {
        enable: true,
        func: { src: "src alpha", dst: "one minus src alpha" },
      },
    });
  }

  private toClearColor(color: [number, number, number, number?], alpha: number) {
    const [r, g, b, a = 255] = color;
    return [r / 255, g / 255, b / 255, (a / 255) * alpha];
  }

  private identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  private orthoTopLeft(viewport: Viewport) {
    const { x, y, w, h } = viewport.rect;
    const left = x;
    const right = x + w;
    const top = y;
    const bottom = y + h;
    const near = -1;
    const far = 1;

    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Float32Array([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
  }

  private toViewport(viewport: Viewport) {
    const { x, y, w, h } = viewport.rect;
    const pixelRatio = viewport.pixelRatio || 1;
    const surfaceHeight = this.surfaceSize?.h ?? h;
    const flippedY = surfaceHeight - (y + h);

    return {
      x: Math.floor(x * pixelRatio),
      y: Math.floor(flippedY * pixelRatio),
      width: Math.floor(w * pixelRatio),
      height: Math.floor(h * pixelRatio),
    };
  }
}
