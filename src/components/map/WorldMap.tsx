import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { geoArea, geoCentroid, geoEqualEarth, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition' // enables selection.transition()
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { Feature, Geometry } from 'geojson'
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton, ErrorState } from '@/components/common/states'
import type { ChoroplethScale } from '@/lib/analytics/choropleth'
import { cn } from '@/lib/utils'
import { useWorldGeo, type CountryProps } from './useWorldGeo'

type CountryFeature = Feature<Geometry, CountryProps> & { id?: string }

/** Features smaller than this (steradians × 1e4) also get a dot so they stay visible and hoverable. */
const SMALL_AREA = 0.6
const MIN_K = 1
const MAX_K = 8

export interface WorldMapProps {
  /** Value per ISO3 code. Codes absent from the record render as "no data". */
  values: Record<string, number>
  scale: ChoroplethScale
  ariaLabel: string
  selectedCode?: string | null
  onSelect?: (code: string) => void
  /** Hover/focus callback so a side panel can mirror the tooltip. */
  onHover?: (code: string | null) => void
  renderTooltip?: (code: string, name: string) => ReactNode
  height?: number
  /** Show zoom / reset / fullscreen controls. */
  controls?: boolean
  className?: string
  /** Slot rendered inside the map frame (legend, search …). */
  overlay?: ReactNode
  /** When set, economies outside this set are faded (e.g. a region scope). */
  focusCodes?: Set<string>
}

/**
 * Interactive choropleth (d3-geo Equal Earth + d3-zoom). Projection paths are computed once per
 * size; zoom/pan only transforms a group, so interaction stays smooth. Borders keep a constant
 * screen width via `vector-effect`. Keyboard: +/− zoom, arrows pan, 0 resets.
 */
export function WorldMap({
  values,
  scale,
  ariaLabel,
  selectedCode,
  onSelect,
  onHover,
  renderTooltip,
  height = 520,
  controls = true,
  className,
  overlay,
  focusCodes,
}: WorldMapProps) {
  const geo = useWorldGeo()
  const frameRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(0)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hover, setHover] = useState<{ code: string; name: string; x: number; y: number } | null>(
    null,
  )
  const [fullscreen, setFullscreen] = useState(false)
  const patternId = `nodata${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Size
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Equal Earth is ~2:1 — don't leave empty bands above and below the map.
  const h = fullscreen
    ? typeof window !== 'undefined'
      ? window.innerHeight
      : height
    : width
      ? Math.min(height, Math.round(width / 1.9))
      : height

  // Projection & paths (recomputed only on size/geo change)
  const shapes = useMemo(() => {
    if (!geo.data || width === 0) return null
    const projection = geoEqualEarth().fitExtent(
      [
        [8, 8],
        [width - 8, h - 8],
      ],
      { type: 'Sphere' } as GeoPermissibleObjects,
    )
    const path = geoPath(projection)
    const features = geo.data.features as CountryFeature[]
    return {
      sphere: path({ type: 'Sphere' } as GeoPermissibleObjects) ?? '',
      items: features.map((f) => {
        const code = (f.id as string | undefined) ?? null
        const [cx, cy] = projection(geoCentroid(f)) ?? [0, 0]
        const b = path.bounds(f)
        return {
          key: code ?? `${f.properties.name}`,
          code,
          name: f.properties.name ?? 'Unknown',
          d: path(f) ?? '',
          small: geoArea(f) * 1e4 < SMALL_AREA,
          centroid: [cx, cy] as [number, number],
          bounds: b,
        }
      }),
    }
  }, [geo.data, width, h])

  // Zoom behaviour
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !shapes) return
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_K, MAX_K])
      .translateExtent([
        [0, 0],
        [width, h],
      ])
      .on('zoom', (e: { transform: ZoomTransform }) => setTransform(e.transform))
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [shapes, width, h])

  const zoomBy = useCallback((k: number) => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, k)
  }, [])
  const reset = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.transform, zoomIdentity)
  }, [])
  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (svgRef.current && zoomRef.current)
        select(svgRef.current).call(zoomRef.current.translateBy, dx / transform.k, dy / transform.k)
    },
    [transform.k],
  )

  // Zoom to the selected economy
  useEffect(() => {
    if (!selectedCode || !shapes || !svgRef.current || !zoomRef.current) return
    const item = shapes.items.find((i) => i.code === selectedCode)
    if (!item) return
    const [[x0, y0], [x1, y1]] = item.bounds
    const k = Math.max(MIN_K, Math.min(4, 0.35 / Math.max((x1 - x0) / width, (y1 - y0) / h)))
    const t = zoomIdentity
      .translate(width / 2, h / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, t)
  }, [selectedCode, shapes, width, h])

  // Fit the view to the focused economies (e.g. a region scope) when no single economy is selected.
  const focusKey = focusCodes ? [...focusCodes].sort().join(',') : ''
  useEffect(() => {
    if (!shapes || !svgRef.current || !zoomRef.current || selectedCode) return
    if (!focusKey) {
      select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
      return
    }
    const codes = new Set(focusKey.split(','))
    const items = shapes.items.filter((i) => i.code && codes.has(i.code))
    if (!items.length) return
    const x0 = Math.min(...items.map((i) => i.bounds[0][0]))
    const y0 = Math.min(...items.map((i) => i.bounds[0][1]))
    const x1 = Math.max(...items.map((i) => i.bounds[1][0]))
    const y1 = Math.max(...items.map((i) => i.bounds[1][1]))
    const k = Math.max(MIN_K, Math.min(MAX_K, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / h)))
    const t = zoomIdentity
      .translate(width / 2, h / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, t)
  }, [focusKey, shapes, width, h, selectedCode])

  const toggleFullscreen = () => {
    if (!frameRef.current) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frameRef.current.requestFullscreen?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60
    const actions: Record<string, () => void> = {
      '+': () => zoomBy(1.5),
      '=': () => zoomBy(1.5),
      '-': () => zoomBy(1 / 1.5),
      '0': reset,
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
    }
    const fn = actions[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  const enter = (code: string | null, name: string, ev: React.PointerEvent) => {
    if (!code) {
      setHover(null)
      onHover?.(null)
      return
    }
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({ code, name, x: ev.clientX - rect.left, y: ev.clientY - rect.top })
    onHover?.(code)
  }

  const leave = () => {
    setHover(null)
    onHover?.(null)
  }

  const fillFor = (code: string | null) => {
    const v = code ? values[code] : undefined
    return scale.colorFor(v) ?? `url(#${patternId})`
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative w-full overflow-hidden rounded-xl bg-card',
        fullscreen && 'rounded-none p-4',
        className,
      )}
      style={{ height: h }}
    >
      {geo.status === 'loading' && <LoadingSkeleton variant="chart" className="p-6" />}
      {geo.status === 'error' && (
        <ErrorState title="The map could not be loaded." description={geo.error ?? undefined} />
      )}
      {shapes && (
        <svg
          ref={svgRef}
          width={width}
          height={h}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="block cursor-grab touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:cursor-grabbing"
        >
          <defs>
            <pattern
              id={patternId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--missing-bg)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--missing)" strokeWidth="1" />
            </pattern>
          </defs>
          <path d={shapes.sphere} fill="var(--background)" stroke="var(--border)" />
          <g transform={transform.toString()}>
            {shapes.items.map((it) => {
              const selected = it.code !== null && it.code === selectedCode
              const hovered = hover?.code === it.code && it.code !== null
              return (
                <path
                  key={it.key}
                  data-code={it.code ?? undefined}
                  d={it.d}
                  fill={fillFor(it.code)}
                  fillOpacity={focusCodes && !(it.code && focusCodes.has(it.code)) ? 0.25 : 1}
                  stroke={selected || hovered ? 'var(--chart-highlight)' : 'var(--card)'}
                  strokeWidth={selected ? 2 : hovered ? 1.5 : 0.5}
                  vectorEffect="non-scaling-stroke"
                  className={cn(it.code && onSelect && 'cursor-pointer')}
                  onPointerMove={(e) => enter(it.code, it.name, e)}
                  onPointerLeave={leave}
                  onClick={() => it.code && onSelect?.(it.code)}
                />
              )
            })}
            {/* Dots for small economies (Singapore, Bahrain, Malta, …) */}
            {shapes.items
              .filter((it) => it.small && it.code && values[it.code] !== undefined)
              .map((it) => (
                <circle
                  key={`dot-${it.key}`}
                  cx={it.centroid[0]}
                  cy={it.centroid[1]}
                  r={3.5 / transform.k}
                  fill={fillFor(it.code)}
                  fillOpacity={focusCodes && !(it.code && focusCodes.has(it.code)) ? 0.25 : 1}
                  stroke={
                    it.code === selectedCode || hover?.code === it.code
                      ? 'var(--chart-highlight)'
                      : 'var(--foreground)'
                  }
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className={cn(onSelect && 'cursor-pointer')}
                  onPointerMove={(e) => enter(it.code, it.name, e)}
                  onPointerLeave={leave}
                  onClick={() => it.code && onSelect?.(it.code)}
                />
              ))}
          </g>
        </svg>
      )}

      {hover && renderTooltip && (
        <div
          className="glass pointer-events-none absolute z-20 w-64 rounded-xl border px-3.5 py-3 text-xs shadow-overlay"
          style={{
            left: Math.max(8, Math.min(width - 264, hover.x + 16)),
            // Flip above the pointer in the lower half so the tooltip never runs off the frame.
            ...(hover.y > h / 2
              ? { bottom: Math.max(8, h - hover.y + 16) }
              : { top: Math.max(8, hover.y + 16) }),
          }}
          role="status"
          aria-live="polite"
        >
          {renderTooltip(hover.code, hover.name)}
        </div>
      )}

      {overlay}

      {controls && shapes && (
        <div
          data-export-ignore
          className="absolute top-3 right-3 z-10 flex flex-col gap-1 print:hidden"
          role="group"
          aria-label="Map controls"
        >
          <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.5)}
          >
            <Minus />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Reset map view" onClick={reset}>
            <RotateCcw />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      )}
    </div>
  )
}
