// src/DeepSpaceBackground.jsx
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
function DeepSpaceBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  starCount = 600,
  galaxyCount = 4,
  shootingStarCount = 22,
  maxDpr = 1.5
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    let w = 0, h = 0, raf = 0, running = true;
    let stars = [];
    let galaxies = [];
    let shootingStars = [];
    const buildStars = () => {
      stars = [];
      for (let i = 0; i < starCount; i++) {
        const size = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: size < 0.7 ? 0.5 + size * 0.8 : 1.2 + size * 1.2,
          baseOpacity: 0.3 + Math.random() * 0.7,
          twinkleSpeed: 8e-4 + Math.random() * 3e-3,
          twinklePhase: Math.random() * Math.PI * 2,
          hue: 200 + Math.random() * 80
        });
      }
    };
    const buildGalaxies = () => {
      galaxies = [];
      for (let i = 0; i < galaxyCount; i++) {
        galaxies.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 140 + Math.random() * 260,
          hue: [270, 210, 320, 180][i % 4] + (Math.random() - 0.5) * 20,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 8e-5,
          tilt: 0.35 + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.04
        });
      }
    };
    const dirs = [];
    const buildDirections = () => {
      const count = Math.max(20, shootingStarCount);
      dirs.length = 0;
      for (let i = 0; i < count; i++) {
        const base = i / count * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 0.35;
        dirs.push(base + jitter);
      }
    };
    const spawnShooter = (i) => {
      const angle = dirs[i % dirs.length];
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const margin = 80;
      let x, y;
      if (cos > 0) x = -margin;
      else x = w + margin;
      if (sin > 0) y = -margin;
      else y = h + margin;
      const perpX = -sin, perpY = cos;
      const perpOffset = Math.random() * Math.max(w, h);
      x += perpX * perpOffset;
      y += perpY * perpOffset;
      const speed = 6 + Math.random() * 9;
      const hue = [40, 55, 200, 280, 0][Math.floor(Math.random() * 5)];
      return {
        x,
        y,
        vx: cos * speed,
        vy: sin * speed,
        length: 80 + Math.random() * 120,
        hue,
        alpha: 1,
        life: 1,
        // respawn delay so not every one fires at the same time
        delay: Math.random() * 400
      };
    };
    const buildShooters = () => {
      shootingStars = [];
      for (let i = 0; i < shootingStarCount; i++) {
        shootingStars.push(spawnShooter(i));
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
    const drawGalaxy = (g, t) => {
      const gradBase = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      gradBase.addColorStop(0, `hsla(${g.hue}, 85%, 60%, 0.28)`);
      gradBase.addColorStop(0.35, `hsla(${g.hue}, 80%, 50%, 0.12)`);
      gradBase.addColorStop(1, `hsla(${g.hue}, 70%, 30%, 0)`);
      ctx.fillStyle = gradBase;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      const core = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 0.25);
      core.addColorStop(0, `hsla(${g.hue + 20}, 100%, 85%, 0.65)`);
      core.addColorStop(1, `hsla(${g.hue}, 90%, 70%, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rotation);
      ctx.scale(1, g.tilt);
      for (let arm = 0; arm < 2; arm++) {
        const armAngle = arm * Math.PI;
        ctx.save();
        ctx.rotate(armAngle);
        const armGrad = ctx.createLinearGradient(0, 0, g.r, 0);
        armGrad.addColorStop(0, `hsla(${g.hue + 30}, 100%, 80%, 0.25)`);
        armGrad.addColorStop(0.5, `hsla(${g.hue}, 90%, 60%, 0.15)`);
        armGrad.addColorStop(1, `hsla(${g.hue}, 90%, 60%, 0)`);
        ctx.fillStyle = armGrad;
        ctx.beginPath();
        ctx.ellipse(g.r * 0.3, 0, g.r * 0.85, g.r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };
    const frame = (t) => {
      if (!running) return;
      ctx.fillStyle = "#02010a";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const g of galaxies) {
        g.rotation += g.rotSpeed * 16;
        g.x += g.vx;
        g.y += g.vy;
        if (g.x < -g.r) g.x = w + g.r;
        if (g.x > w + g.r) g.x = -g.r;
        if (g.y < -g.r) g.y = h + g.r;
        if (g.y > h + g.r) g.y = -g.r;
        drawGalaxy(g, t);
      }
      for (const s of stars) {
        const tw = Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.5 + 0.5;
        const a = s.baseOpacity * (0.4 + tw * 0.6);
        ctx.fillStyle = `hsla(${s.hue}, 40%, 92%, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.6) {
          const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
          sg.addColorStop(0, `hsla(${s.hue}, 80%, 90%, ${a * 0.6})`);
          sg.addColorStop(1, `hsla(${s.hue}, 80%, 90%, 0)`);
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let i = 0; i < shootingStars.length; i++) {
        const ss = shootingStars[i];
        if (ss.delay > 0) {
          ss.delay--;
          continue;
        }
        ss.x += ss.vx;
        ss.y += ss.vy;
        const tailX = ss.x - ss.vx * (ss.length / Math.hypot(ss.vx, ss.vy));
        const tailY = ss.y - ss.vy * (ss.length / Math.hypot(ss.vx, ss.vy));
        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, `hsla(${ss.hue}, 100%, 92%, ${ss.alpha})`);
        grad.addColorStop(0.3, `hsla(${ss.hue}, 100%, 75%, ${ss.alpha * 0.6})`);
        grad.addColorStop(1, `hsla(${ss.hue}, 100%, 70%, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();
        ctx.fillStyle = `hsla(${ss.hue}, 100%, 95%, ${ss.alpha})`;
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (ss.x < -200 || ss.x > w + 200 || ss.y < -200 || ss.y > h + 200) {
          shootingStars[i] = spawnShooter(i);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(frame);
    };
    resize();
    buildDirections();
    buildStars();
    buildGalaxies();
    buildShooters();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => {
      resize();
      buildStars();
      buildGalaxies();
    });
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [starCount, galaxyCount, shootingStarCount, maxDpr]);
  return /* @__PURE__ */ jsx(
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
export {
  DeepSpaceBackground,
  DeepSpaceBackground as default
};
//# sourceMappingURL=index.mjs.map
