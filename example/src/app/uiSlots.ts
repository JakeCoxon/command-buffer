export type UiSlots = {
  canvas: HTMLCanvasElement;
  stats: HTMLDivElement;
  nav: HTMLDivElement;
  controls: HTMLDivElement;
};

function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing required element: #${id}`);
  }
  return node as T;
}

export function getUiSlots(): UiSlots {
  return {
    canvas: getElementByIdOrThrow<HTMLCanvasElement>("canvas"),
    stats: getElementByIdOrThrow<HTMLDivElement>("stats"),
    nav: getElementByIdOrThrow<HTMLDivElement>("demo-nav"),
    controls: getElementByIdOrThrow<HTMLDivElement>("demo-controls"),
  };
}
