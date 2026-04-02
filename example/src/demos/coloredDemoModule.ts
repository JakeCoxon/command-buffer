import createREGL from "regl";
import { Renderer, ReglAdapter, CanvasFontAtlas, type FrameCommands } from "../../../src";
import { drawColoredDemo } from "./coloredDemo";
import type { DemoCreateContext, DemoInstance, DemoSize } from "../app/types";

export function createColoredDemoModule(context: DemoCreateContext): DemoInstance {
  const regl = createREGL({ canvas: context.canvas }) as any;
  const adapter = new ReglAdapter(regl as any);
  const renderer = new Renderer(adapter);

  const fontAtlas = new CanvasFontAtlas(
    "system-ui",
    16,
    "example-font-colored",
    256,
    256,
    context.initialSize.pixelRatio,
    1
  );

  const sceneFbo = regl.framebuffer({ width: 1, height: 1 });
  const stats = {
    vertexCount: 0,
    cmdBefore: 0,
    cmdAfter: 0,
    renderMs: 0,
  };
  const statsLines: string[] = [];
  let size = context.initialSize;

  const drawPostColored = regl({
    vert: `
      precision mediump float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = 0.5 * (aPosition + 1.0);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `,
    frag: `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform sampler2D uSource;
      void main() {
        vec2 uv = vUv;
        float wave = sin(uTime + uv.y * 8.0) * 0.015;
        float swirl = sin(uTime * 0.6 + uv.x * 6.0) * 0.01;
        uv += vec2(wave, swirl);
        vec4 base = texture2D(uSource, uv);
        float vignette = smoothstep(0.9, 0.2, distance(vUv, vec2(0.5)));
        vec3 tint = vec3(0.06, 0.2, 0.45) + 0.2 * vec3(
          sin(uTime + vUv.x * 6.2831),
          sin(uTime * 0.8 + vUv.y * 5.5),
          sin(uTime * 1.2 + vUv.x * 4.2)
        );
        vec3 warped = base.rgb * (0.9 + 0.1 * sin(uTime + uv.x * 12.0));
        vec3 color = mix(warped, warped + tint, vignette * 0.6);
        gl_FragColor = vec4(color, base.a);
      }
    `,
    attributes: { aPosition: [-1, -1, 3, -1, -1, 3] },
    uniforms: {
      uTime: regl.prop("time"),
      uSource: regl.prop("source"),
    },
    count: 3,
    depth: { enable: false },
    blend: { enable: false },
  });

  function updateStatsLines(): void {
    statsLines.length = 0;
    statsLines.push(`vertices: ${stats.vertexCount}`);
    statsLines.push(`commands: ${stats.cmdBefore} -> ${stats.cmdAfter}`);
    statsLines.push(`draw calls: ${adapter.getDrawCalls()}`);
    statsLines.push(`render: ${stats.renderMs.toFixed(2)} ms`);
  }

  function resize(nextSize: DemoSize): void {
    size = nextSize;
    sceneFbo.resize(Math.floor(size.width * size.pixelRatio), Math.floor(size.height * size.pixelRatio));
  }

  function render(time: number): void {
    regl.clear({ color: [0, 0, 0, 1] });
    renderer.setFontAtlas(fontAtlas);
    renderer.beginFrame({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });
    drawColoredDemo(renderer, time, size.width, size.height);

    const start = performance.now();
    let frame!: FrameCommands;
    regl({ framebuffer: sceneFbo })(() => {
      frame = renderer.endFrame();
    });
    const end = performance.now();

    stats.vertexCount = frame.vertices.length / 6;
    stats.cmdBefore = frame.rawCommandCount ?? frame.commands.length;
    stats.cmdAfter = adapter.getDrawCalls();
    stats.renderMs = end - start;

    regl({
      viewport: { x: 0, y: 0, width: context.canvas.width, height: context.canvas.height },
    })(() => {
      drawPostColored({ time: time / 1000, source: sceneFbo });
    });

    updateStatsLines();
  }

  resize(context.initialSize);
  updateStatsLines();

  return {
    render,
    onResize: resize,
    getStatsLines: () => statsLines,
    destroy: () => {
      sceneFbo.destroy?.();
      if (typeof regl.destroy === "function") {
        regl.destroy();
      }
    },
  };
}
