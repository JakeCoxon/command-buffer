import { FrameCommands, DrawTexturedTrianglesCommand } from "../commands";
import { batchCommands } from "../batchCommands";
import type { DrawPacket, PackedKey } from "../drawPacket";
import { Viewport, type Texture } from "../types";
import { type RenderAdapter } from "../adapter";
import { BufferHandle, Texture2DHandle, type Bagl } from "bagl-js";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function viewportToKey(viewport: Viewport | null): string {
  if (viewport === null) return "__null";
  const { rect, pixelRatio } = viewport;
  return `${rect.x},${rect.y},${rect.w},${rect.h},${pixelRatio ?? 1}`;
}

// TODO: Export type from bagl-js
type BaglAttributeDescriptor = {
  buffer: BufferHandle;
  size?: number;
  stride?: number;
  offset?: number;
};

type BaglAdapterOptions = {
  clear?: { color: [number, number, number, number] };
};

const BATCH_BUFFER_INITIAL_FLOATS = 65536 * 8;
const SHAPES_FLOATS_PER_VERTEX = 6;
const TEXTURED_FLOATS_PER_VERTEX = 8;

export class BaglAdapter implements RenderAdapter {
  private readonly drawShapes: (props: {
    vertices: BufferHandle;
    count: number;
    projection: Float32Array;
    viewport?: { x: number; y: number; width: number; height: number };
  }) => void;
  private readonly drawText: (props: {
    vertices: BufferHandle;
    count: number;
    projection: Float32Array;
    texture: Texture2DHandle;
    viewport?: { x: number; y: number; width: number; height: number };
  }) => void;
  private readonly textures: Map<string, Texture2DHandle> = new Map();
  private surfaceSize: { w: number; h: number } | null = null;

  private batchVertexBuffer: BufferHandle | null = null;
  private batchVertexData: Float32Array | null = null;
  private batchVertexBufferCapacity = 0;

  private projectionCache = new Map<string, Float32Array>();

  drawCalls: number = 0;

  constructor(
    private readonly bagl: Bagl,
    private readonly options: BaglAdapterOptions = {},
  ) {
    this.drawShapes = this.createShapePipeline();
    this.drawText = this.createTextPipeline();
  }

  getDrawCalls(): number {
    return this.drawCalls;
  }

  getTextureCount(): number {
    return this.textures.size;
  }

  uploadTexture(texture: Texture) {
    const source = texture.source;
    const flipY = texture.flipY !== false;
    const existing = this.textures.get(texture.id);
    const needsUpload = texture.version !== texture.lastUploadedVersion;
    if (!existing) {
      const baglTex = this.bagl.texture({
        data: source,
        mag: "linear",
        min: "linear",
        wrapS: "clamp",
        wrapT: "clamp",
        flipY,
        format: "rgba",
        // Keep atlas uploads in straight-alpha form to match vertex colors and
        // src-alpha blending (same behavior as ReglAdapter).
        premultiplyAlpha: false,
      });
      this.textures.set(texture.id, baglTex);
      texture.lastUploadedVersion = texture.version;
    } else if (needsUpload) {
      existing({
        data: source,
        format: "rgba",
        premultiplyAlpha: false,
        flipY,
        mag: "linear",
        min: "linear",
        wrapS: "clamp",
        wrapT: "clamp",
      });
      texture.lastUploadedVersion = texture.version;
    }
  }

  unregisterTexture(textureId: string) {
    const texture = this.textures.get(textureId);
    if (texture) {
      texture.destroy();
      this.textures.delete(textureId);
    }
  }

  render(frame: FrameCommands) {
    if (frame.usedTextures) {
      for (const texture of frame.usedTextures.values()) {
        this.uploadTexture(texture);
      }
    }
    this.drawCalls = 0;
    if (
      this.options.clear &&
      !frame.commands.some((command) => command.type === "clear")
    ) {
      this.bagl.clear({
        color: this.toClearColor(this.options.clear.color, 1),
        depth: 1,
      });
    }

    const { packets, keys } = this.commandsToDrawPackets(frame);
    if (packets.length === 0) return;

    const groups = batchCommands(packets, keys);
    for (const group of groups) {
      this.renderGroup(group, frame);
    }
  }

  private commandsToDrawPackets(frame: FrameCommands): {
    packets: DrawPacket[];
    keys: PackedKey[];
  } {
    const packets: DrawPacket[] = [];
    const keys: PackedKey[] = [];
    let currentViewport: Viewport | null = null;
    let currentProjection = this.getProjection(currentViewport);
    let currentPass = 0;
    let currentSortLayer = 0;
    const sortLayerStack: number[] = [];
    const viewportIdCache = new Map<string, number>();
    let nextViewportId = 0;

    const getViewportId = (viewport: Viewport | null): number => {
      const key = viewportToKey(viewport);
      let id = viewportIdCache.get(key);
      if (id === undefined) {
        id = nextViewportId++;
        viewportIdCache.set(key, id);
      }
      return id;
    };

    for (const command of frame.commands) {
      switch (command.type) {
        case "clear":
          this.bagl.clear({
            color: this.toClearColor(command.color, command.alpha),
            depth: 1,
          });
          currentPass++;
          currentProjection = this.getProjection(currentViewport);
          break;
        case "setViewport":
          currentViewport = command.viewport;
          currentProjection = this.getProjection(currentViewport);
          const rect = command.viewport.rect;
          if (rect.x === 0 && rect.y === 0) {
            this.surfaceSize = { w: rect.w, h: rect.h };
          }
          break;
        case "pushLayer":
          sortLayerStack.push(currentSortLayer);
          currentSortLayer = 0;
          currentPass++;
          currentProjection = this.getProjection(currentViewport);
          break;
        case "popLayer":
          currentSortLayer = sortLayerStack.pop() ?? 0;
          break;
        case "drawTriangles": {
          const packet: DrawPacket = {
            pass: currentPass,
            pipeline: 0,
            bindings: {},
            geometry: {
              buffer: "vertices",
              offset: command.offset,
              count: command.count,
            },
            sortLayer: currentSortLayer,
            drawParams: {
              viewport: currentViewport,
              projection: currentProjection,
            },
          };
          packets.push(packet);
          keys.push(this.keyFromPacket(packet, getViewportId(currentViewport)));
          break;
        }
        case "drawTexturedTriangles": {
          const texturedCommand = command as DrawTexturedTrianglesCommand;
          const packet: DrawPacket = {
            pass: currentPass,
            pipeline: 1,
            bindings: { textureId: texturedCommand.textureId },
            geometry: {
              buffer: "texturedVertices",
              offset: texturedCommand.offset,
              count: texturedCommand.count,
            },
            sortLayer: currentSortLayer,
            drawParams: {
              viewport: currentViewport,
              projection: currentProjection,
            },
          };
          packets.push(packet);
          keys.push(this.keyFromPacket(packet, getViewportId(currentViewport)));
          break;
        }
      }
    }

    return { packets, keys };
  }

  private keyFromPacket(packet: DrawPacket, viewportId: number): PackedKey {
    const bindingsId = packet.bindings.textureId
      ? hashString(packet.bindings.textureId)
      : 0;
    const batch =
      packet.pipeline | (bindingsId << 8) | ((viewportId & 0xffff) << 16);
    return {
      island: packet.pass,
      orderHint: packet.sortLayer,
      batch,
      merge: 0,
    };
  }

  private ensureBatchBuffer(numFloats: number): void {
    if (this.batchVertexBufferCapacity >= numFloats) return;
    if (this.batchVertexBuffer) this.batchVertexBuffer.destroy();

    this.batchVertexBufferCapacity = Math.max(
      BATCH_BUFFER_INITIAL_FLOATS,
      numFloats,
    );
    this.batchVertexData = new Float32Array(this.batchVertexBufferCapacity);
    this.batchVertexBuffer = this.bagl.buffer({
      data: this.batchVertexData,
      size: 2,
      usage: "stream",
    });
  }

  private uploadGroupVertices(
    group: DrawPacket[],
    frame: FrameCommands,
    pipeline: 0 | 1,
  ): { totalVerts: number; texture?: Texture2DHandle } | null {
    const floatsPerVertex =
      pipeline === 0 ? SHAPES_FLOATS_PER_VERTEX : TEXTURED_FLOATS_PER_VERTEX;
    const src = pipeline === 0 ? frame.vertices : frame.texturedVertices;
    let texture: Texture2DHandle | undefined = undefined;
    if (pipeline === 1) {
      if (!src) return null;
      texture = group[0].bindings.textureId
        ? (this.textures.get(group[0].bindings.textureId) ?? undefined)
        : undefined;
      if (!texture) return null;
    }

    if (!src) return null;

    const totalVerts = group.reduce((s, p) => s + p.geometry.count, 0);
    const totalFloats = totalVerts * floatsPerVertex;
    this.ensureBatchBuffer(totalFloats);

    const batchData = this.batchVertexData!;
    let writeOffset = 0;
    for (const p of group) {
      const start = p.geometry.offset * floatsPerVertex;
      const len = p.geometry.count * floatsPerVertex;
      batchData.set(src.subarray(start, start + len), writeOffset);
      writeOffset += len;
    }

    this.batchVertexBuffer!.subdata(batchData.subarray(0, totalFloats));
    const result: { totalVerts: number; texture?: Texture2DHandle } = {
      totalVerts,
    };
    if (pipeline === 1) result.texture = texture;
    return result;
  }

  private renderGroup(group: DrawPacket[], frame: FrameCommands) {
    if (group.length === 0) return;
    const first = group[0];
    const pipeline = first.pipeline as 0 | 1;
    const viewport = first.drawParams.viewport
      ? this.toViewport(first.drawParams.viewport)
      : undefined;
    const projection = first.drawParams.projection;

    const uploadResult = this.uploadGroupVertices(group, frame, pipeline);
    if (!uploadResult) return;
    const { totalVerts, texture } = uploadResult;

    this.drawCalls += 1;

    if (pipeline === 0) {
      this.drawShapes({
        vertices: this.batchVertexBuffer!,
        count: totalVerts,
        projection,
        viewport,
      });
    } else {
      this.drawText({
        vertices: this.batchVertexBuffer!,
        count: totalVerts,
        projection,
        texture: texture!,
        viewport,
      });
    }
  }

  private createShapePipeline() {
    const bagl = this.bagl;
    const draw = bagl({
      vert: `#version 300 es
        in vec2 aPosition;
        in vec4 aColor;
        out vec4 vColor;
        uniform mat4 uProjectionMatrix;
        void main() {
          gl_Position = uProjectionMatrix * vec4(aPosition, 0.0, 1.0);
          vColor = aColor;
        }
      `,
      frag: `#version 300 es
        precision mediump float;
        in vec4 vColor;
        out vec4 fragColor;
        void main() {
          fragColor = vColor;
        }
      `,
      attributes: {
        aPosition: (_ctx: unknown, props: any): BaglAttributeDescriptor => ({
          buffer: props.vertices,
          size: 2,
          stride: 24,
          offset: 0,
        }),
        aColor: (_ctx: unknown, props: any): BaglAttributeDescriptor => ({
          buffer: props.vertices,
          size: 4,
          stride: 24,
          offset: 8,
        }),
      },
      uniforms: {
        uProjectionMatrix: (_ctx: unknown, props: any) => props.projection,
      },
      count: (_ctx: unknown, props: any) => props.count,
      viewport: (_ctx: unknown, props: any) => props.viewport,
      depth: { enable: false },
      blend: {
        enable: true,
        func: ["src-alpha", "one-minus-src-alpha"],
      },
    });
    return (props: any) => draw(props);
  }

  private createTextPipeline() {
    const bagl = this.bagl;
    const draw = bagl({
      vert: `#version 300 es
        in vec2 aPosition;
        in vec4 aColor;
        in vec2 aUv;
        out vec4 vColor;
        out vec2 vUv;
        uniform mat4 uProjectionMatrix;
        void main() {
          gl_Position = uProjectionMatrix * vec4(aPosition, 0.0, 1.0);
          vColor = aColor;
          vUv = aUv;
        }
      `,
      frag: `#version 300 es
        precision mediump float;
        in vec4 vColor;
        in vec2 vUv;
        out vec4 fragColor;
        uniform sampler2D uTexture;
        void main() {
          // Sample atlas color and preserve alpha for edge antialiasing.
          vec4 texColor = texture(uTexture, vUv);
          fragColor = vec4(texColor.rgb * vColor.rgb, texColor.a * vColor.a);
        }
      `,
      attributes: {
        aPosition: (_ctx: unknown, props: any): BaglAttributeDescriptor => ({
          buffer: props.vertices,
          size: 2,
          stride: 32,
          offset: 0,
        }),
        aColor: (_ctx: unknown, props: any): BaglAttributeDescriptor => ({
          buffer: props.vertices,
          size: 4,
          stride: 32,
          offset: 8,
        }),
        aUv: (_ctx: unknown, props: any): BaglAttributeDescriptor => ({
          buffer: props.vertices,
          size: 2,
          stride: 32,
          offset: 24,
        }),
      },
      uniforms: {
        uProjectionMatrix: (_ctx: unknown, props: any) => props.projection,
        uTexture: (_ctx: unknown, props: any) => props.texture,
      },
      count: (_ctx: unknown, props: any) => props.count,
      viewport: (_ctx: unknown, props: any) => props.viewport,
      depth: { enable: false },
      blend: {
        enable: true,
        func: ["src-alpha", "one-minus-src-alpha"],
      },
    });
    return (props: any) => draw(props);
  }

  private toClearColor(
    color: [number, number, number, number?],
    alpha: number,
  ) {
    const [r, g, b, a = 255] = color;
    return [r / 255, g / 255, b / 255, (a / 255) * alpha] as [number, number, number, number];
  }

  private getProjection(viewport: Viewport | null): Float32Array {
    const key = viewportToKey(viewport);
    let proj = this.projectionCache.get(key);
    if (!proj) {
      proj = viewport ? this.orthoTopLeft(viewport) : this.identity();
      this.projectionCache.set(key, proj);
    }
    return proj;
  }

  private identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
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
      -2 * lr,
      0,
      0,
      0,
      0,
      -2 * bt,
      0,
      0,
      0,
      0,
      2 * nf,
      0,
      (left + right) * lr,
      (top + bottom) * bt,
      (far + near) * nf,
      1,
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
