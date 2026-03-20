import type { FontAtlas } from "../../../src/fontAtlas";

export class TextDebugView {
  private readonly panel: HTMLDivElement;
  private readonly toggle: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly info: HTMLDivElement;
  private visible = false;

  constructor() {
    this.panel = document.createElement("div");
    this.panel.id = "debugPanel";
    this.panel.className = "debug-panel";
    this.panel.style.display = "none";

    const header = document.createElement("div");
    header.className = "debug-header";
    const title = document.createElement("h3");
    title.textContent = "Font Atlas Debug";
    const close = document.createElement("button");
    close.textContent = "×";
    close.addEventListener("click", () => this.setVisible(false));
    header.append(title, close);

    const content = document.createElement("div");
    content.className = "debug-content";

    this.info = document.createElement("div");
    this.info.className = "debug-info";

    this.canvas = document.createElement("canvas");
    this.canvas.id = "debugCanvas";
    this.canvas.width = 560;
    this.canvas.height = 400;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create debug canvas context");
    }
    this.ctx = ctx;

    content.append(this.info, this.canvas);
    this.panel.append(header, content);
    document.body.appendChild(this.panel);

    this.toggle = document.createElement("button");
    this.toggle.id = "debugToggle";
    this.toggle.className = "debug-toggle";
    this.toggle.textContent = "Debug";
    this.toggle.addEventListener("click", () => this.setVisible(!this.visible));
    document.body.appendChild(this.toggle);
  }

  update(atlas: FontAtlas): void {
    if (!this.visible) return;

    const source = atlas.textureHandle.source as CanvasImageSource & {
      width?: number;
      height?: number;
    };

    const debug = atlas.getDebugInfo() as {
      dimensions?: { logical?: { width: number; height: number } };
      glyphCount?: number;
    };
    const width = debug.dimensions?.logical?.width ?? source.width ?? 0;
    const height = debug.dimensions?.logical?.height ?? source.height ?? 0;
    const glyphCount = debug.glyphCount ?? atlas.getGlyphCount();

    this.info.textContent = `Atlas: ${width}x${height}\nGlyphs: ${glyphCount}`;
    this.renderTexture(source);
  }

  destroy(): void {
    this.panel.remove();
    this.toggle.remove();
  }

  private setVisible(value: boolean): void {
    this.visible = value;
    this.panel.style.display = value ? "flex" : "none";
  }

  private renderTexture(source: CanvasImageSource & { width?: number; height?: number }): void {
    const w = source.width ?? 0;
    const h = source.height ?? 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!w || !h) return;

    const maxW = this.canvas.width - 20;
    const maxH = this.canvas.height - 20;
    const scale = Math.min(maxW / w, maxH / h);
    const drawW = Math.max(1, Math.floor(w * scale));
    const drawH = Math.max(1, Math.floor(h * scale));
    const x = Math.floor((this.canvas.width - drawW) / 2);
    const y = Math.floor((this.canvas.height - drawH) / 2);

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(source, x, y, drawW, drawH);
    this.ctx.strokeStyle = "rgba(120, 170, 220, 0.9)";
    this.ctx.strokeRect(x - 1, y - 1, drawW + 2, drawH + 2);
  }
}
