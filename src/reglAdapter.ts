import { FrameCommands, Command, DrawTexturedTrianglesCommand } from "./commands";
import { Viewport } from "./types";

type ReglLike = ((config: any) => any) & {
  prop: (name: string) => any;
  clear: (options: { color: number[]; depth?: number }) => void;
  texture: (config: any) => any;
};

type ReglAdapterOptions = {
  clear?: { color: [number, number, number, number] };
};

export class ReglAdapter {
  private readonly drawShapes: any;
  private readonly drawText: any;
  private readonly textures: Map<string, any> = new Map();
  private currentViewport: Viewport | null = null;
  private surfaceSize: { w: number; h: number } | null = null;

  drawCalls: number = 0;

  constructor(private readonly regl: ReglLike, private readonly options: ReglAdapterOptions = {}) {
    this.drawShapes = this.createShapePipeline();
    this.drawText = this.createTextPipeline();
  }

  /**
   * Register a texture for use with textured rendering
   */
  registerTexture(textureId: string, canvas: HTMLCanvasElement) {
    const texture = this.regl.texture({
      data: canvas,
      mag: "linear",
      min: "linear",
      wrap: "clamp",
      flipY: true, // Enable Y-flip: Canvas 2D (top-left) → WebGL (bottom-left)
    });
    this.textures.set(textureId, texture);
  }

  /**
   * Unregister a texture
   */
  unregisterTexture(textureId: string) {
    const texture = this.textures.get(textureId);
    if (texture) {
      texture.destroy();
      this.textures.delete(textureId);
    }
  }

  /**
   * Update a texture from a canvas (useful when canvas content changes)
   */
  updateTexture(textureId: string, canvas: HTMLCanvasElement) {
    const texture = this.textures.get(textureId);
    if (texture) {
      // Regl textures can be updated by setting the data property
      texture({ data: canvas });
    } else {
      // If texture doesn't exist, register it
      this.registerTexture(textureId, canvas);
    }
  }

  render(frame: FrameCommands) {
    this.drawCalls = 0
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
        this.drawCalls++;
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
      case "drawTexturedTriangles": {
        const texturedCommand = command as DrawTexturedTrianglesCommand;
        const texture = this.textures.get(texturedCommand.textureId);
        if (!texture) {
          console.warn(`Texture not found: ${texturedCommand.textureId}`);
          return;
        }

        if (!frame.texturedVertices) {
          console.warn("No textured vertices in frame");
          return;
        }

        const stride = 32; // 8 floats per vertex
        const offsetBytes = texturedCommand.offset * stride;
        const projection = this.currentViewport ? this.orthoTopLeft(this.currentViewport) : this.identity();
        this.drawCalls++;
        this.drawText({
          vertices: frame.texturedVertices,
          offsetBytes,
          colorOffsetBytes: offsetBytes + 8,
          uvOffsetBytes: offsetBytes + 24,
          count: texturedCommand.count,
          projection,
          texture,
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
      depth: { enable: false },
      blend: {
        enable: true,
        func: { src: "src alpha", dst: "one minus src alpha" },
      },
    });
  }

  private createTextPipeline() {
    return this.regl({
      vert: `
        precision mediump float;
        attribute vec2 aPosition;
        attribute vec4 aColor;
        attribute vec2 aUv;
        varying vec4 vColor;
        varying vec2 vUv;
        uniform mat4 uProjectionMatrix;
        void main() {
          gl_Position = uProjectionMatrix * vec4(aPosition, 0.0, 1.0);
          vColor = aColor;
          vUv = aUv;
        }
      `,
      frag: `
        precision mediump float;
        varying vec4 vColor;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main() {
          vec4 texColor = texture2D(uTexture, vUv);
          // Multiply texture color by vertex color for tinting
          gl_FragColor = texColor * vColor;
        }
      `,
      attributes: {
        aPosition: {
          buffer: this.regl.prop("vertices"),
          offset: this.regl.prop("offsetBytes"),
          stride: 32,
        },
        aColor: {
          buffer: this.regl.prop("vertices"),
          offset: this.regl.prop("colorOffsetBytes"),
          stride: 32,
        },
        aUv: {
          buffer: this.regl.prop("vertices"),
          offset: this.regl.prop("uvOffsetBytes"),
          stride: 32,
        },
      },
      uniforms: {
        uProjectionMatrix: this.regl.prop("projection"),
        uTexture: this.regl.prop("texture"),
      },
      count: this.regl.prop("count"),
      primitive: "triangles",
      viewport: this.regl.prop("viewport"),
      depth: { enable: false },
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
