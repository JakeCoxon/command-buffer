export type Color = [number, number, number, number?];

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Viewport = {
  rect: Rect;
  pixelRatio: number;
};
