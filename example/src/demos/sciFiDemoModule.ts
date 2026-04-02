import createREGL from "regl";
import { Renderer, ReglAdapter, CanvasFontAtlas, type FrameCommands } from "../../../src";
import { drawSciFiDemo, type SciFiDemoStats } from "./sciFiDemo";
import type { DemoCreateContext, DemoInstance, DemoSize } from "../app/types";

export function createSciFiDemoModule(context: DemoCreateContext): DemoInstance {
  const regl = createREGL({ canvas: context.canvas }) as any;
  const adapter = new ReglAdapter(regl as any);
  const renderer = new Renderer(adapter);

  const fontAtlas = new CanvasFontAtlas(
    "ui-monospace, monospace",
    14,
    "example-font-scifi",
    256,
    256,
    context.initialSize.pixelRatio,
    1
  );

  const sceneFbo = regl.framebuffer({ width: 1, height: 1 });
  const sciFiStats: SciFiDemoStats = {
    lastVertexCount: 0,
    lastCmdBefore: 0,
    lastCmdAfter: 0,
    lastRenderMs: 0,
  };
  const statsLines: string[] = [];
  let size = context.initialSize;

  const drawPostSciFi = regl({
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
      uniform sampler2D uSource;
      uniform float uTime;
      uniform vec2 uResolution;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise2d(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash2(i);
        float b = hash2(i + vec2(1.0, 0.0));
        float c = hash2(i + vec2(0.0, 1.0));
        float d = hash2(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      void main() {
        vec2 uv = vUv;
        float t = uTime * 60.0;
        float tFloor = floor(t);
        float tFract = fract(t);
        float glitchSeed = hash(tFloor * 1.1) + hash(tFloor * 2.3) * 0.5;
        float glitchActive = step(0.92, glitchSeed) * step(tFract, 0.08 + glitchSeed * 0.05);
        float sliceY = floor(uv.y * 24.0) / 24.0;
        float sliceId = sliceY * 100.0 + tFloor * 0.7;
        float shift = (hash(sliceId) - 0.5) * 2.0 * glitchActive;
        uv.x += shift * 0.02;
        float r = texture2D(uSource, uv + vec2(0.008 * glitchActive, 0.0)).r;
        float g = texture2D(uSource, uv).g;
        float b = texture2D(uSource, uv - vec2(0.008 * glitchActive, 0.0)).b;
        vec4 col = vec4(r, g, b, 1.0);
        float row = floor(uv.y * uResolution.y);
        float rowNoise = hash(row * 0.013 + tFloor * 7.3);
        float scanGlitch = step(0.97, rowNoise) * glitchActive;
        col.rgb = mix(col.rgb, vec3(hash2(uv + tFloor)), scanGlitch * 0.4);
        float flicker = 1.0 - step(0.98, hash(tFloor * 3.1)) * glitchActive * 0.3;
        col.rgb *= flicker;
        float luminance = dot(col.rgb, vec3(0.299, 0.587, 0.114));
        float grain = noise2d(uv * uResolution * 2.5 + uTime * 3.0);
        col.rgb += (grain - 0.5) * 0.8 * luminance;
        gl_FragColor = col;
      }
    `,
    attributes: { aPosition: [-1, -1, 3, -1, -1, 3] },
    uniforms: {
      uSource: regl.prop("source"),
      uTime: regl.prop("time"),
      uResolution: regl.prop("resolution"),
    },
    count: 3,
    depth: { enable: false },
    blend: { enable: false },
  });

  function updateStatsLines(): void {
    statsLines.length = 0;
    statsLines.push(`vertices: ${sciFiStats.lastVertexCount}`);
    statsLines.push(`commands: ${sciFiStats.lastCmdBefore} -> ${sciFiStats.lastCmdAfter}`);
    statsLines.push(`draw calls: ${adapter.getDrawCalls()}`);
    statsLines.push(`render: ${sciFiStats.lastRenderMs.toFixed(2)} ms`);
  }

  function resize(nextSize: DemoSize): void {
    size = nextSize;
    renderer.setViewport({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });
    sceneFbo.resize(Math.floor(size.width * size.pixelRatio), Math.floor(size.height * size.pixelRatio));
  }

  function render(time: number): void {
    renderer.setFontAtlas(fontAtlas);
    renderer.beginFrame({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });
    drawSciFiDemo(renderer, time, size.width, size.height, sciFiStats);

    const start = performance.now();
    let frame!: FrameCommands;
    regl({ framebuffer: sceneFbo })(() => {
      regl.clear({ color: [0, 0, 0, 1] });
      frame = renderer.endFrame();
    });
    const end = performance.now();

    sciFiStats.lastVertexCount = frame.vertices.length / 6;
    sciFiStats.lastCmdBefore = frame.rawCommandCount ?? frame.commands.length;
    sciFiStats.lastCmdAfter = adapter.getDrawCalls();
    sciFiStats.lastRenderMs = end - start;

    regl({
      viewport: { x: 0, y: 0, width: context.canvas.width, height: context.canvas.height },
    })(() => {
      drawPostSciFi({
        source: sceneFbo,
        time: time / 1000,
        resolution: [context.canvas.width, context.canvas.height],
      });
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
