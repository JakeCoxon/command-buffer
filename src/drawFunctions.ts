import { CommandBuffer } from "./commandBuffer";
import { Color, Point, Transform } from "./types";

export type PaintOptions = {
  transform: Transform;
  fillColor?: Color;
  strokeColor?: Color;
  strokeWidth?: number;
}

export type Shape = ArcShape | RectShape | TriangleShape | QuadShape | LineSegmentShape;

export class TransformedShape {
  constructor(public shape: Shape, public transform: Transform) {
  }
}

export class PaintedShape {
  constructor(public transformedShape: TransformedShape, public paintOptions: PaintOptions) {
  }

  paint(commandBuffer: CommandBuffer) {
    this.transformedShape.shape.paint(commandBuffer, this.paintOptions);
  }
}

export class ArcShape {

  constructor(
    public x: number, public y: number, 
    public radius: number, 
    public startAngle: number = 0, 
    public endAngle: number = Math.PI * 2,
    public segments: number = 24,
  ) {
  }

  paint(commandBuffer: CommandBuffer, options: PaintOptions) {
    if (options.fillColor) fillArc(commandBuffer, options.transform, this, options);
    if (options.strokeColor) strokeArc(commandBuffer, options.transform, this, options);
  }

}

export class RectShape {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public cornerRadius: number = 0,
  ) {
  }

  paint(commandBuffer: CommandBuffer, options: PaintOptions) {
    const rounded = this.cornerRadius > 0;
    if (options.fillColor) {
      if (rounded) fillRoundedRect(commandBuffer, options.transform, this, options);
      else fillRect(commandBuffer, options.transform, this, options);
    }
    if (options.strokeColor) {
      if (rounded) strokeRoundedRect(commandBuffer, options.transform, this, options);
      else strokeRect(commandBuffer, options.transform, this, options);
    }
  }
}

export class TriangleShape {
  constructor(public x1: number, public y1: number, public x2: number, public y2: number, public x3: number, public y3: number) {
  }

  paint(commandBuffer: CommandBuffer, options: PaintOptions) {
    if (options.fillColor) fillTriangle(commandBuffer, options.transform, this, options);
    if (options.strokeColor) strokeTriangle(commandBuffer, options.transform, this, options);
  }
}

/** Corners (x1,y1) → (x2,y2) → (x3,y3) → (x4,y4) in cyclic order (e.g. TL → TR → BR → BL for an axis-aligned rect). */
export class QuadShape {
  constructor(
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
    public x3: number,
    public y3: number,
    public x4: number,
    public y4: number,
  ) {
  }

  paint(commandBuffer: CommandBuffer, options: PaintOptions) {
    if (options.fillColor) fillQuad(commandBuffer, options.transform, this, options);
    if (options.strokeColor) strokeQuad(commandBuffer, options.transform, this, options);
  }
}

export class LineSegmentShape {
  constructor(public x1: number, public y1: number, public x2: number, public y2: number) {
  }

  paint(commandBuffer: CommandBuffer, options: PaintOptions) {
    if (options.strokeColor) strokeLineSegment(commandBuffer, options.transform, this, options);
  }
}

export function fillRect(commandBuffer: CommandBuffer, transform: Transform, rect: RectShape, paint: PaintOptions) {

  const { x, y, width, height } = rect;
  const p1 = applyTransformPoint(transform, x, y);
  const p2 = applyTransformPoint(transform, x + width, y);
  const p3 = applyTransformPoint(transform, x, y + height);
  const p4 = applyTransformPoint(transform, x + width, y + height);

  // Two triangles covering the rect
  commandBuffer.appendTriangle(
    p1[0], p1[1],
    p2[0], p2[1],
    p3[0], p3[1],
    paint.fillColor!,
  );
  commandBuffer.appendTriangle(
    p3[0], p3[1],
    p2[0], p2[1],
    p4[0], p4[1],
    paint.fillColor!,
  );
}

export function strokeRect(commandBuffer: CommandBuffer, transform: Transform, rect: RectShape, paint: PaintOptions) {
  const { x, y, width, height } = rect;
  const half = paint.strokeWidth! * 0.5;
  const x0 = x;
  const x1 = x + width;
  const y0 = y;
  const y1 = y + height;

  // Four edges as thin rects made of two triangles each (top, bottom, left, right)
  const quads: [Point, Point, Point, Point][] = [
    // Top edge
    [
      [x0, y0 - half],
      [x1, y0 - half],
      [x0, y0 + half],
      [x1, y0 + half],
    ],
    // Bottom edge
    [
      [x0, y1 - half],
      [x1, y1 - half],
      [x0, y1 + half],
      [x1, y1 + half],
    ],
    // Left edge
    [
      [x0 - half, y0],
      [x0 + half, y0],
      [x0 - half, y1],
      [x0 + half, y1],
    ],
    // Right edge
    [
      [x1 - half, y0],
      [x1 + half, y0],
      [x1 - half, y1],
      [x1 + half, y1],
    ],
  ];

  quads.forEach(([q1, q2, q3, q4]) => {
    const p1 = applyTransformPoint(transform, q1[0], q1[1]);
    const p2 = applyTransformPoint(transform, q2[0], q2[1]);
    const p3 = applyTransformPoint(transform, q3[0], q3[1]);
    const p4 = applyTransformPoint(transform, q4[0], q4[1]);

    commandBuffer.appendTriangle(
      p1[0], p1[1],
      p2[0], p2[1],
      p3[0], p3[1],
      paint.strokeColor!,
    );
    commandBuffer.appendTriangle(
      p3[0], p3[1],
      p2[0], p2[1],
      p4[0], p4[1],
      paint.strokeColor!,
    );
  });
}

function appendTransformedFillRect(
  commandBuffer: CommandBuffer,
  transform: Transform,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
) {
  const p1 = applyTransformPoint(transform, x, y);
  const p2 = applyTransformPoint(transform, x + w, y);
  const p3 = applyTransformPoint(transform, x, y + h);
  const p4 = applyTransformPoint(transform, x + w, y + h);
  commandBuffer.appendTriangle(
    p1[0], p1[1],
    p2[0], p2[1],
    p3[0], p3[1],
    color,
  );
  commandBuffer.appendTriangle(
    p3[0], p3[1],
    p2[0], p2[1],
    p4[0], p4[1],
    color,
  );
}

export function fillRoundedRect(commandBuffer: CommandBuffer, transform: Transform, rect: RectShape, paint: PaintOptions, segments = 20) {
  const { x, y, width: w, height: h, cornerRadius: radius } = rect;
  const maxRadius = Math.min(w, h) / 2;
  const r = Math.min(radius, maxRadius);
  if (r <= 0) {
    fillRect(commandBuffer, transform, rect, paint);
    return;
  }

  const drawQuarter = (cx: number, cy: number, startAngle: number) => {
    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + (Math.PI / 2) * (i / segments);
      const angle2 = startAngle + (Math.PI / 2) * ((i + 1) / segments);
      const center = applyTransformPoint(transform, cx, cy);
      const p1 = applyTransformPoint(transform, cx + r * Math.cos(angle1), cy + r * Math.sin(angle1));
      const p2 = applyTransformPoint(transform, cx + r * Math.cos(angle2), cy + r * Math.sin(angle2));
      commandBuffer.appendTriangle(
        center[0], center[1],
        p1[0], p1[1],
        p2[0], p2[1],
        paint.fillColor!,
      );
    }
  };

  drawQuarter(x + r, y + r, Math.PI);
  drawQuarter(x + w - r, y + r, 1.5 * Math.PI);
  drawQuarter(x + w - r, y + h - r, 0);
  drawQuarter(x + r, y + h - r, 0.5 * Math.PI);

  appendTransformedFillRect(commandBuffer, transform, x + r, y, w - 2 * r, r, paint.fillColor!);
  appendTransformedFillRect(commandBuffer, transform, x + r, y + h - r, w - 2 * r, r, paint.fillColor!);
  appendTransformedFillRect(commandBuffer, transform, x, y + r, w, h - 2 * r, paint.fillColor!);
}

export function strokeRoundedRect(commandBuffer: CommandBuffer, transform: Transform, rect: RectShape, paint: PaintOptions, segments = 20) {
  const { x, y, width: w, height: h, cornerRadius: radius } = rect;
  const maxRadius = Math.min(w, h) / 2;
  const r = Math.min(radius, maxRadius);
  const lineWidth = paint.strokeWidth!;
  if (r <= 0) {
    strokeRect(commandBuffer, transform, rect, paint);
    return;
  }

  if (lineWidth >= r) {
    fillRoundedRect(commandBuffer, transform, rect, { transform: paint.transform, fillColor: paint.strokeColor }, segments);
    return;
  }

  const innerRadius = Math.max(0, r - lineWidth);
  const color = paint.strokeColor!;

  const drawCornerOutline = (cx: number, cy: number, startAngle: number) => {
    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + (Math.PI / 2) * (i / segments);
      const angle2 = startAngle + (Math.PI / 2) * ((i + 1) / segments);

      const outerX1 = cx + r * Math.cos(angle1);
      const outerY1 = cy + r * Math.sin(angle1);
      const outerX2 = cx + r * Math.cos(angle2);
      const outerY2 = cy + r * Math.sin(angle2);

      const innerX1 = cx + innerRadius * Math.cos(angle1);
      const innerY1 = cy + innerRadius * Math.sin(angle1);
      const innerX2 = cx + innerRadius * Math.cos(angle2);
      const innerY2 = cy + innerRadius * Math.sin(angle2);

      const o1 = applyTransformPoint(transform, outerX1, outerY1);
      const o2 = applyTransformPoint(transform, outerX2, outerY2);
      const in1 = applyTransformPoint(transform, innerX1, innerY1);
      const in2 = applyTransformPoint(transform, innerX2, innerY2);

      commandBuffer.appendTriangle(o1[0], o1[1], o2[0], o2[1], in1[0], in1[1], color);
      commandBuffer.appendTriangle(o2[0], o2[1], in2[0], in2[1], in1[0], in1[1], color);
    }
  };

  drawCornerOutline(x + r, y + r, Math.PI);
  drawCornerOutline(x + w - r, y + r, 1.5 * Math.PI);
  drawCornerOutline(x + w - r, y + h - r, 0);
  drawCornerOutline(x + r, y + h - r, 0.5 * Math.PI);

  appendTransformedFillRect(commandBuffer, transform, x + r, y, w - 2 * r, lineWidth, color);
  appendTransformedFillRect(commandBuffer, transform, x + r, y + h - lineWidth, w - 2 * r, lineWidth, color);
  appendTransformedFillRect(commandBuffer, transform, x, y + r, lineWidth, h - 2 * r, color);
  appendTransformedFillRect(commandBuffer, transform, x + w - lineWidth, y + r, lineWidth, h - 2 * r, color);
}

export function fillTriangle(commandBuffer: CommandBuffer, transform: Transform, triangle: TriangleShape, paint: PaintOptions) {
  const { x1, y1, x2, y2, x3, y3 } = triangle;
  const p1 = applyTransformPoint(transform, x1, y1);
  const p2 = applyTransformPoint(transform, x2, y2);
  const p3 = applyTransformPoint(transform, x3, y3);

  commandBuffer.appendTriangle(
    p1[0], p1[1],
    p2[0], p2[1],
    p3[0], p3[1],
    paint.fillColor!,
  );
}

export function fillQuad(commandBuffer: CommandBuffer, transform: Transform, quad: QuadShape, paint: PaintOptions) {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = quad;
  const v0 = applyTransformPoint(transform, x1, y1);
  const v1 = applyTransformPoint(transform, x2, y2);
  const v2 = applyTransformPoint(transform, x3, y3);
  const v3 = applyTransformPoint(transform, x4, y4);

  // Same diagonal split as fillRect: (v0,v1,v3) and (v3,v1,v2)
  commandBuffer.appendTriangle(
    v0[0], v0[1],
    v1[0], v1[1],
    v3[0], v3[1],
    paint.fillColor!,
  );
  commandBuffer.appendTriangle(
    v3[0], v3[1],
    v1[0], v1[1],
    v2[0], v2[1],
    paint.fillColor!,
  );
}

export function strokeLineSegment(commandBuffer: CommandBuffer, transform: Transform, lineSegment: LineSegmentShape, paint: PaintOptions) {
  const { x1, y1, x2, y2 } = lineSegment;
  const half = paint.strokeWidth! * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;

  const quad: [Point, Point, Point, Point] = [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x1 - nx, y1 - ny],
    [x2 - nx, y2 - ny],
  ];

  const [q1, q2, q3, q4] = quad;
  const p1 = applyTransformPoint(transform, q1[0], q1[1]);
  const p2 = applyTransformPoint(transform, q2[0], q2[1]);
  const p3 = applyTransformPoint(transform, q3[0], q3[1]);
  const p4 = applyTransformPoint(transform, q4[0], q4[1]);

  commandBuffer.appendTriangle(
    p1[0], p1[1],
    p2[0], p2[1],
    p3[0], p3[1],
    paint.strokeColor!,
  );
  commandBuffer.appendTriangle(
    p3[0], p3[1],
    p2[0], p2[1],
    p4[0], p4[1],
    paint.strokeColor!,
  );
}

export function strokeTriangle(commandBuffer: CommandBuffer, transform: Transform, triangle: TriangleShape, paint: PaintOptions) {
  const { x1, y1, x2, y2, x3, y3 } = triangle;
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x1, y1, x2, y2), paint);
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x2, y2, x3, y3), paint);
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x3, y3, x1, y1), paint);
}

export function strokeQuad(commandBuffer: CommandBuffer, transform: Transform, quad: QuadShape, paint: PaintOptions) {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = quad;
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x1, y1, x2, y2), paint);
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x2, y2, x3, y3), paint);
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x3, y3, x4, y4), paint);
  strokeLineSegment(commandBuffer, transform, new LineSegmentShape(x4, y4, x1, y1), paint);
}

export function applyTransformPoint(transform: Transform, x: number, y: number): Point {
  const [a, b, c, d, e, f] = transform;
  return [
    a * x + c * y + e,
    b * x + d * y + f,
  ];
}

export function fillArc(commandBuffer: CommandBuffer, transform: Transform, arc: ArcShape, paint: PaintOptions) {
  const { x, y, radius, startAngle, endAngle, segments } = arc;
  const angleRange = endAngle - startAngle;

  const center = applyTransformPoint(transform, x, y);

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;

    const a0 = startAngle + angleRange * t0;
    const a1 = startAngle + angleRange * t1;

    const p0Local: Point = [
      x + Math.cos(a0) * radius,
      y + Math.sin(a0) * radius,
    ];
    const p1Local: Point = [
      x + Math.cos(a1) * radius,
      y + Math.sin(a1) * radius,
    ];

    const p0 = applyTransformPoint(transform, p0Local[0], p0Local[1]);
    const p1 = applyTransformPoint(transform, p1Local[0], p1Local[1]);

    commandBuffer.appendTriangle(
      p0[0], p0[1],
      p1[0], p1[1],
      center[0], center[1],
      paint.fillColor!,
    );
  }
}

export function strokeArc(commandBuffer: CommandBuffer, transform: Transform, arc: ArcShape, paint: PaintOptions) {
  const { x, y, radius, startAngle, endAngle, segments } = arc;
  const strokeWidth = paint.strokeWidth!;
  const radiusOuter = radius + strokeWidth * 0.5;
  const radiusInner = Math.max(0, radius - strokeWidth * 0.5);

  const angleRange = endAngle - startAngle;

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;

    const a0 = startAngle + angleRange * t0;
    const a1 = startAngle + angleRange * t1;

    const outer0Local: Point = [
      x + Math.cos(a0) * radiusOuter,
      y + Math.sin(a0) * radiusOuter,
    ];
    const outer1Local: Point = [
      x + Math.cos(a1) * radiusOuter,
      y + Math.sin(a1) * radiusOuter,
    ];
    const inner0Local: Point = [
      x + Math.cos(a0) * radiusInner,
      y + Math.sin(a0) * radiusInner,
    ];
    const inner1Local: Point = [
      x + Math.cos(a1) * radiusInner,
      y + Math.sin(a1) * radiusInner,
    ];

    const outer0 = applyTransformPoint(transform, outer0Local[0], outer0Local[1]);
    const outer1 = applyTransformPoint(transform, outer1Local[0], outer1Local[1]);
    const inner0 = applyTransformPoint(transform, inner0Local[0], inner0Local[1]);
    const inner1 = applyTransformPoint(transform, inner1Local[0], inner1Local[1]);

    // Quad segment as two triangles: outer0-outer1-inner0 and inner0-outer1-inner1
    commandBuffer.appendTriangle(
      outer0[0], outer0[1],
      outer1[0], outer1[1],
      inner0[0], inner0[1],
      paint.strokeColor!,
    );
    commandBuffer.appendTriangle(
      inner0[0], inner0[1],
      outer1[0], outer1[1],
      inner1[0], inner1[1],
      paint.strokeColor!,
    );
  }
}