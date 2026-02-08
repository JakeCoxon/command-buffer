import createREGL from "regl";
import { CommandBuffer } from "../../src/commandBuffer";
import { ReglAdapter } from "../../src/reglAdapter";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const regl = createREGL({ canvas });

const commandBuffer = new CommandBuffer({
  rect: { x: 0, y: 0, w: 0, h: 0 },
  pixelRatio: window.devicePixelRatio || 1,
});

const adapter = new ReglAdapter(regl as any);

const sceneFbo = regl.framebuffer({ width: 1, height: 1 });

const drawPost = regl({
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
  attributes: {
    aPosition: [
      -1, -1,
      3, -1,
      -1, 3,
    ],
  },
  uniforms: {
    uTime: regl.prop("time"),
    uSource: regl.prop("source"),
  },
  count: 3,
  depth: { enable: false },
  blend: {
    enable: false,
  },
});

function resize() {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  commandBuffer.setViewport({
    rect: { x: 0, y: 0, w: width, h: height },
    pixelRatio,
  });

  sceneFbo.resize(Math.floor(width * pixelRatio), Math.floor(height * pixelRatio));
}

function drawFrame(time: number) {
  commandBuffer.clear([24, 24, 28, 255], 1);

  const w = window.innerWidth;
  const h = window.innerHeight;

  commandBuffer.drawRect({ x: 40, y: 40, w: 200, h: 120 }, [80, 180, 255]);
  commandBuffer.drawRoundedRect({ x: 300, y: 60, w: 200, h: 100 }, 16, [255, 180, 80]);

  const radius = 50 + Math.sin(time / 1000) * 20;
  commandBuffer.drawCircle(160, 260, radius, [255, 120, 180]);
  commandBuffer.drawLine(40, h - 60, w - 40, h - 120, 8, [120, 255, 160]);

  const frame = commandBuffer.flush();

  regl({ framebuffer: sceneFbo })(() => {
    adapter.render(frame);
  });

  regl({
    viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height },
  })(() => {
    drawPost({ time: time / 1000, source: sceneFbo });
  });

  requestAnimationFrame(drawFrame);
}

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
