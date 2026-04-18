import { useEffect, useRef } from 'react'

/**
 * Constellation — drifting dots with lines drawn between nearby neighbors.
 * Cursor pulls dots slightly toward it and brightens lines in its vicinity.
 *
 * @param {object} [props]
 * @param {number} [props.dotCount=90]
 * @param {number} [props.linkDistance=140]
 * @param {number} [props.hue=210]
 * @param {boolean} [props.interactive=true]
 */
export default function ConstellationBackground({
  fixed = true,
  zIndex = 0,
  className = '',
  style = {},
  dotCount = 90,
  linkDistance = 140,
  hue = 210,
  interactive = true,
  maxDpr = 1.5,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    let w = 0, h = 0, raf = 0, running = true
    let mouse = { x: null, y: null }

    let dots = []
    const build = () => {
      dots = []
      for (let i = 0; i < dotCount; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: 1 + Math.random() * 1.8,
        })
      }
    }

    const resize = () => {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches ? e.touches[0] : e
      mouse.x = touch.clientX - rect.left
      mouse.y = touch.clientY - rect.top
    }
    const onLeave = () => { mouse.x = null; mouse.y = null }

    const frame = () => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)

      // update dots
      for (const d of dots) {
        if (interactive && mouse.x != null) {
          const dx = mouse.x - d.x
          const dy = mouse.y - d.y
          const dist = Math.hypot(dx, dy)
          if (dist > 1 && dist < 200) {
            const f = (1 - dist / 200) * 0.015
            d.vx += (dx / dist) * f
            d.vy += (dy / dist) * f
          }
        }
        d.x += d.vx
        d.y += d.vy
        d.vx *= 0.995; d.vy *= 0.995
        if (d.x < 0 || d.x > w) d.vx *= -1
        if (d.y < 0 || d.y > h) d.vy *= -1
        d.x = Math.max(0, Math.min(w, d.x))
        d.y = Math.max(0, Math.min(h, d.y))
      }

      // lines
      ctx.lineWidth = 1
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i], b = dots[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < linkDistance) {
            const alpha = (1 - dist / linkDistance) * 0.35
            // brighten lines near cursor
            let bonus = 0
            if (mouse.x != null) {
              const mx = (a.x + b.x) * 0.5
              const my = (a.y + b.y) * 0.5
              const md = Math.hypot(mx - mouse.x, my - mouse.y)
              if (md < 180) bonus = (1 - md / 180) * 0.5
            }
            ctx.strokeStyle = `hsla(${hue}, 90%, 70%, ${alpha + bonus})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // dots
      for (const d of dots) {
        ctx.beginPath()
        ctx.fillStyle = `hsla(${hue}, 95%, 80%, 0.9)`
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      running = !document.hidden
      if (running) raf = requestAnimationFrame(frame)
    }

    resize(); build()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    if (interactive) {
      window.addEventListener('mousemove', onMove, { passive: true })
      window.addEventListener('touchmove', onMove, { passive: true })
      window.addEventListener('mouseout', onLeave)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseout', onLeave)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dotCount, linkDistance, hue, interactive, maxDpr])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
        background: '#040811',
        ...style,
      }}
    />
  )
}
