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
  MatrixRainBackground: () => MatrixRainBackground,
  default: () => MatrixRainBackground
});
module.exports = __toCommonJS(index_exports);

// src/MatrixRainBackground.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function MatrixRainBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  fontSize = 18,
  hue = 140,
  glyphs,
  fadeAlpha = 0.08,
  maxDpr = 1
}) {
  const canvasRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    let w = 0, h = 0, raf = 0, running = true;
    const defaultGlyphs = "\u30A2\u30A1\u30AB\u30B5\u30BF\u30CA\u30CF\u30DE\u30E4\u30E3\u30E9\u30EF\u30AC\u30B6\u30C0\u30D0\u30D1\u30A4\u30A3\u30AD\u30B7\u30C1\u30CB\u30D2\u30DF\u30EA\u30F0\u30AE\u30B8\u30C2\u30D3\u30D4\u30A6\u30A5\u30AF\u30B9\u30C4\u30CC\u30D5\u30E0\u30E6\u30E5\u30EB\u30B0\u30BA\u30D6\u30D7\u30A8\u30A7\u30B1\u30BB\u30C6\u30CD\u30D8\u30E1\u30EC\u30F1\u30B2\u30BC\u30C7\u30D9\u30DA\u30AA\u30A9\u30B3\u30BD\u30C8\u30CE\u30DB\u30E2\u30E8\u30E7\u30ED\u30F2\u30B4\u30BE\u30C9\u30DC\u30DD0123456789ABCDEFGHJKLMNPQRSTUVWXYZ!@#$%^&*";
    const chars = (glyphs || defaultGlyphs).split("");
    let columns = [];
    const buildColumns = () => {
      const colCount = Math.ceil(w / fontSize);
      columns = [];
      for (let i = 0; i < colCount; i++) {
        columns.push({
          y: Math.random() * h,
          speed: fontSize * (0.5 + Math.random() * 1.2),
          resetThresh: 0.92 + Math.random() * 0.06
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
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      buildColumns();
    };
    const frame = () => {
      if (!running) return;
      ctx.fillStyle = `rgba(0, 5, 8, ${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = "top";
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        const x = i * fontSize;
        const ch = chars[Math.random() * chars.length | 0];
        ctx.fillStyle = `hsla(${hue}, 60%, 92%, 0.95)`;
        ctx.fillText(ch, x, c.y);
        const prevCh = chars[Math.random() * chars.length | 0];
        ctx.fillStyle = `hsla(${hue}, 90%, 55%, 0.75)`;
        ctx.fillText(prevCh, x, c.y - fontSize);
        c.y += c.speed / 6;
        if (c.y > h && Math.random() > c.resetThresh) {
          c.y = -fontSize * 2;
          c.speed = fontSize * (0.5 + Math.random() * 1.2);
        }
      }
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
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fontSize, hue, glyphs, fadeAlpha, maxDpr]);
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
        ...style
      }
    }
  );
}
//# sourceMappingURL=index.cjs.map
