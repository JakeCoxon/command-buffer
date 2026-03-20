import type { DemoDefinition, DemoInstance, DemoSize } from "./types";
import type { UiSlots } from "./uiSlots";

type DemoHostOptions = {
  slots: UiSlots;
  demos: DemoDefinition[];
  defaultDemoId: string;
};

export class DemoHost {
  private readonly slots: UiSlots;
  private readonly demos: DemoDefinition[];
  private readonly demoById: Map<string, number>;
  private readonly defaultDemoId: string;
  private activeCanvas: HTMLCanvasElement;

  private size: DemoSize = { width: 0, height: 0, pixelRatio: 1 };
  private activeDemo: DemoInstance | null = null;
  private activeDemoIndex = 0;
  private rafHandle = 0;
  private switching = false;

  private readonly navButtons: HTMLButtonElement[] = [];
  private helpVisible = false;
  private helpEl: HTMLDivElement | null = null;
  private titleEl: HTMLDivElement | null = null;

  constructor(options: DemoHostOptions) {
    this.slots = options.slots;
    this.demos = options.demos;
    this.defaultDemoId = options.defaultDemoId;
    this.demoById = new Map(options.demos.map((demo, index) => [demo.id, index]));
    this.activeCanvas = options.slots.canvas;
  }

  async start(): Promise<void> {
    if (this.demos.length === 0) {
      throw new Error("DemoHost requires at least one demo");
    }

    this.buildNavigationUi();
    this.bindEvents();
    this.resizeCanvas();

    const initialDemoId = this.readInitialDemoId();
    await this.activateDemoById(initialDemoId);
    this.rafHandle = requestAnimationFrame(this.onFrame);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafHandle);
    this.unbindEvents();
    this.teardownActiveDemo();
    this.slots.controls.replaceChildren();
  }

  private onFrame = (time: number) => {
    if (this.activeDemo) {
      this.activeDemo.render(time);
      this.updateStats();
    }
    this.rafHandle = requestAnimationFrame(this.onFrame);
  };

  private readInitialDemoId(): string {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("demo");
    if (requested && this.demoById.has(requested)) {
      return requested;
    }
    return this.defaultDemoId;
  }

  private bindEvents(): void {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    this.attachCanvasEvents();
  }

  private unbindEvents(): void {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.detachCanvasEvents();
  }

  private onResize = () => {
    this.resizeCanvas();
    if (this.activeDemo?.onResize) {
      this.activeDemo.onResize(this.size);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    this.activeDemo?.onPointerMove?.(event);
  };

  private onPointerEnter = (event: PointerEvent) => {
    this.activeDemo?.onPointerEnter?.(event);
  };

  private onPointerLeave = (event: PointerEvent) => {
    this.activeDemo?.onPointerLeave?.(event);
  };

  private onClick = (event: MouseEvent) => {
    this.activeDemo?.onClick?.(event);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.shouldIgnoreGlobalNav(event)) {
      this.activeDemo?.onKeyDown?.(event);
      return;
    }

    if (event.key === "[") {
      event.preventDefault();
      void this.activateDemoByIndex((this.activeDemoIndex - 1 + this.demos.length) % this.demos.length);
      return;
    }

    if (event.key === "]") {
      event.preventDefault();
      void this.activateDemoByIndex((this.activeDemoIndex + 1) % this.demos.length);
      return;
    }

    if (event.key >= "1" && event.key <= "9") {
      const idx = Number(event.key) - 1;
      if (idx < this.demos.length) {
        event.preventDefault();
        void this.activateDemoByIndex(idx);
        return;
      }
    }

    if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      this.helpVisible = !this.helpVisible;
      this.renderHelpVisibility();
      return;
    }

    this.activeDemo?.onKeyDown?.(event);
  };

  private shouldIgnoreGlobalNav(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
      return true;
    }
    return target.isContentEditable;
  }

  private resizeCanvas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    this.size = { width, height, pixelRatio };

    this.activeCanvas.width = Math.floor(width * pixelRatio);
    this.activeCanvas.height = Math.floor(height * pixelRatio);
    this.activeCanvas.style.width = `${width}px`;
    this.activeCanvas.style.height = `${height}px`;
  }

  private buildNavigationUi(): void {
    this.slots.nav.replaceChildren();
    this.navButtons.length = 0;

    const title = document.createElement("div");
    title.className = "demo-nav-title";
    this.titleEl = title;
    this.slots.nav.appendChild(title);

    const row = document.createElement("div");
    row.className = "demo-nav-row";

    const prev = document.createElement("button");
    prev.className = "demo-nav-btn";
    prev.textContent = "Prev [";
    prev.addEventListener("click", () => {
      void this.activateDemoByIndex((this.activeDemoIndex - 1 + this.demos.length) % this.demos.length);
    });
    row.appendChild(prev);

    const next = document.createElement("button");
    next.className = "demo-nav-btn";
    next.textContent = "] Next";
    next.addEventListener("click", () => {
      void this.activateDemoByIndex((this.activeDemoIndex + 1) % this.demos.length);
    });
    row.appendChild(next);

    const help = document.createElement("button");
    help.className = "demo-nav-btn";
    help.textContent = "Help (h)";
    help.addEventListener("click", () => {
      this.helpVisible = !this.helpVisible;
      this.renderHelpVisibility();
    });
    row.appendChild(help);

    this.slots.nav.appendChild(row);

    const list = document.createElement("div");
    list.className = "demo-nav-list";
    this.demos.forEach((demo, index) => {
      const button = document.createElement("button");
      button.className = "demo-nav-demo-btn";
      button.textContent = `${index + 1}. ${demo.label}`;
      button.addEventListener("click", () => {
        void this.activateDemoByIndex(index);
      });
      this.navButtons.push(button);
      list.appendChild(button);
    });
    this.slots.nav.appendChild(list);

    const helpEl = document.createElement("div");
    helpEl.className = "demo-help";
    helpEl.textContent = "Navigation: [ prev, ] next, 1-9 jump, h toggle help.";
    this.helpEl = helpEl;
    this.slots.nav.appendChild(helpEl);
    this.renderHelpVisibility();
  }

  private renderHelpVisibility(): void {
    if (!this.helpEl) return;
    this.helpEl.style.display = this.helpVisible ? "block" : "none";
  }

  private async activateDemoById(demoId: string): Promise<void> {
    const index = this.demoById.get(demoId) ?? this.demoById.get(this.defaultDemoId) ?? 0;
    await this.activateDemoByIndex(index);
  }

  private async activateDemoByIndex(nextIndex: number): Promise<void> {
    if (this.switching || nextIndex === this.activeDemoIndex && this.activeDemo) return;
    this.switching = true;

    this.teardownActiveDemo();
    this.slots.controls.replaceChildren();
    this.slots.stats.textContent = `Loading ${this.demos[nextIndex].label}...`;
    this.createFreshCanvas();

    const demo = this.demos[nextIndex];
    try {
      const instance = await demo.create({
        canvas: this.activeCanvas,
        controlsRoot: this.slots.controls,
        initialSize: this.size,
      });
      this.activeDemo = instance;
      this.activeDemoIndex = nextIndex;
      this.activeDemo.onResize?.(this.size);
      this.writeDemoToUrl(demo.id);
      this.updateNavSelection();
      this.updateStats();
    } finally {
      this.switching = false;
    }
  }

  private teardownActiveDemo(): void {
    if (!this.activeDemo) return;
    this.activeDemo.destroy?.();
    this.activeDemo = null;
  }

  private updateNavSelection(): void {
    const activeId = this.demos[this.activeDemoIndex]?.id;
    if (!activeId) return;
    if (this.titleEl) {
      this.titleEl.textContent = `Demo: ${this.demos[this.activeDemoIndex].label}`;
    }
    this.navButtons.forEach((btn, index) => {
      btn.classList.toggle("is-active", index === this.activeDemoIndex);
    });
  }

  private updateStats(): void {
    const demo = this.demos[this.activeDemoIndex];
    const lines = this.activeDemo?.getStatsLines?.() ?? [];
    this.slots.stats.textContent = [
      `demo: ${demo.id}`,
      ...lines,
    ].join("\n");
  }

  private writeDemoToUrl(demoId: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set("demo", demoId);
    history.replaceState({}, "", url);
  }

  private attachCanvasEvents(): void {
    this.activeCanvas.addEventListener("pointermove", this.onPointerMove);
    this.activeCanvas.addEventListener("pointerenter", this.onPointerEnter);
    this.activeCanvas.addEventListener("pointerleave", this.onPointerLeave);
    this.activeCanvas.addEventListener("click", this.onClick);
  }

  private detachCanvasEvents(): void {
    this.activeCanvas.removeEventListener("pointermove", this.onPointerMove);
    this.activeCanvas.removeEventListener("pointerenter", this.onPointerEnter);
    this.activeCanvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.activeCanvas.removeEventListener("click", this.onClick);
  }

  private createFreshCanvas(): void {
    this.detachCanvasEvents();
    const nextCanvas = document.createElement("canvas");
    nextCanvas.id = this.activeCanvas.id || "canvas";
    nextCanvas.className = this.activeCanvas.className;
    nextCanvas.style.cssText = this.activeCanvas.style.cssText;
    this.activeCanvas.replaceWith(nextCanvas);
    this.activeCanvas = nextCanvas;
    this.resizeCanvas();
    this.attachCanvasEvents();
  }
}
