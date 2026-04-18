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
  RainBackground: () => RainBackground,
  default: () => RainBackground
});
module.exports = __toCommonJS(index_exports);

// src/RainBackground.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function RainBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  dropCount = 400,
  mode = "rain",
  gravity = 3.6,
  windStrength = 2.2,
  color,
  interactive = true,
  maxDpr = 1.5
}) {
  const canvasRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0, h = 0, raf = 0, running = true;
    let mouse = { x: null, y: null, vx: 0, lastX: null };
    const baseColor = color || (mode === "snow" ? "#f0f5ff" : "#a8c5ff");
    const isSnow = mode === "snow";
    let drops = [];
    const build = () => {
      drops = [];
      for (let i = 0; i < dropCount; i++) {
        drops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          len: isSnow ? 2 + Math.random() * 3.5 : 8 + Math.random() * 14,
          speed: isSnow ? 0.4 + Math.random() * 0.6 : 0.8 + Math.random() * 0.6,
          opacity: 0.35 + Math.random() * 0.45,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: isSnow ? 3e-3 + Math.random() * 6e-3 : 0
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
      const x = touch.clientX - rect.left;
      mouse.vx = mouse.lastX != null ? x - mouse.lastX : 0;
      mouse.lastX = x;
      mouse.x = x;
      mouse.y = touch.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = null;
      mouse.y = null;
      mouse.vx = 0;
    };
    const frame = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        if (interactive && mouse.x != null) {
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 180) {
            const f = (1 - dist / 180) * windStrength;
            d.vx += Math.sign(dx) * f * 0.22;
            d.vx += mouse.vx * 0.02;
          }
        }
        d.vx *= 0.94;
        if (isSnow) {
          d.wobble += d.wobbleSpeed;
          d.x += d.vx + Math.sin(d.wobble) * 0.4;
          d.y += d.speed * gravity * 0.35;
        } else {
          d.x += d.vx;
          d.y += d.speed * gravity;
        }
        if (d.y > h + 10) {
          d.y = -10;
          d.x = Math.random() * w;
          d.vx *= 0.3;
        }
        if (d.x < -10) d.x = w + 10;
        if (d.x > w + 10) d.x = -10;
        if (isSnow) {
          ctx.beginPath();
          ctx.fillStyle = baseColor.startsWith("#") ? hexToRgba(baseColor, d.opacity) : baseColor;
          ctx.arc(d.x, d.y, d.len * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = baseColor.startsWith("#") ? hexToRgba(baseColor, d.opacity) : baseColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.vx * 1.2, d.y - d.len);
          ctx.stroke();
        }
      }
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
  }, [dropCount, mode, gravity, windStrength, color, interactive, maxDpr]);
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
        background: mode === "snow" ? "#0a1120" : "#0a0f1a",
        ...style
      }
    }
  );
}
function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
//# sourceMappingURL=index.cjs.map
