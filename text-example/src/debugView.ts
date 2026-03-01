import { FontAtlas } from "../../src/fontAtlas";
import { Renderer } from "../../src/renderer";

export class DebugView {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private renderer: Renderer;
  private fontAtlas: FontAtlas | null = null;

  private selectedGlyph: string | null = null;
  private scale: number = 4; // Default to 4x scale to see pixels clearly
  private showGrid: boolean = true;
  private showBoundingBoxes: boolean = true;
  private showCoordinates: boolean = true;
  private visible: boolean = false;
  private useNearestInterpolation: boolean = true; // Use nearest neighbor for pixel-perfect view

  // UI elements
  private panel: HTMLDivElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private close: HTMLButtonElement | null = null;
  private atlasInfo: HTMLDivElement | null = null;
  private glyphInfo: HTMLDivElement | null = null;
  private positionInfo: HTMLDivElement | null = null;
  private uvInfo: HTMLDivElement | null = null;
  private metricsInfo: HTMLDivElement | null = null;
  private showGridCheckbox: HTMLInputElement | null = null;
  private showBoxesCheckbox: HTMLInputElement | null = null;
  private showCoordsCheckbox: HTMLInputElement | null = null;
  private logAllButton: HTMLButtonElement | null = null;
  private exportButton: HTMLButtonElement | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    
    // Create all UI elements
    this.createUI();

    // Setup event handlers
    this.setupEventHandlers();
  }

  private createUI(): void {
    // Create debug panel
    this.panel = document.createElement("div");
    this.panel.id = "debugPanel";
    this.panel.className = "debug-panel";
    this.panel.style.display = "none";
    document.body.appendChild(this.panel);

    // Create header
    const header = document.createElement("div");
    header.className = "debug-header";
    this.panel.appendChild(header);

    const title = document.createElement("h3");
    title.textContent = "Font Atlas Debug";
    header.appendChild(title);

    this.close = document.createElement("button");
    this.close.id = "debugClose";
    this.close.textContent = "×";
    header.appendChild(this.close);

    // Create content container
    const content = document.createElement("div");
    content.className = "debug-content";
    this.panel.appendChild(content);

    // Create info section
    const infoSection = document.createElement("div");
    infoSection.className = "debug-info";
    content.appendChild(infoSection);

    this.atlasInfo = document.createElement("div");
    this.atlasInfo.id = "debugAtlasInfo";
    this.atlasInfo.textContent = "Atlas: -";
    infoSection.appendChild(this.atlasInfo);

    this.glyphInfo = document.createElement("div");
    this.glyphInfo.id = "debugGlyphInfo";
    this.glyphInfo.textContent = "Selected: -";
    infoSection.appendChild(this.glyphInfo);

    this.positionInfo = document.createElement("div");
    this.positionInfo.id = "debugPositionInfo";
    this.positionInfo.textContent = "Position: -";
    infoSection.appendChild(this.positionInfo);

    this.uvInfo = document.createElement("div");
    this.uvInfo.id = "debugUVInfo";
    this.uvInfo.textContent = "UV: -";
    infoSection.appendChild(this.uvInfo);

    this.metricsInfo = document.createElement("div");
    this.metricsInfo.id = "debugMetricsInfo";
    this.metricsInfo.textContent = "Metrics: -";
    infoSection.appendChild(this.metricsInfo);

    // Create controls section
    const controlsSection = document.createElement("div");
    controlsSection.className = "debug-controls";
    content.appendChild(controlsSection);

    // Show Grid checkbox
    const gridLabel = document.createElement("label");
    this.showGridCheckbox = document.createElement("input");
    this.showGridCheckbox.type = "checkbox";
    this.showGridCheckbox.id = "debugShowGrid";
    this.showGridCheckbox.checked = true;
    gridLabel.appendChild(this.showGridCheckbox);
    gridLabel.appendChild(document.createTextNode(" Show Grid"));
    controlsSection.appendChild(gridLabel);

    // Show Boxes checkbox
    const boxesLabel = document.createElement("label");
    this.showBoxesCheckbox = document.createElement("input");
    this.showBoxesCheckbox.type = "checkbox";
    this.showBoxesCheckbox.id = "debugShowBoxes";
    this.showBoxesCheckbox.checked = true;
    boxesLabel.appendChild(this.showBoxesCheckbox);
    boxesLabel.appendChild(document.createTextNode(" Show Boxes"));
    controlsSection.appendChild(boxesLabel);

    // Show Coords checkbox
    const coordsLabel = document.createElement("label");
    this.showCoordsCheckbox = document.createElement("input");
    this.showCoordsCheckbox.type = "checkbox";
    this.showCoordsCheckbox.id = "debugShowCoords";
    this.showCoordsCheckbox.checked = true;
    coordsLabel.appendChild(this.showCoordsCheckbox);
    coordsLabel.appendChild(document.createTextNode(" Show Coords"));
    controlsSection.appendChild(coordsLabel);

    // Nearest Interpolation checkbox
    const nearestLabel = document.createElement("label");
    const nearestCheckbox = document.createElement("input");
    nearestCheckbox.type = "checkbox";
    nearestCheckbox.id = "debugNearestInterpolation";
    nearestCheckbox.checked = true;
    nearestLabel.appendChild(nearestCheckbox);
    nearestLabel.appendChild(document.createTextNode(" Nearest Interpolation"));
    controlsSection.appendChild(nearestLabel);
    nearestCheckbox.addEventListener("change", (e) => {
      this.useNearestInterpolation = (e.target as HTMLInputElement).checked;
    });

    // Scale input
    const scaleLabel = document.createElement("label");
    scaleLabel.textContent = "Scale: ";
    const scaleInput = document.createElement("input");
    scaleInput.type = "number";
    scaleInput.id = "debugScale";
    scaleInput.min = "0.5";
    scaleInput.max = "16";
    scaleInput.step = "0.5";
    scaleInput.value = "4";
    scaleLabel.appendChild(scaleInput);
    controlsSection.appendChild(scaleLabel);
    scaleInput.addEventListener("change", (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value > 0) {
        this.setScale(value);
      }
    });

    // Log All button
    this.logAllButton = document.createElement("button");
    this.logAllButton.id = "debugLogAll";
    this.logAllButton.textContent = "Log All Glyphs";
    controlsSection.appendChild(this.logAllButton);

    // Export button
    this.exportButton = document.createElement("button");
    this.exportButton.id = "debugExport";
    this.exportButton.textContent = "Export Atlas";
    controlsSection.appendChild(this.exportButton);

    // Create debug canvas
    this.canvas = document.createElement("canvas");
    this.canvas.id = "debugCanvas";
    this.canvas.width = 560;
    this.canvas.height = 400;
    content.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for debug view");
    }
    this.ctx = ctx;

    // Create toggle button
    this.toggle = document.createElement("button");
    this.toggle.id = "debugToggle";
    this.toggle.className = "debug-toggle";
    this.toggle.textContent = "Debug";
    document.body.appendChild(this.toggle);
  }

  private setupEventHandlers(): void {
    // Toggle debug panel
    if (this.toggle) {
      this.toggle.addEventListener("click", () => {
        this.setVisible(!this.visible);
      });
    }

    if (this.close) {
      this.close.addEventListener("click", () => {
        this.setVisible(false);
      });
    }

    // Debug controls
    if (this.showGridCheckbox) {
      this.showGridCheckbox.addEventListener("change", (e) => {
        this.setShowGrid((e.target as HTMLInputElement).checked);
      });
    }

    if (this.showBoxesCheckbox) {
      this.showBoxesCheckbox.addEventListener("change", (e) => {
        this.setShowBoundingBoxes((e.target as HTMLInputElement).checked);
      });
    }

    if (this.showCoordsCheckbox) {
      this.showCoordsCheckbox.addEventListener("change", (e) => {
        this.setShowCoordinates((e.target as HTMLInputElement).checked);
      });
    }

    if (this.logAllButton) {
      this.logAllButton.addEventListener("click", () => {
        if (!this.fontAtlas) return;
        const debugInfo = this.fontAtlas.getDebugInfo() as any;
        console.log("[Atlas] All glyphs:", debugInfo);
        for (const glyph of debugInfo.glyphs) {
          console.log(
            `  '${glyph.char}': logical(${glyph.logical.x}, ${glyph.logical.y}, ${glyph.logical.width}, ${glyph.logical.height}) ` +
            `pixel(${glyph.pixel.x}, ${glyph.pixel.y}, ${glyph.pixel.width}, ${glyph.pixel.height}) ` +
            `UV(${glyph.uv.u1.toFixed(4)}, ${glyph.uv.v1.toFixed(4)}, ${glyph.uv.u2.toFixed(4)}, ${glyph.uv.v2.toFixed(4)})`
          );
        }
      });
    }

    if (this.exportButton) {
      this.exportButton.addEventListener("click", () => {
        if (!this.fontAtlas) return;
        const atlasCanvas = this.fontAtlas.textureHandle.source;
        const link = document.createElement("a");
        link.download = "font-atlas.png";
        link.href = (atlasCanvas as HTMLCanvasElement).toDataURL();
        link.click();
      });
    }

    // Handle clicks for glyph selection
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!this.fontAtlas) return;
      const glyph = this.findGlyphAt(this.fontAtlas, x, y);
      this.setSelectedGlyph(glyph);
      this.updateDebugInfo();
    });

  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.panel) {
      this.panel.style.display = visible ? "flex" : "none";
    }
    if (visible) {
      this.updateDebugInfo();
    }
  }

  isVisible(): boolean {
    return this.visible;
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

  update(atlas: FontAtlas): void {
    this.fontAtlas = atlas;
    if (!this.visible) return;
    this.render(atlas);
    this.updateDebugInfo();
  }

  private render(atlas: FontAtlas): void {
    const debugInfo = atlas.getDebugInfo() as any;
    const atlasCanvas = atlas.textureHandle.source;
    const { logical, pixel } = debugInfo.dimensions;

    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale to fit
    const maxWidth = this.canvas.width - 40;
    const maxHeight = this.canvas.height - 40;
    const scaleX = maxWidth / logical.width;
    const scaleY = maxHeight / logical.height;
    const fitScale = Math.min(scaleX, scaleY, 8); // Max 8x zoom for better pixel viewing
    const displayScale = this.scale * fitScale;

    const displayWidth = logical.width * displayScale;
    const displayHeight = logical.height * displayScale;
    // Position at top-left instead of centering
    const offsetX = 20;
    const offsetY = 20;

    // Draw checkerboard background to show transparency
    this.drawCheckerboard(offsetX, offsetY, displayWidth, displayHeight, 16 * displayScale);

    // Draw border
    this.ctx.strokeStyle = "#444";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(offsetX - 1, offsetY - 1, displayWidth + 2, displayHeight + 2);

    // Draw atlas canvas with nearest neighbor interpolation for pixel-perfect view
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = !this.useNearestInterpolation;
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

    // Draw bounding boxes, padding, content rect, and baselines
    if (this.showBoundingBoxes) {
      const padding = (debugInfo.padding as number) ?? 0;
      for (const glyph of debugInfo.glyphs) {
        const isSelected = glyph.char === this.selectedGlyph;
        const hasContent = "content" in glyph && glyph.content;

        // Padded cell (full logical rect)
        const cellX = offsetX + glyph.logical.x * displayScale;
        const cellY = offsetY + glyph.logical.y * displayScale;
        const cellW = glyph.logical.width * displayScale;
        const cellH = glyph.logical.height * displayScale;

        // Padding: draw padded cell with a distinct fill
        if (padding > 0) {
          this.ctx.fillStyle = "rgba(128, 128, 255, 0.15)";
          this.ctx.fillRect(cellX, cellY, cellW, cellH);
        }
        this.ctx.strokeStyle = isSelected ? "#0ff" : "#666";
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.strokeRect(cellX, cellY, cellW, cellH);

        // Content rect (actual glyph bounds, no padding)
        if (hasContent) {
          const cx = offsetX + glyph.content.x * displayScale;
          const cy = offsetY + glyph.content.y * displayScale;
          const cw = glyph.content.width * displayScale;
          const ch = glyph.content.height * displayScale;
          this.ctx.strokeStyle = isSelected ? "#0f8" : "#4a4";
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(cx, cy, cw, ch);

          // Baseline (horizontal line at content top + ascend)
          const baselineY = offsetY + (glyph.content.y + glyph.metrics.ascend) * displayScale;
          this.ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
          this.ctx.lineWidth = 1;
          this.ctx.setLineDash([2, 2]);
          this.ctx.beginPath();
          this.ctx.moveTo(cx, baselineY);
          this.ctx.lineTo(cx + cw, baselineY);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }

        if (isSelected) {
          this.ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
          this.ctx.fillRect(cellX, cellY, cellW, cellH);
        }

        // Draw coordinates
        if (this.showCoordinates && (isSelected || displayScale > 2)) {
          this.ctx.fillStyle = isSelected ? "#0ff" : "#888";
          this.ctx.font = "10px monospace";
          this.ctx.fillText(
            `${glyph.char} (${glyph.logical.x},${glyph.logical.y})`,
            cellX + 2,
            cellY + 12
          );
          if (isSelected) {
            this.ctx.fillText(
              `UV: (${glyph.uv.u1.toFixed(3)}, ${glyph.uv.v1.toFixed(3)}) → (${glyph.uv.u2.toFixed(3)}, ${glyph.uv.v2.toFixed(3)})`,
              cellX + 2,
              cellY + 24
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

  /**
   * Find glyph at screen coordinates
   */
  findGlyphAt(atlas: FontAtlas, screenX: number, screenY: number): string | null {
    const debugInfo = atlas.getDebugInfo() as any;
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
    // Position at top-left instead of centering
    const offsetX = 20;
    const offsetY = 20;

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

  /**
   * Draw a checkerboard pattern to show transparency
   */
  private drawCheckerboard(x: number, y: number, width: number, height: number, tileSize: number): void {
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(x, y, width, height);
    
    this.ctx.fillStyle = "#2a2a2a";
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if ((row + col) % 2 === 0) {
          const tileX = x + col * tileSize;
          const tileY = y + row * tileSize;
          const tileW = Math.min(tileSize, width - (tileX - x));
          const tileH = Math.min(tileSize, height - (tileY - y));
          this.ctx.fillRect(tileX, tileY, tileW, tileH);
        }
      }
    }
  }

  private updateDebugInfo(): void {
    if (!this.visible || !this.fontAtlas) return;

    const debugInfo = this.fontAtlas.getDebugInfo() as any;
    
    if (this.atlasInfo) {
      this.atlasInfo.textContent = 
        `Atlas: ${debugInfo.dimensions.logical.width}x${debugInfo.dimensions.logical.height} ` +
        `(${debugInfo.dimensions.pixel.width}x${debugInfo.dimensions.pixel.height} @ ${debugInfo.pixelRatio}x)`;
    }

    if (this.selectedGlyph) {
      const glyph = debugInfo.glyphs.find((g: any) => g.char === this.selectedGlyph);
      if (glyph) {
        if (this.glyphInfo) {
          this.glyphInfo.textContent = `Selected: '${glyph.char}' (${glyph.char.charCodeAt(0)})`;
        }
        if (this.positionInfo) {
          this.positionInfo.textContent = 
            `Position (logical): (${glyph.logical.x}, ${glyph.logical.y}, ${glyph.logical.width}, ${glyph.logical.height})\n` +
            `Position (pixel): (${glyph.pixel.x}, ${glyph.pixel.y}, ${glyph.pixel.width}, ${glyph.pixel.height})`;
        }
        if (this.uvInfo) {
          this.uvInfo.textContent = 
            `UV: (${glyph.uv.u1.toFixed(4)}, ${glyph.uv.v1.toFixed(4)}) → (${glyph.uv.u2.toFixed(4)}, ${glyph.uv.v2.toFixed(4)})`;
        }
        if (this.metricsInfo) {
          this.metricsInfo.textContent = 
            `Metrics: ${glyph.metrics.width}x${glyph.metrics.ascend + glyph.metrics.descend} ` +
            `(ascend: ${glyph.metrics.ascend}, descend: ${glyph.metrics.descend})`;
        }
      }
    } else {
      if (this.glyphInfo) this.glyphInfo.textContent = "Selected: -";
      if (this.positionInfo) this.positionInfo.textContent = "Position: -";
      if (this.uvInfo) this.uvInfo.textContent = "UV: -";
      if (this.metricsInfo) this.metricsInfo.textContent = "Metrics: -";
    }
  }
}
