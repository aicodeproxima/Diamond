# interactive-star-background

A zero-dependency React component that renders a fullscreen canvas starfield
background — twinkling ambient stars, spring-physics particles that repel from
your cursor, drifting radial orbs, and a soft mouse-follow glow. No Tailwind or
other CSS framework required. Mobile-optimized automatically.

![preview](./demo/preview.png)

## Install

From another project on the same machine:

```bash
# adjust the relative path to wherever this package lives
npm install file:../packages/interactive-star-background
```

Or add to `package.json`:

```json
{
  "dependencies": {
    "interactive-star-background": "file:../packages/interactive-star-background"
  }
}
```

## Use

```jsx
import ParticleBackground from 'interactive-star-background'

export default function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <ParticleBackground />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* your content */}
      </main>
    </div>
  )
}
```

The canvas is `position: fixed`, `pointer-events: none`, and `z-index: 0` by
default — put your content above it with `position: relative` and any `z-index`
greater than 0.

## Props

Every prop is optional. Defaults match the component as shipped.

| Prop | Type | Default | Description |
|---|---|---|---|
| `fixed` | `boolean` | `true` | Pin canvas to viewport. Set `false` to use `absolute` (fills the nearest positioned ancestor). |
| `zIndex` | `number` | `0` | Canvas stacking position. |
| `className` | `string` | `''` | Extra class names on the canvas element. |
| `style` | `object` | `{}` | Extra inline styles (merged with the base style). |
| `particleCount` | `number` | `80` desktop / `40` mobile | Override interactive particle count. |
| `starCount` | `number` | `400` desktop / `150` mobile | Override ambient star count. |
| `maxDpr` | `number` | `2` | Cap device pixel ratio on desktop. |
| `mobileMaxDpr` | `number` | `1.5` | Cap DPR on mobile for performance. |
| `mobileBreakpoint` | `number` | `768` | Viewport width below which mobile tuning applies. |
| `interactive` | `boolean` | `true` | React to mouse/touch. `false` disables all cursor interaction + the glow layer. |
| `starHueRange` | `[number, number]` | `[220, 280]` | HSL hue range for ambient stars. |
| `particleHueRange` | `[number, number]` | `[245, 285]` | HSL hue range for interactive particles. |
| `orbs` | `OrbConfig[] \| false` | auto | Custom orb config array, or `false` to disable orbs. |
| `mouseGlowHue` | `number` | `265` | Hue of the radial glow under the cursor. |
| `connections` | `boolean` | `false` | Draw connection lines between nearby particles (desktop only; O(n²) — watch perf). |

### `OrbConfig`

```ts
type OrbConfig = {
  x: number    // 0..1 normalized horizontal position
  y: number    // 0..1 normalized vertical position
  r: number    // radius in px
  hue: number  // HSL hue (0..360)
  speed: number // drift speed; ~0.0002 - 0.0005 works well
}
```

Example — purple + cyan palette with custom orbs:

```jsx
<ParticleBackground
  starHueRange={[180, 280]}
  particleHueRange={[180, 280]}
  mouseGlowHue={200}
  orbs={[
    { x: 0.2, y: 0.3, r: 180, hue: 280, speed: 0.0003 },
    { x: 0.8, y: 0.7, r: 140, hue: 190, speed: 0.0005 },
  ]}
/>
```

Minimal starfield (no interaction, smaller footprint):

```jsx
<ParticleBackground
  interactive={false}
  particleCount={0}
  orbs={false}
  starCount={200}
/>
```

## How it's structured

Three render layers composited in one `<canvas>`:

1. **Ambient stars** — ~400 points with independent twinkle sine waves + gentle
   cursor repulsion. No physics.
2. **Interactive particles** — ~80 points with a "home" position; cursor pushes
   them away within a radius, a spring force pulls them back. Damping 0.92.
3. **Orbs** — radial gradients that drift with sine/cosine over time, also
   influenced by cursor.

Plus a soft radial glow that tracks the cursor across the whole canvas.

All layers are mobile-aware (reduced counts, lower DPR cap, smaller radii,
scaled mouse influence).

## Development

```bash
cd path/to/interactive-star-background
npm install
npm run build      # writes dist/index.mjs + dist/index.cjs
npm run demo       # serves the demo folder on http://localhost:3000
```

## License

MIT — see [LICENSE](./LICENSE).
