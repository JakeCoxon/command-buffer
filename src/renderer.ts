import { CommandBuffer } from "./commandBuffer";
import { TextRenderer } from "./textRenderer";
import { type FontAtlas } from "./fontAtlas";
import { type RenderAdapter } from "./adapter";
import { Viewport, Color, Rect, Texture, Transform } from "./types";
import { FrameCommands } from "./commands";
import { ArcShape, fillArc, fillQuad, fillRect, fillRoundedRect, fillTriangle, LineSegmentShape, PaintedShape, PaintOptions, QuadShape, RectShape, strokeArc, strokeLineSegment, strokeQuad, strokeRect, strokeRoundedRect, strokeTriangle, TransformedShape, TriangleShape } from "./drawFunctions";
import { identityTransform, TransformStack } from "./transform";

/**
 * High-level rendering API that coordinates CommandBuffer, TextRenderer,
 * FontAtlas, and adapter lifecycle.
 */
export class Renderer {
  private commandBuffer: CommandBuffer;
  private textRenderer: TextRenderer;
  private adapter: RenderAdapter;

  constructor(adapter: RenderAdapter) {
    this.adapter = adapter;
    
    // Initialize CommandBuffer
    this.commandBuffer = new CommandBuffer();
    this.textRenderer = new TextRenderer(this.commandBuffer);
  }

  createContext(): RendererContext {
    return new RendererContext(this);
  }

  /**
   * Begin a new frame - call this at the start of each render loop
   */
  beginFrame(viewport: Viewport): void {
    this.commandBuffer.reset();
    this.commandBuffer.setViewport(viewport);
  }

  /**
   * End frame and render. The adapter uploads textures from frame.usedTextures.
   * @returns The flushed frame commands (useful for stats/debugging)
   */
  endFrame(): FrameCommands {
    const frame = this.commandBuffer.flush();
    this.adapter.render(frame);
    return frame;
  }

  /**
   * Get access to underlying CommandBuffer for advanced usage
   */
  getCommandBuffer(): CommandBuffer {
    return this.commandBuffer;
  }

  /**
   * Get access to underlying TextRenderer for advanced usage
   */
  getTextRenderer(): TextRenderer {
    return this.textRenderer;
  }
  /**
   * Get number of draw calls from last render
   */
  getDrawCalls(): number {
    return this.adapter.getDrawCalls();
  }

  /**
   * Set the viewport
   */
  setViewport(viewport: Viewport): void {
    this.commandBuffer.setViewport(viewport);
  }

}

/**
 * A context for rendering. It holds mutable state for the current rendering context.
 * including the current transform stack and the current fill and stroke colors.
 * Creating a child context will create a new transform stack initialized to the
 * parent's current transform. All other mutable state is reset to initial values.
 */
export class RendererContext {
  private fontAtlas: FontAtlas | null = null;
  private commandBuffer: CommandBuffer;
  private textRenderer: TextRenderer;

  private transformStack: TransformStack;
  private currentTransform: Transform;

  private fillColor: Color = [0, 0, 0, 1];
  private lineWidth: number = 1;
  private strokeColor: Color = [0, 0, 0, 1];
  private arcSegments: number = 24;

  constructor(private renderer: Renderer, initialTransform: Transform = identityTransform()) {
    this.commandBuffer = renderer.getCommandBuffer();
    this.textRenderer = renderer.getTextRenderer();
    this.currentTransform = initialTransform;
    this.transformStack = new TransformStack(initialTransform);
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  createChildContext(): RendererContext {
    return new RendererContext(this.renderer, this.currentTransform);
  }

  setStrokeColor(color: Color): RendererContext {
    this.strokeColor = color;
    return this;
  }

  getStrokeColor(): Color {
    return this.strokeColor;
  }

  setLineWidth(width: number): RendererContext {
    this.lineWidth = width;
    return this;
  }

  getLineWidth(): number {
    return this.lineWidth;
  }

  setFillColor(color: Color): RendererContext {
    this.fillColor = color;
    return this;
  }

  getFillColor(): Color {
    return this.fillColor;
  }

  setArcSegments(segments: number): RendererContext {
    this.arcSegments = segments;
    return this;
  }

  getArcSegments(): number {
    return this.arcSegments;
  }

  /**
   * Set a new font atlas. This is a simple field setter, similar to context2d.font.
   * Texture uploads are handled by the adapter from frame.usedTextures.
   */
  setFontAtlas(fontAtlas: FontAtlas | null): void {
    this.fontAtlas = fontAtlas;
    this.textRenderer.setFontAtlas(fontAtlas);
  }

  save() { this.transformStack.save() }
  restore() { this.currentTransform = this.transformStack.pop(); }
  translate(x: number, y: number) { this.currentTransform = this.transformStack.translate(x, y); }
  scale(x: number, y: number) { this.currentTransform = this.transformStack.scale(x, y); }
  rotate(angle: number) { this.currentTransform = this.transformStack.rotate(angle); }
  resetTransform() { this.currentTransform = this.transformStack.reset(); }

  private paintOptions(): PaintOptions {
    return { transform: this.currentTransform, fillColor: this.fillColor, strokeColor: this.strokeColor, strokeWidth: this.lineWidth };
  }

  // Delegate drawing methods to CommandBuffer
  drawRect(rect: Rect): void {
    const offset = this.commandBuffer.beginDraw();
    const rectShape = new RectShape(rect.x, rect.y, rect.w, rect.h)
    fillRect(this.commandBuffer, this.currentTransform, rectShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawRoundedRect(rect: Rect, radius: number): void {
    const offset = this.commandBuffer.beginDraw();
    const rectShape = new RectShape(rect.x, rect.y, rect.w, rect.h, radius);
    fillRoundedRect(this.commandBuffer, this.currentTransform, rectShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawCircle(x: number, y: number, radius: number): void {
    const offset = this.commandBuffer.beginDraw();
    const arcShape = new ArcShape(x, y, radius, 0, Math.PI * 2, this.arcSegments);
    fillArc(this.commandBuffer, this.currentTransform, arcShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    const offset = this.commandBuffer.beginDraw();
    const arcShape = new ArcShape(x, y, radius, startAngle, endAngle, this.arcSegments);
    fillArc(this.commandBuffer, this.currentTransform, arcShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number): void {
    const offset = this.commandBuffer.beginDraw();
    const lineSegmentShape = new LineSegmentShape(x1, y1, x2, y2);
    strokeLineSegment(this.commandBuffer, this.currentTransform, lineSegmentShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawCircleOutline(x: number, y: number, radius: number): void {
    const offset = this.commandBuffer.beginDraw();
    const arcShape = new ArcShape(x, y, radius, 0, Math.PI * 2, this.arcSegments);
    strokeArc(this.commandBuffer, this.currentTransform, arcShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawArcOutline(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    const offset = this.commandBuffer.beginDraw();
    const arcShape = new ArcShape(x, y, radius, startAngle, endAngle, this.arcSegments);
    strokeArc(this.commandBuffer, this.currentTransform, arcShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawRectOutline(rect: Rect): void {
    const offset = this.commandBuffer.beginDraw();
    const rectShape = new RectShape(rect.x, rect.y, rect.w, rect.h);
    strokeRect(this.commandBuffer, this.currentTransform, rectShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawRoundedRectOutline(rect: Rect, radius: number): void {
    const offset = this.commandBuffer.beginDraw();
    const rectShape = new RectShape(rect.x, rect.y, rect.w, rect.h, radius);
    strokeRoundedRect(this.commandBuffer, this.currentTransform, rectShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const offset = this.commandBuffer.beginDraw();
    const triangleShape = new TriangleShape(x1, y1, x2, y2, x3, y3);
    fillTriangle(this.commandBuffer, this.currentTransform, triangleShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawTriangleOutline(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const offset = this.commandBuffer.beginDraw();
    const triangleShape = new TriangleShape(x1, y1, x2, y2, x3, y3);
    strokeTriangle(this.commandBuffer, this.currentTransform, triangleShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawQuad(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
    const offset = this.commandBuffer.beginDraw();
    const quadShape = new QuadShape(x1, y1, x2, y2, x3, y3, x4, y4);
    fillQuad(this.commandBuffer, this.currentTransform, quadShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  drawQuadOutline(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
    const offset = this.commandBuffer.beginDraw();
    const quadShape = new QuadShape(x1, y1, x2, y2, x3, y3, x4, y4);
    strokeQuad(this.commandBuffer, this.currentTransform, quadShape, this.paintOptions());
    this.commandBuffer.endDraw(offset);
  }

  /**
   * Draw a textured rectangle
   */
  drawTexturedRect(
    rect: Rect,
    uv: { u1: number; v1: number; u2: number; v2: number },
    texture: Texture
  ): void {
    this.commandBuffer.drawTexturedRect(rect, uv, this.fillColor, texture);
  }

  // Delegate text methods to TextRenderer
  drawText(
    text: string,
    x: number,
    y: number,
    scale?: number
  ): void {
    if (!this.textRenderer) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawText(text, x, y, this.fillColor, scale ?? 1);
  }

  drawTextWrapped(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    scale?: number
  ): void {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawTextWrapped(text, x, y, maxWidth, this.fillColor, scale ?? 1);
  }

  measureText(text: string): number {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before measuring text.");
    }
    return this.textRenderer.measureText(text);
  }

  getLineMetrics(text: string): { ascend: number; descend: number } {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before getting line metrics.");
    }
    return this.textRenderer.getLineMetrics(text);
  }

  /**
   * Get access to underlying FontAtlas for advanced usage
   */
  getFontAtlas(): FontAtlas | null {
    return this.fontAtlas;
  }

}
