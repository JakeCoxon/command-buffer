import { FrameCommands, Command, DrawTexturedTrianglesCommand } from "./commands";
import { batchCommands } from "./batchCommands";
import type { DrawPacket, PackedKey } from "./drawPacket";
import { Viewport, type Texture } from "./types";
import { type RenderAdapter } from "./adapter";

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

type ReglLike = ((config: any) => any) & {
  prop: (name: string) => any;
  clear: (options: { color: number[]; depth?: number }) => void;
  texture: (config: any) => any;
  buffer: (config: { data?: ArrayBufferView; length?: number; usage?: string }) => any;
};

type ReglAdapterOptions = {
  clear?: { color: [number, number, number, number] };
};

const BATCH_BUFFER_INITIAL_FLOATS = 65536 * 8; // enough for 64k textured vertices (larger stride)
const SHAPES_FLOATS_PER_VERTEX = 6;
const TEXTURED_FLOATS_PER_VERTEX = 8;

export class ReglAdapter implements RenderAdapter {
  private readonly drawShapes: any;
  private readonly drawText: any;
  private readonly textures: Map<string, any> = new Map();
  private currentViewport: Viewport | null = null;
  private surfaceSize: { w: number; h: number } | null = null;

  /** Single scratch buffer for merged vertex data (one draw per group). Shared by shapes and textured; resized when a group exceeds capacity. */
  private batchVertexBuffer: ReturnType<ReglLike["buffer"]> | null = null;
  private batchVertexBufferCapacity = 0;

  drawCalls: number = 0;

  constructor(private readonly regl: ReglLike, private readonly options: ReglAdapterOptions = {}) {
    this.drawShapes = this.createShapePipeline();
    this.drawText = this.createTextPipeline();
  }

  /**
   * Get the number of draw calls in the last render
   */
  getDrawCalls(): number {
    return this.drawCalls;
  }

  /**
   * Get the number of textures currently registered
   */
  getTextureCount(): number {
    return this.textures.size;
  }

  /**
   * Ensure a texture is uploaded: register if new, or update if already registered and version !== lastUploadedVersion.
   * flipY: true (default) = canvas top → texture v=1; flipY: false = canvas top → texture v=0.
   */
  uploadTexture(texture: Texture) {
    const source = texture.source;
    const flipY = texture.flipY !== false;
    const existing = this.textures.get(texture.id);
    const needsUpload = texture.version !== texture.lastUploadedVersion;
    if (!existing) {
      const reglTex = this.regl.texture({
        data: source,
        mag: "linear",
        min: "linear",
        wrap: "clamp",
        flipY,
        format: "rgba",
        premultiplyAlpha: false,
      });
      this.textures.set(texture.id, reglTex);
      texture.lastUploadedVersion = texture.version;
      console.log(`[ReglAdapter] Registered texture '${texture.id}': format=rgba, size=${"width" in source ? source.width : 0}x${"height" in source ? source.height : 0}, flipY=${flipY}`);
    } else if (needsUpload) {
      existing({
        data: source,
        format: "rgba",
        premultiplyAlpha: false,
        flipY,
      });
      texture.lastUploadedVersion = texture.version;
      console.log(`[ReglAdapter] Updated texture '${texture.id}': format=rgba, size=${"width" in source ? source.width : 0}x${"height" in source ? source.height : 0}, flipY=${flipY}`);
    }
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

  render(frame: FrameCommands) {
    if (frame.usedTextures) {
      for (const texture of frame.usedTextures.values()) {
        this.uploadTexture(texture);
      }
    }
    this.drawCalls = 0;

    const { packets, keys } = this.commandsToDrawPackets(frame);
    if (packets.length === 0) return;

    const groups = batchCommands(packets, keys);
    for (const group of groups) {
      this.renderGroup(group, frame);
    }
  }

  /**
   * Walk the command list once: apply clear/setViewport for side effects, build DrawPackets and PackedKeys.
   */
  private commandsToDrawPackets(frame: FrameCommands): { packets: DrawPacket[]; keys: PackedKey[] } {
    const packets: DrawPacket[] = [];
    const keys: PackedKey[] = [];
    let currentViewport: Viewport | null = null;
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
          this.regl.clear({
            color: this.toClearColor(command.color, command.alpha),
            depth: 1,
          });
          currentPass++;
          break;
        case "setViewport":
          currentViewport = command.viewport;
          this.currentViewport = command.viewport;
          const rect = command.viewport.rect;
          if (rect.x === 0 && rect.y === 0) {
            this.surfaceSize = { w: rect.w, h: rect.h };
          }
          break;
        case "pushLayer":
          sortLayerStack.push(currentSortLayer);
          currentSortLayer = 0;
          currentPass++;
          break;
        case "popLayer":
          currentSortLayer = sortLayerStack.pop() ?? 0;
          break;
        case "drawTriangles": {
          const projection = currentViewport ? this.orthoTopLeft(currentViewport) : this.identity();
          const packet: DrawPacket = {
            pass: currentPass,
            pipeline: 0,
            bindings: {},
            geometry: { buffer: "vertices", offset: command.offset, count: command.count },
            sortLayer: currentSortLayer,
            drawParams: { viewport: currentViewport, projection },
          };
          packets.push(packet);
          keys.push(this.keyFromPacket(packet, getViewportId(currentViewport)));
          break;
        }
        case "drawTexturedTriangles": {
          const texturedCommand = command as DrawTexturedTrianglesCommand;
          const projection = currentViewport ? this.orthoTopLeft(currentViewport) : this.identity();
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
            drawParams: { viewport: currentViewport, projection },
          };
          packets.push(packet);
          keys.push(this.keyFromPacket(packet, getViewportId(currentViewport)));
          break;
        }
      }
    }

    return { packets, keys };
  }

  /** Policy: encode island, orderHint, batch (pipeline + bindings + viewport), merge. Same batch → same regl command. */
  private keyFromPacket(packet: DrawPacket, viewportId: number): PackedKey {
    const bindingsId = packet.bindings.textureId ? hashString(packet.bindings.textureId) : 0;
    const batch =
      packet.pipeline | (bindingsId << 8) | ((viewportId & 0xffff) << 16);
    return {
      island: packet.pass,
      orderHint: packet.sortLayer,
      batch,
      merge: 0,
    };
  }

  /** Ensure shared scratch buffer has at least numFloats capacity; create or resize as needed. */
  private ensureBatchBuffer(numFloats: number): void {
    if (this.batchVertexBufferCapacity >= numFloats) return;
    if (this.batchVertexBuffer) this.batchVertexBuffer.destroy();
    this.batchVertexBufferCapacity = Math.max(BATCH_BUFFER_INITIAL_FLOATS, numFloats);
    this.batchVertexBuffer = this.regl.buffer({
      data: new Float32Array(this.batchVertexBufferCapacity),
      usage: "stream",
    });
  }

  /**
   * Merge all packets in group into one contiguous Float32Array.
   * pipeline 0 = shapes (6 floats/vertex), 1 = textured (8 floats/vertex). Returns null for textured if texture or texturedVertices missing.
   */
  private mergeGroupVertices(
    group: DrawPacket[],
    frame: FrameCommands,
    pipeline: 0 | 1
  ): { merged: Float32Array; totalVerts: number; texture?: any } | null {
    const floatsPerVertex = pipeline === 0 ? SHAPES_FLOATS_PER_VERTEX : TEXTURED_FLOATS_PER_VERTEX;
    const src = pipeline === 0 ? frame.vertices : frame.texturedVertices;
    let texture: any = undefined;
    if (pipeline === 1) {
      if (!src) return null;
      texture = group[0].bindings.textureId
        ? this.textures.get(group[0].bindings.textureId)
        : null;
      if (!texture) return null;
    }
    const totalVerts = group.reduce((s, p) => s + p.geometry.count, 0);
    const merged = new Float32Array(totalVerts * floatsPerVertex);
    let writeOffset = 0;
    for (const p of group) {
      const start = p.geometry.offset * floatsPerVertex;
      const len = p.geometry.count * floatsPerVertex;
      merged.set(src!.subarray(start, start + len), writeOffset);
      writeOffset += len;
    }
    const result: { merged: Float32Array; totalVerts: number; texture?: any } = { merged, totalVerts };
    if (pipeline === 1) result.texture = texture;
    return result;
  }

  /** Render one group with one draw call: merge vertices into scratch buffer, upload, draw. */
  private renderGroup(group: DrawPacket[], frame: FrameCommands) {
    if (group.length === 0) return;
    const first = group[0];
    const pipeline = first.pipeline as 0 | 1;
    const viewport = first.drawParams.viewport ? this.toViewport(first.drawParams.viewport) : undefined;
    const projection = first.drawParams.projection;

    const mergedResult = this.mergeGroupVertices(group, frame, pipeline);
    if (!mergedResult) return;
    const { merged, totalVerts, texture } = mergedResult;

    this.ensureBatchBuffer(merged.length);
    this.batchVertexBuffer!.subdata(merged);
    this.drawCalls += 1;

    if (pipeline === 0) {
      this.drawShapes({
        vertices: this.batchVertexBuffer,
        offsetBytes: 0,
        colorOffsetBytes: 8,
        count: totalVerts,
        projection,
        viewport,
      });
    } else {
      this.drawText({
        vertices: this.batchVertexBuffer,
        offsetBytes: 0,
        colorOffsetBytes: 8,
        uvOffsetBytes: 24,
        count: totalVerts,
        projection,
        texture,
        viewport,
      });
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
          // Preserve alpha channel from texture for proper transparency/antialiasing
          gl_FragColor = vec4(texColor.rgb * vColor.rgb, texColor.a * vColor.a);
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
