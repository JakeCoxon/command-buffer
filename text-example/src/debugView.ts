import { FontAtlas } from "./fontAtlas";

export class DebugView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private selectedGlyph: string | null = null;
  private scale: number = 1;
  private showGrid: boolean = true;
  private showBoundingBoxes: boolean = true;
  private showCoordinates: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for debug view");
    }
    this.ctx = ctx;

    // Handle clicks for glyph selection
    this.canvas.addEventListener("click", (e) => {
      this.handleClick(e);
    });
  }

  setScale(scale: number): void {
    this.scale = scale;
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
  }

  setShowBoundingBoxes(show: boolean): void {
    this.showBoundingBoxes = show;
  }

  setShowCoordinates(show: boolean): void {
    this.showCoordinates = show;
  }

  setSelectedGlyph(glyph: string | null): void {
    this.selectedGlyph = glyph;
  }

  render(atlas: FontAtlas): void {
    const debugInfo = atlas.getDebugInfo();
    const atlasCanvas = atlas.getCanvas();
    const { logical, pixel } = debugInfo.dimensions;

    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale to fit
    const maxWidth = this.canvas.width - 40;
    const maxHeight = this.canvas.height - 40;
    const scaleX = maxWidth / logical.width;
    const scaleY = maxHeight / logical.height;
    const fitScale = Math.min(scaleX, scaleY, 4); // Max 4x zoom
    const displayScale = this.scale * fitScale;

    const displayWidth = logical.width * displayScale;
    const displayHeight = logical.height * displayScale;
    const offsetX = (this.canvas.width - displayWidth) / 2;
    const offsetY = (this.canvas.height - displayHeight) / 2;

    // Draw background
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw border
    this.ctx.strokeStyle = "#444";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(offsetX - 1, offsetY - 1, displayWidth + 2, displayHeight + 2);

    // Draw atlas canvas
    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(displayScale, displayScale);
    this.ctx.drawImage(atlasCanvas, 0, 0, logical.width, logical.height);
    this.ctx.restore();

    // Draw grid
    if (this.showGrid) {
      this.ctx.strokeStyle = "#333";
      this.ctx.lineWidth = 1;
      for (let x = 0; x <= logical.width; x += 32) {
        const screenX = offsetX + x * displayScale;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, offsetY);
        this.ctx.lineTo(screenX, offsetY + displayHeight);
        this.ctx.stroke();
      }
      for (let y = 0; y <= logical.height; y += 32) {
        const screenY = offsetY + y * displayScale;
        this.ctx.beginPath();
        this.ctx.moveTo(offsetX, screenY);
        this.ctx.lineTo(offsetX + displayWidth, screenY);
        this.ctx.stroke();
      }
    }

    // Draw bounding boxes and highlights
    if (this.showBoundingBoxes) {
      for (const glyph of debugInfo.glyphs) {
        const isSelected = glyph.char === this.selectedGlyph;
        const x = offsetX + glyph.logical.x * displayScale;
        const y = offsetY + glyph.logical.y * displayScale;
        const w = glyph.logical.width * displayScale;
        const h = glyph.logical.height * displayScale;

        // Draw bounding box
        this.ctx.strokeStyle = isSelected ? "#0ff" : "#666";
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.strokeRect(x, y, w, h);

        // Highlight selected glyph
        if (isSelected) {
          this.ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
          this.ctx.fillRect(x, y, w, h);
        }

        // Draw coordinates
        if (this.showCoordinates && (isSelected || displayScale > 2)) {
          this.ctx.fillStyle = isSelected ? "#0ff" : "#888";
          this.ctx.font = "10px monospace";
          this.ctx.fillText(
            `${glyph.char} (${glyph.logical.x},${glyph.logical.y})`,
            x + 2,
            y + 12
          );
          if (isSelected) {
            this.ctx.fillText(
              `UV: (${glyph.uv.u1.toFixed(3)}, ${glyph.uv.v1.toFixed(3)}) → (${glyph.uv.u2.toFixed(3)}, ${glyph.uv.v2.toFixed(3)})`,
              x + 2,
              y + 24
            );
          }
        }
      }
    }

    // Draw info text
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "12px monospace";
    this.ctx.fillText(
      `Atlas: ${logical.width}x${logical.height} (${pixel.width}x${pixel.height} @ ${debugInfo.pixelRatio}x) | Glyphs: ${debugInfo.glyphCount} | Scale: ${displayScale.toFixed(2)}x`,
      10,
      20
    );
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Dispatch custom event with click position
    const event = new CustomEvent("debugGlyphClick", {
      detail: { x, y },
    });
    this.canvas.dispatchEvent(event);
  }

  /**
   * Find glyph at screen coordinates
   */
  findGlyphAt(atlas: FontAtlas, screenX: number, screenY: number): string | null {
    const debugInfo = atlas.getDebugInfo();
    const { logical } = debugInfo.dimensions;

    // Calculate scale
    const maxWidth = this.canvas.width - 40;
    const maxHeight = this.canvas.height - 40;
    const scaleX = maxWidth / logical.width;
    const scaleY = maxHeight / logical.height;
    const fitScale = Math.min(scaleX, scaleY, 4);
    const displayScale = this.scale * fitScale;

    const displayWidth = logical.width * displayScale;
    const displayHeight = logical.height * displayScale;
    const offsetX = (this.canvas.width - displayWidth) / 2;
    const offsetY = (this.canvas.height - displayHeight) / 2;

    // Convert screen coordinates to atlas coordinates
    const atlasX = (screenX - offsetX) / displayScale;
    const atlasY = (screenY - offsetY) / displayScale;

    // Find glyph at this position
    for (const glyph of debugInfo.glyphs) {
      if (
        atlasX >= glyph.logical.x &&
        atlasX < glyph.logical.x + glyph.logical.width &&
        atlasY >= glyph.logical.y &&
        atlasY < glyph.logical.y + glyph.logical.height
      ) {
        return glyph.char;
      }
    }

    return null;
  }
}
