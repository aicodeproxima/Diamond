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
  NeuralSynapseBackground: () => NeuralSynapseBackground,
  default: () => NeuralSynapseBackground
});
module.exports = __toCommonJS(index_exports);

// src/NeuralSynapseBackground.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function NeuralSynapseBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  nodeCount = 70,
  firingRange = 120,
  fireChance = 4e-3,
  hue = 195,
  interactive = true,
  maxDpr = 1.5
}) {
  const canvasRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0, h = 0, raf = 0, running = true;
    let mouse = { x: null, y: null };
    let nodes = [];
    let flashes = [];
    const build = () => {
      nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: 1.5 + Math.random() * 1.5,
          pulse: Math.random() * Math.PI * 2
        });
      }
    };
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
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    const buildZigzag = (x1, y1, x2, y2, segs = 6) => {
      const pts = [[x1, y1]];
      const dx = (x2 - x1) / segs;
      const dy = (y2 - y1) / segs;
      const perpX = -dy, perpY = dx;
      const len = Math.hypot(perpX, perpY) || 1;
      const px = perpX / len, py = perpY / len;
      for (let i = 1; i < segs; i++) {
        const jitter = (Math.random() - 0.5) * 14;
        pts.push([x1 + dx * i + px * jitter, y1 + dy * i + py * jitter]);
      }
      pts.push([x2, y2]);
      return pts;
    };
    const frame = () => {
      if (!running) return;
      ctx.fillStyle = "rgba(4, 8, 20, 0.28)";
      ctx.fillRect(0, 0, w, h);
      for (const n of nodes) {
        n.pulse += 0.04;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < firingRange) {
            let chance = fireChance * (1 - d / firingRange) * 2;
            if (mouse.x != null) {
              const ma = Math.hypot(a.x - mouse.x, a.y - mouse.y);
              const mb = Math.hypot(b.x - mouse.x, b.y - mouse.y);
              if (Math.min(ma, mb) < 140) chance *= 6;
            }
            if (Math.random() < chance) {
              flashes.push({
                pts: buildZigzag(a.x, a.y, b.x, b.y),
                life: 1
              });
            }
          }
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (const n of nodes) {
        const pulse = Math.sin(n.pulse) * 0.5 + 0.5;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14);
        grad.addColorStop(0, `hsla(${hue}, 90%, 75%, ${0.7 * pulse + 0.3})`);
        grad.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${0.9})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${f.life * 0.9})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `hsla(${hue}, 100%, 70%, ${f.life})`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k][0], f.pts[k][1]);
        ctx.stroke();
        f.life -= 0.08;
        if (f.life <= 0) flashes.splice(i, 1);
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(frame);
    };
    resize();
    build();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (interactive) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("mouseout", onLeave);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseout", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [nodeCount, firingRange, fireChance, hue, interactive, maxDpr]);
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
        background: "#040814",
        ...style
      }
    }
  );
}
//# sourceMappingURL=index.cjs.map
