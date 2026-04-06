import { Color, Rect, Viewport, Texture } from "./types";
import { Command, FrameCommands } from "./commands";
import { GrowableFloat32Buffer } from "./growableFloat32Buffer";

const VERT_FLOATS = 6;
const TEXTURED_FLOATS = 8;

/** Initial capacity in floats (~256 verts each pipeline). */
const VERT_CAPACITY_INIT = 256 * VERT_FLOATS;
const TEXTURED_CAPACITY_INIT = 256 * TEXTURED_FLOATS;

export class CommandBuffer {
  private readonly vertices = new GrowableFloat32Buffer(VERT_CAPACITY_INIT);
  private readonly texturedVertices = new GrowableFloat32Buffer(TEXTURED_CAPACITY_INIT);

  private commands: Command[] = [];
  private usedTextures = new Map<string, Texture>();

  constructor() {
  }

  reset() {
    this.vertices.reset();
    this.texturedVertices.reset();
    this.commands.length = 0;
    this.usedTextures.clear();
  }

  clear(color: Color, alpha = 1) {
    this.commands.push({ type: "clear", color, alpha });
  }

  setViewport(viewport: Viewport) {
    this.commands.push({ type: "setViewport", viewport });
  }

  pushLayer(key: string, rect: Rect) {
    this.commands.push({ type: "pushLayer", key, rect });
  }

  popLayer() {
    this.commands.push({ type: "popLayer" });
  }

  flush(): FrameCommands {
    const vertices = this.vertices.copyUsed();
    const rawCommandCount = this.commands.length;
    const commands = [...this.commands];
    const result: FrameCommands = { vertices, commands, rawCommandCount };
    result.usedTextures = new Map(this.usedTextures);

    if (this.texturedVertices.used > 0) {
      result.texturedVertices = this.texturedVertices.copyUsed();
    }

    this.reset();
    return result;
  }

  appendTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    c: Color
  ) {
    this.pushVertex(x1, y1, c);
    this.pushVertex(x2, y2, c);
    this.pushVertex(x3, y3, c);
  }

  beginDraw() {
    return this.vertexCount();
  }

  endDraw(offset: number) {
    const count = this.vertexCount() - offset;
    if (count > 0) {
      this.commands.push({ type: "drawTriangles", offset, count });
    }
  }

  /**
   * Draw a textured rectangle (used for text rendering)
   */
  drawTexturedRect(rect: Rect, uv: { u1: number; v1: number; u2: number; v2: number }, color: Color, texture: Texture) {
    const { x, y, w, h } = rect;
    const offset = this.beginTexturedDraw();

    this.appendTexturedTriangle(x, y, uv.u1, uv.v1, x + w, y, uv.u2, uv.v1, x, y + h, uv.u1, uv.v2, color);
    this.appendTexturedTriangle(x + w, y, uv.u2, uv.v1, x + w, y + h, uv.u2, uv.v2, x, y + h, uv.u1, uv.v2, color);

    this.endTexturedDraw(offset, texture);
  }

  appendTexturedTriangle(
    x1: number,
    y1: number,
    u1: number,
    v1: number,
    x2: number,
    y2: number,
    u2: number,
    v2: number,
    x3: number,
    y3: number,
    u3: number,
    v3: number,
    c: Color
  ) {
    this.pushTexturedVertex(x1, y1, u1, v1, c);
    this.pushTexturedVertex(x2, y2, u2, v2, c);
    this.pushTexturedVertex(x3, y3, u3, v3, c);
  }

  beginTexturedDraw() {
    return this.texturedVertexCount();
  }

  endTexturedDraw(startOffset: number, texture: Texture) {
    const count = this.texturedVertexCount() - startOffset;
    if (count > 0) {
      this.usedTextures.set(texture.id, texture);
      this.commands.push({ type: "drawTexturedTriangles", offset: startOffset, count, textureId: texture.id });
    }
  }

  vertexCount() {
    return this.vertices.used / VERT_FLOATS;
  }

  texturedVertexCount() {
    return this.texturedVertices.used / TEXTURED_FLOATS;
  }

  private pushVertex(x: number, y: number, c: Color) {
    const v = this.vertices;
    v.ensureRoom(VERT_FLOATS);
    const b = v.array;
    let i = v.used;
    b[i++] = x;
    b[i++] = y;
    b[i++] = c[0];
    b[i++] = c[1];
    b[i++] = c[2];
    b[i++] = c[3] ?? 1;
    v.used = i;
  }

  private pushTexturedVertex(x: number, y: number, u: number, vCoord: number, c: Color) {
    const t = this.texturedVertices;
    t.ensureRoom(TEXTURED_FLOATS);
    const b = t.array;
    let i = t.used;
    b[i++] = x;
    b[i++] = y;
    b[i++] = c[0];
    b[i++] = c[1];
    b[i++] = c[2];
    b[i++] = c[3] ?? 1;
    b[i++] = u;
    b[i++] = vCoord;
    t.used = i;
  }
}
