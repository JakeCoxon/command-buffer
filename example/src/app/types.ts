export type DemoSize = {
  width: number;
  height: number;
  pixelRatio: number;
};

export type DemoCreateContext = {
  canvas: HTMLCanvasElement;
  controlsRoot: HTMLDivElement;
  initialSize: DemoSize;
};

export interface DemoInstance {
  render(time: number): void;
  getStatsLines?(): string[];
  onResize?(size: DemoSize): void;
  onPointerMove?(event: PointerEvent): void;
  onPointerEnter?(event: PointerEvent): void;
  onPointerLeave?(event: PointerEvent): void;
  onClick?(event: MouseEvent): void;
  onKeyDown?(event: KeyboardEvent): void;
  destroy?(): void;
}

export type DemoDefinition = {
  id: string;
  label: string;
  create(context: DemoCreateContext): DemoInstance | Promise<DemoInstance>;
};
