import { Transform } from "./types";

function cloneTransform(t: Transform): Transform {
  return [t[0], t[1], t[2], t[3], t[4], t[5]];
}

export class TransformStack {
  private stack: Transform[];

  constructor(initialTransform: Transform = identityTransform()) {
    this.stack = [initialTransform];
  }

  pop() {
    if (this.stack.length <= 1) {
      return this.peek()!;
    }
    this.stack.pop();
    return this.peek()!;
  }

  save() {
    this.stack.push(cloneTransform(this.peek()!));
  }

  peek() {
    return this.stack[this.stack.length - 1];
  }

  size() {
    return this.stack.length;
  }

  translate(x: number, y: number) {
    const i = this.stack.length - 1;
    this.stack[i] = multiplyTransform(this.stack[i]!, translateTransform(x, y));
    return this.stack[i]!;
  }
  scale(x: number, y: number) {
    const i = this.stack.length - 1;
    this.stack[i] = multiplyTransform(this.stack[i]!, scaleTransform(x, y));
    return this.stack[i]!;
  }
  rotate(angle: number) {
    const i = this.stack.length - 1;
    this.stack[i] = multiplyTransform(this.stack[i]!, rotateTransform(angle));
    return this.stack[i]!;
  }
  reset() {
    this.stack.length = 1;
    this.stack[0] = identityTransform();
    return this.stack[0]!;
  }
}

export function multiplyTransform(
  m: Transform,
  n: Transform,
): Transform {
  const [ma, mb, mc, md, me, mf] = m;
  const [na, nb, nc, nd, ne, nf] = n;
  return [
    ma * na + mc * nb,
    mb * na + md * nb,
    ma * nc + mc * nd,
    mb * nc + md * nd,
    ma * ne + mc * nf + me,
    mb * ne + md * nf + mf,
  ];
}

export function identityTransform(): Transform {
  return [1, 0, 0, 1, 0, 0];
}

export function translateTransform(x: number, y: number): Transform {
  return [1, 0, 0, 1, x, y];
}

export function scaleTransform(x: number, y: number): Transform {
  return [x, 0, 0, y, 0, 0];
}

export function rotateTransform(angle: number): Transform {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}
