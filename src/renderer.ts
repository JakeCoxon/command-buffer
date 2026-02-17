import { CommandBuffer } from "./commandBuffer";
import { TextRenderer } from "./textRenderer";
import { type FontAtlas } from "./fontAtlas";
import { type RenderAdapter } from "./adapter";
import { Viewport, Color, Rect } from "./types";
import { FrameCommands } from "./commands";

export interface RendererOptions {
  viewport: Viewport;
}

/**
 * High-level rendering API that coordinates CommandBuffer, TextRenderer,
 * FontAtlas, and adapter lifecycle.
 */
export class Renderer {
  private commandBuffer: CommandBuffer;
  public fontAtlas: FontAtlas | null = null;
  private textRenderer: TextRenderer | null = null;
  private adapter: RenderAdapter;
  private registeredTextureId: string | null = null;

  constructor(adapter: RenderAdapter, options: RendererOptions) {
    this.adapter = adapter;
    
    // Initialize CommandBuffer
    this.commandBuffer = new CommandBuffer(options.viewport);
  }

  /**
   * Set a new font atlas. This is a simple field setter, similar to context2d.font.
   * Texture registration/unregistration is handled automatically in endFrame().
   */
  setFontAtlas(fontAtlas: FontAtlas | null): void {
    this.fontAtlas = fontAtlas;
    if (fontAtlas) {
      if (!this.textRenderer) {
        this.textRenderer = new TextRenderer(this.commandBuffer, fontAtlas);
      } else {
        this.textRenderer.setFontAtlas(fontAtlas);
      }
    } else {
      this.textRenderer = null;
    }
  }

  /**
   * Begin a new frame - call this at the start of each render loop
   */
  beginFrame(clearColor?: Color, alpha?: number): void {
    // Clear the buffer
    this.commandBuffer.clear(clearColor || [0, 0, 0, 255], alpha || 1);
  }

  /**
   * End frame and render - call this at the end of each render loop
   * 
   * Handles texture updates after all drawing is complete but before rendering.
   * This ensures any glyphs added during the frame are reflected in the texture.
   * 
   * @returns The flushed frame commands (useful for stats/debugging)
   */
  endFrame(): FrameCommands {
    // Handle font atlas texture registration and updates
    if (this.fontAtlas) {
      const currentTextureId = this.fontAtlas.getTextureId();
      
      // Check if font atlas has changed (texture ID changed)
      if (this.registeredTextureId !== currentTextureId) {
        // Unregister old texture if it exists
        if (this.registeredTextureId !== null) {
          this.adapter.unregisterTexture(this.registeredTextureId);
        }
        // Register new texture
        this.adapter.registerTexture(
          currentTextureId,
          this.fontAtlas.getTexture() as HTMLCanvasElement
        );
        this.registeredTextureId = currentTextureId;
      }
      
      // Handle texture updates AFTER all drawing (including glyph additions) but BEFORE rendering
      if (this.fontAtlas.needsTextureReRegister()) {
        this.adapter.unregisterTexture(this.fontAtlas.getTextureId());
        this.adapter.registerTexture(
          this.fontAtlas.getTextureId(),
          this.fontAtlas.getTexture() as HTMLCanvasElement
        );
        this.fontAtlas.markTextureReRegistered();
      } else if (this.fontAtlas.needsTextureUpdate()) {
        this.adapter.updateTexture(
          this.fontAtlas.getTextureId(),
          this.fontAtlas.getTexture() as HTMLCanvasElement
        );
        this.fontAtlas.markTextureUpdated();
      }
    }
    
    // Flush commands and render
    const frame = this.commandBuffer.flush();
    this.adapter.render(frame);
    return frame;
  }

  /**
   * Set the viewport
   */
  setViewport(viewport: Viewport): void {
    this.commandBuffer.setViewport(viewport);
  }

  // Delegate drawing methods to CommandBuffer
  drawRect(rect: Rect, color: Color): void {
    this.commandBuffer.drawRect(rect, color);
  }

  drawRoundedRect(rect: Rect, radius: number, color: Color, segments?: number): void {
    this.commandBuffer.drawRoundedRect(rect, radius, color, segments);
  }

  drawCircle(x: number, y: number, radius: number, color: Color, segments?: number): void {
    this.commandBuffer.drawCircle(x, y, radius, color, segments);
  }

  drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, color: Color, segments?: number): void {
    this.commandBuffer.drawArc(x, y, radius, startAngle, endAngle, color, segments);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color): void {
    this.commandBuffer.drawLine(x1, y1, x2, y2, thickness, color);
  }

  drawCircleOutline(x: number, y: number, radius: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawCircleOutline(x, y, radius, lineWidth, color, segments);
  }

  drawArcOutline(x: number, y: number, radius: number, startAngle: number, endAngle: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawArcOutline(x, y, radius, startAngle, endAngle, lineWidth, color, segments);
  }

  drawRectOutline(rect: Rect, lineWidth: number, color: Color): void {
    this.commandBuffer.drawRectOutline(rect, lineWidth, color);
  }

  drawRoundedRectOutline(rect: Rect, radius: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawRoundedRectOutline(rect, radius, lineWidth, color, segments);
  }

  /**
   * Draw a textured rectangle
   */
  drawTexturedRect(
    rect: Rect,
    uv: { u1: number; v1: number; u2: number; v2: number },
    color: Color,
    textureId: string
  ): void {
    this.commandBuffer.drawTexturedRect(rect, uv, color, textureId);
  }

  // Delegate text methods to TextRenderer
  drawText(
    text: string,
    x: number,
    y: number,
    color?: [number, number, number, number?],
    lineHeight?: number
  ): void {
    if (!this.textRenderer) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawText(text, x, y, color, lineHeight);
  }

  drawTextWrapped(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color?: [number, number, number, number?],
    lineHeight?: number
  ): void {
    if (!this.textRenderer) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawTextWrapped(text, x, y, maxWidth, color, lineHeight);
  }

  measureText(text: string): number {
    if (!this.textRenderer) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before measuring text.");
    }
    return this.textRenderer.measureText(text);
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
  getTextRenderer(): TextRenderer | null {
    return this.textRenderer;
  }

  /**
   * Get access to underlying FontAtlas for advanced usage
   * @deprecated Use the fontAtlas property directly instead
   */
  getFontAtlas(): FontAtlas | null {
    return this.fontAtlas;
  }

  /**
   * Get number of draw calls from last render
   */
  getDrawCalls(): number {
    return this.adapter.getDrawCalls();
  }
}
