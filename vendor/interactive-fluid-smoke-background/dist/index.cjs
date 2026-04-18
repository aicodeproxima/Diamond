var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  FluidSmokeBackground: () => FluidSmokeBackground,
  default: () => FluidSmokeBackground
});
module.exports = __toCommonJS(index_exports);

// src/FluidSmokeBackground.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function FluidSmokeBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  gridCols = 80,
  gridRows = 45,
  hueRange = [180, 320],
  interactive = true,
  maxDpr = 1
}) {
  const canvasRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    let w = 0, h = 0, raf = 0, running = true;
    const N = gridCols * gridRows;
    let density = new Float32Array(N);
    let vx = new Float32Array(N);
    let vy = new Float32Array(N);
    let density0 = new Float32Array(N);
    let vx0 = new Float32Array(N);
    let vy0 = new Float32Array(N);
    let hueField = new Float32Array(N);
    let mouse = { x: null, y: null, lastX: null, lastY: null };
    const idx = (x, y) => y * gridCols + x;
    const resize = () => {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      if (mouse.lastX != null) {
        const gx = Math.floor(x / w * gridCols);
        const gy = Math.floor(y / h * gridRows);
        const dvx = (x - mouse.lastX) / w * gridCols;
        const dvy = (y - mouse.lastY) / h * gridRows;
        const [h0, h1] = hueRange;
        const hueInject = h0 + Math.random() * (h1 - h0);
        for (let ry = -2; ry <= 2; ry++) {
          for (let rx = -2; rx <= 2; rx++) {
            const nx = gx + rx, ny = gy + ry;
            if (nx < 1 || nx >= gridCols - 1 || ny < 1 || ny >= gridRows - 1) continue;
            const i = idx(nx, ny);
            const fall = 1 - (Math.abs(rx) + Math.abs(ry)) / 5;
            density[i] += 0.6 * fall;
            vx[i] += dvx * 0.12 * fall;
            vy[i] += dvy * 0.12 * fall;
            hueField[i] = hueInject;
          }
        }
      }
      mouse.lastX = x;
      mouse.lastY = y;
      mouse.x = x;
      mouse.y = y;
    };
    const advect = (src, dst, vxS, vyS, dt) => {
      for (let y = 1; y < gridRows - 1; y++) {
        for (let x = 1; x < gridCols - 1; x++) {
          const i = idx(x, y);
          let px = x - dt * vxS[i];
          let py = y - dt * vyS[i];
          px = Math.max(0.5, Math.min(gridCols - 1.5, px));
          py = Math.max(0.5, Math.min(gridRows - 1.5, py));
          const x0 = Math.floor(px), x1 = x0 + 1;
          const y0 = Math.floor(py), y1 = y0 + 1;
          const sx = px - x0, sy = py - y0;
          const a = src[idx(x0, y0)] * (1 - sx) + src[idx(x1, y0)] * sx;
          const b = src[idx(x0, y1)] * (1 - sx) + src[idx(x1, y1)] * sx;
          dst[i] = a * (1 - sy) + b * sy;
        }
      }
    };
    const diffuse = (arr, factor) => {
      for (let i = 0; i < N; i++) arr[i] *= factor;
    };
    const step = (t) => {
      const dt = 1.2;
      advect(density, density0, vx, vy, dt);
      advect(vx, vx0, vx, vy, dt);
      advect(vy, vy0, vx, vy, dt);
      advect(hueField, density0, vx, vy, dt);
      let tmp = density;
      density = density0;
      density0 = tmp;
      tmp = vx;
      vx = vx0;
      vx0 = tmp;
      tmp = vy;
      vy = vy0;
      vy0 = tmp;
      diffuse(density, 0.985);
      diffuse(vx, 0.96);
      diffuse(vy, 0.96);
    };
    const render = () => {
      const cellW = w / gridCols;
      const cellH = h / gridRows;
      for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
          const i = idx(x, y);
          const dens = Math.min(1, density[i]);
          if (dens < 0.02) continue;
          const hue = hueField[i] || 260;
          ctx.fillStyle = `hsla(${hue}, 85%, ${30 + dens * 35}%, ${Math.min(1, dens * 1.1)})`;
          ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
        }
      }
    };
    const frame = (t) => {
      if (!running) return;
      ctx.fillStyle = "rgba(6, 4, 16, 0.32)";
      ctx.fillRect(0, 0, w, h);
      step(t);
      ctx.globalCompositeOperation = "lighter";
      render();
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(frame);
    };
    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (interactive) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [gridCols, gridRows, hueRange[0], hueRange[1], interactive, maxDpr]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "canvas",
    {
      ref: canvasRef,
      "aria-hidden": "true",
      className,
      style: {
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex,
        background: "#060410",
        ...style
      }
    }
  );
}
//# sourceMappingURL=index.cjs.map
