import { Color, Rect, Viewport } from "./types";
import { Command, FrameCommands } from "./commands";

type ColorFloats = { r: number; g: number; b: number; a: number };

export class CommandBuffer {
  private vertices: number[] = [];
  private commands: Command[] = [];
  private currentViewport: Viewport | null = null;

  constructor(private readonly defaultViewport: Viewport) {
    this.currentViewport = defaultViewport;
    this.commands.push({ type: "setViewport", viewport: defaultViewport });
  }

  reset(viewport: Viewport = this.defaultViewport) {
    this.vertices.length = 0;
    this.commands.length = 0;
    this.currentViewport = viewport;
    this.commands.push({ type: "setViewport", viewport });
  }

  clear(color: Color, alpha = 1) {
    this.commands.push({ type: "clear", color, alpha });
  }

  setViewport(viewport: Viewport) {
    this.currentViewport = viewport;
    this.commands.push({ type: "setViewport", viewport });
  }

  pushLayer(key: string, rect: Rect) {
    this.commands.push({ type: "pushLayer", key, rect });
  }

  popLayer() {
    this.commands.push({ type: "popLayer" });
  }

  flush(): FrameCommands {
    const vertices = new Float32Array(this.vertices);
    const commands = this.commands.slice();
    this.reset(this.currentViewport ?? this.defaultViewport);
    return { vertices, commands };
  }

  drawRect(rect: Rect, color: Color) {
    const { x, y, w, h } = rect;
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();

    this.appendTriangle(x, y, x + w, y, x, y + h, c);
    this.appendTriangle(x + w, y, x + w, y + h, x, y + h, c);

    this.endDraw(offset);
  }

  drawRoundedRect(rect: Rect, radius: number, color: Color, segments = 20) {
    const { x, y, w, h } = rect;
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();

    const maxRadius = Math.min(w, h) / 2;
    const r = Math.min(radius, maxRadius);

    const drawQuarter = (cx: number, cy: number, startAngle: number) => {
      for (let i = 0; i < segments; i++) {
        const angle1 = startAngle + (Math.PI / 2) * (i / segments);
        const angle2 = startAngle + (Math.PI / 2) * ((i + 1) / segments);
        this.appendTriangle(
          cx,
          cy,
          cx + r * Math.cos(angle1),
          cy + r * Math.sin(angle1),
          cx + r * Math.cos(angle2),
          cy + r * Math.sin(angle2),
          c
        );
      }
    };

    drawQuarter(x + r, y + r, Math.PI);
    drawQuarter(x + w - r, y + r, 1.5 * Math.PI);
    drawQuarter(x + w - r, y + h - r, 0);
    drawQuarter(x + r, y + h - r, 0.5 * Math.PI);

    this.appendRect(x + r, y, w - 2 * r, r, c);
    this.appendRect(x + r, y + h - r, w - 2 * r, r, c);
    this.appendRect(x, y + r, w, h - 2 * r, c);

    this.endDraw(offset);
  }

  drawCircle(x: number, y: number, radius: number, color: Color, segments = 60) {
    this.drawArc(x, y, radius, 0, Math.PI * 2, color, segments);
  }

  drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, color: Color, segments = 60) {
    const c = this.normalizeColor(color);
    const angleIncrement = (endAngle - startAngle) / segments;
    const offset = this.beginDraw();

    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + angleIncrement * i;
      const angle2 = startAngle + angleIncrement * (i + 1);
      this.appendTriangle(
        x,
        y,
        x + radius * Math.cos(angle1),
        y + radius * Math.sin(angle1),
        x + radius * Math.cos(angle2),
        y + radius * Math.sin(angle2),
        c
      );
    }

    this.endDraw(offset);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color) {
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const half = thickness / 2;

    const offsetX = half * Math.sin(angle);
    const offsetY = half * Math.cos(angle);

    const vx1 = x1 - offsetX;
    const vy1 = y1 + offsetY;
    const vx2 = x1 + offsetX;
    const vy2 = y1 - offsetY;
    const vx3 = x2 + offsetX;
    const vy3 = y2 - offsetY;
    const vx4 = x2 - offsetX;
    const vy4 = y2 + offsetY;

    this.appendTriangle(vx1, vy1, vx2, vy2, vx4, vy4, c);
    this.appendTriangle(vx2, vy2, vx3, vy3, vx4, vy4, c);

    this.endDraw(offset);
  }

  drawCircleOutline(x: number, y: number, radius: number, lineWidth: number, color: Color, segments = 60) {
    this.drawArcOutline(x, y, radius, 0, Math.PI * 2, lineWidth, color, segments);
  }

  drawArcOutline(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    lineWidth: number,
    color: Color,
    segments = 60
  ) {
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();

    // Handle edge case: if lineWidth >= radius, draw filled circle instead
    if (lineWidth >= radius) {
      this.drawArc(x, y, radius, startAngle, endAngle, color, segments);
      return;
    }

    const innerRadius = Math.max(0, radius - lineWidth);
    const angleIncrement = (endAngle - startAngle) / segments;

    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + angleIncrement * i;
      const angle2 = startAngle + angleIncrement * (i + 1);

      // Outer points
      const outerX1 = x + radius * Math.cos(angle1);
      const outerY1 = y + radius * Math.sin(angle1);
      const outerX2 = x + radius * Math.cos(angle2);
      const outerY2 = y + radius * Math.sin(angle2);

      // Inner points
      const innerX1 = x + innerRadius * Math.cos(angle1);
      const innerY1 = y + innerRadius * Math.sin(angle1);
      const innerX2 = x + innerRadius * Math.cos(angle2);
      const innerY2 = y + innerRadius * Math.sin(angle2);

      // Create quad as two triangles
      // Triangle 1: outer1, outer2, inner1
      this.appendTriangle(outerX1, outerY1, outerX2, outerY2, innerX1, innerY1, c);
      // Triangle 2: outer2, inner2, inner1
      this.appendTriangle(outerX2, outerY2, innerX2, innerY2, innerX1, innerY1, c);
    }

    this.endDraw(offset);
  }

  drawRectOutline(rect: Rect, lineWidth: number, color: Color) {
    const { x, y, w, h } = rect;
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();

    // Top edge
    this.appendRect(x, y, w, lineWidth, c);
    // Bottom edge
    this.appendRect(x, y + h - lineWidth, w, lineWidth, c);
    // Left edge (excluding corners already drawn)
    this.appendRect(x, y + lineWidth, lineWidth, h - 2 * lineWidth, c);
    // Right edge (excluding corners already drawn)
    this.appendRect(x + w - lineWidth, y + lineWidth, lineWidth, h - 2 * lineWidth, c);

    this.endDraw(offset);
  }

  drawRoundedRectOutline(rect: Rect, radius: number, lineWidth: number, color: Color, segments = 20) {
    const { x, y, w, h } = rect;
    const c = this.normalizeColor(color);
    const offset = this.beginDraw();

    const maxRadius = Math.min(w, h) / 2;
    const r = Math.min(radius, maxRadius);
    const innerRadius = Math.max(0, r - lineWidth);

    // Handle edge case: if lineWidth >= radius, draw filled rounded rect instead
    if (lineWidth >= r) {
      this.drawRoundedRect(rect, radius, color, segments);
      return;
    }

    // Draw corner arc outlines
    const drawCornerOutline = (cx: number, cy: number, startAngle: number) => {
      for (let i = 0; i < segments; i++) {
        const angle1 = startAngle + (Math.PI / 2) * (i / segments);
        const angle2 = startAngle + (Math.PI / 2) * ((i + 1) / segments);

        // Outer points
        const outerX1 = cx + r * Math.cos(angle1);
        const outerY1 = cy + r * Math.sin(angle1);
        const outerX2 = cx + r * Math.cos(angle2);
        const outerY2 = cy + r * Math.sin(angle2);

        // Inner points
        const innerX1 = cx + innerRadius * Math.cos(angle1);
        const innerY1 = cy + innerRadius * Math.sin(angle1);
        const innerX2 = cx + innerRadius * Math.cos(angle2);
        const innerY2 = cy + innerRadius * Math.sin(angle2);

        // Create quad as two triangles
        this.appendTriangle(outerX1, outerY1, outerX2, outerY2, innerX1, innerY1, c);
        this.appendTriangle(outerX2, outerY2, innerX2, innerY2, innerX1, innerY1, c);
      }
    };

    // Top-left corner
    drawCornerOutline(x + r, y + r, Math.PI);
    // Top-right corner
    drawCornerOutline(x + w - r, y + r, 1.5 * Math.PI);
    // Bottom-right corner
    drawCornerOutline(x + w - r, y + h - r, 0);
    // Bottom-left corner
    drawCornerOutline(x + r, y + h - r, 0.5 * Math.PI);

    // Top edge (between corners)
    this.appendRect(x + r, y, w - 2 * r, lineWidth, c);
    // Bottom edge (between corners)
    this.appendRect(x + r, y + h - lineWidth, w - 2 * r, lineWidth, c);
    // Left edge (between corners)
    this.appendRect(x, y + r, lineWidth, h - 2 * r, c);
    // Right edge (between corners)
    this.appendRect(x + w - lineWidth, y + r, lineWidth, h - 2 * r, c);

    this.endDraw(offset);
  }

  private appendTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    c: ColorFloats
  ) {
    this.pushVertex(x1, y1, c);
    this.pushVertex(x2, y2, c);
    this.pushVertex(x3, y3, c);
  }

  private appendRect(x: number, y: number, w: number, h: number, c: ColorFloats) {
    this.appendTriangle(x, y, x + w, y, x, y + h, c);
    this.appendTriangle(x + w, y, x + w, y + h, x, y + h, c);
  }

  private beginDraw() {
    return this.vertexCount();
  }

  private endDraw(offset: number) {
    const count = this.vertexCount() - offset;
    if (count > 0) {
      this.commands.push({ type: "drawTriangles", offset, count });
    }
  }

  private vertexCount() {
    return this.vertices.length / 6;
  }

  private pushVertex(x: number, y: number, c: ColorFloats) {
    this.vertices.push(x, y, c.r, c.g, c.b, c.a);
  }

  private normalizeColor(color: Color): ColorFloats {
    const [r, g, b, a = 255] = color;
    return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
  }
}
