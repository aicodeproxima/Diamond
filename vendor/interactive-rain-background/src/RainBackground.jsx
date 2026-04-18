import { useEffect, useRef } from 'react'

/**
 * Rain / snow droplets — falling particles with gravity and wind.
 * Cursor acts as a wind source that pushes droplets away horizontally.
 *
 * @param {object} [props]
 * @param {number} [props.dropCount=400]
 * @param {'rain'|'snow'} [props.mode='rain']
 * @param {number} [props.gravity=3.6]      Fall speed multiplier.
 * @param {number} [props.windStrength=2.2]
 * @param {string} [props.color]           Default: rain=#a8c5ff, snow=#f0f5ff
 * @param {boolean} [props.interactive=true]
 */
export default function RainBackground({
  fixed = true,
  zIndex = 0,
  className = '',
  style = {},
  dropCount = 400,
  mode = 'rain',
  gravity = 3.6,
  windStrength = 2.2,
  color,
  interactive = true,
  maxDpr = 1.5,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    let w = 0, h = 0, raf = 0, running = true
    let mouse = { x: null, y: null, vx: 0, lastX: null }

    const baseColor = color || (mode === 'snow' ? '#f0f5ff' : '#a8c5ff')
    const isSnow = mode === 'snow'

    let drops = []
    const build = () => {
      drops = []
      for (let i = 0; i < dropCount; i++) {
        drops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          len: isSnow ? 2 + Math.random() * 3.5 : 8 + Math.random() * 14,
          speed: isSnow ? 0.4 + Math.random() * 0.6 : 0.8 + Math.random() * 0.6,
          opacity: 0.35 + Math.random() * 0.45,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: isSnow ? 0.003 + Math.random() * 0.006 : 0,
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
      const x = touch.clientX - rect.left
      mouse.vx = mouse.lastX != null ? x - mouse.lastX : 0
      mouse.lastX = x
      mouse.x = x
      mouse.y = touch.clientY - rect.top
    }
    const onLeave = () => { mouse.x = null; mouse.y = null; mouse.vx = 0 }

    const frame = (t) => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)

      for (const d of drops) {
        // wind from cursor: push away horizontally, stronger when near
        if (interactive && mouse.x != null) {
          const dx = d.x - mouse.x
          const dy = d.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < 180) {
            const f = (1 - dist / 180) * windStrength
            d.vx += Math.sign(dx) * f * 0.22
            // also give a little from cursor horizontal velocity
            d.vx += mouse.vx * 0.02
          }
        }
        d.vx *= 0.94
        if (isSnow) {
          d.wobble += d.wobbleSpeed
          d.x += d.vx + Math.sin(d.wobble) * 0.4
          d.y += d.speed * gravity * 0.35
        } else {
          d.x += d.vx
          d.y += d.speed * gravity
        }
        // wrap
        if (d.y > h + 10) { d.y = -10; d.x = Math.random() * w; d.vx *= 0.3 }
        if (d.x < -10) d.x = w + 10
        if (d.x > w + 10) d.x = -10

        if (isSnow) {
          ctx.beginPath()
          ctx.fillStyle = baseColor.startsWith('#')
            ? hexToRgba(baseColor, d.opacity)
            : baseColor
          ctx.arc(d.x, d.y, d.len * 0.5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = baseColor.startsWith('#')
            ? hexToRgba(baseColor, d.opacity)
            : baseColor
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x - d.vx * 1.2, d.y - d.len)
          ctx.stroke()
        }
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
  }, [dropCount, mode, gravity, windStrength, color, interactive, maxDpr])

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
        background: mode === 'snow' ? '#0a1120' : '#0a0f1a',
        ...style,
      }}
    />
  )
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
