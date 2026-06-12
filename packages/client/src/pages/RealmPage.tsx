import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SQRT3, hexToPixel, hexDistance, pixelToHex, axialRound } from '../utils/hex.js';
import { api } from '../services/api.js';

interface Camera { x: number; y: number; zoom: number; }

const MIN_ZOOM       = 0.85;
const MAX_ZOOM       = 3;
const HEX_RADIUS     = 40;
const INNER_R        = HEX_RADIUS - 1;
const CENTRAL_RADIUS = 2;

// ── Region system ─────────────────────────────────────────────────────────────
type RegionId = 'CENTRAL' | 'NE' | 'NW' | 'SW' | 'SE';

const REGION_NAMES: Record<RegionId, string> = {
  CENTRAL: 'Central', NE: 'Northeast', NW: 'Northwest', SW: 'Southwest', SE: 'Southeast',
};

const REGION_OVERRIDES: Record<string, RegionId> = {
  '0,-3': 'NW', '0,-5': 'NW',
  '0,4':  'SW', '0,6':  'SW',
};

function getTileRegion(q: number, r: number): RegionId {
  const override = REGION_OVERRIDES[`${q},${r}`];
  if (override) return override;
  if (hexDistance(q, r) <= CENTRAL_RADIUS) return 'CENTRAL';
  const [wx, wy] = hexToPixel(q, r, 1);
  if (wx >= 0 && wy <= 0) return 'NE';
  if (wx <  0 && wy <= 0) return 'NW';
  if (wx <  0 && wy >  0) return 'SW';
  return 'SE';
}

// ── Hex grid ──────────────────────────────────────────────────────────────────
function hexesInMap(qMax: number, yHalfMax: number): Array<[number, number]> {
  const results: Array<[number, number]> = [];
  const rRange = yHalfMax / (HEX_RADIUS * SQRT3);
  for (let q = -qMax; q <= qMax; q++) {
    const rMin = Math.ceil(-rRange - q / 2);
    const rMax = Math.floor( rRange - q / 2);
    for (let r = rMin; r <= rMax; r++) results.push([q, r]);
  }
  return results;
}

const MAP_Q_MAX  = 11;
const MAP_Y_HALF = 420;
const ALL_HEXES  = hexesInMap(MAP_Q_MAX, MAP_Y_HALF);

const HEX_REGION = new Map<string, RegionId>(
  ALL_HEXES.map(([q, r]) => [`${q},${r}`, getTileRegion(q, r)])
);
const HEX_CENTER = new Map<string, [number, number]>(
  ALL_HEXES.map(([q, r]) => [`${q},${r}`, hexToPixel(q, r, HEX_RADIUS)])
);

const REGION_EXCHANGES = new Set<string>(['0,0', '6,-6', '-6,0', '-6,6', '6,0']);
const EXCHANGE_REGION_NAME: Record<string, string> = {
  '0,0':  'Central Exchange',
  '6,-6': 'Northeast Exchange',
  '-6,0': 'Northwest Exchange',
  '-6,6': 'Southwest Exchange',
  '6,0':  'Southeast Exchange',
};

// ── Visual constants ──────────────────────────────────────────────────────────

// Crown region base colour (rings 0–2)
const CROWN_FILL = 'rgb(44,86,50)';

// Full-brightness RGB per region — zone brightness scales these down
const REGION_RGB: Record<RegionId, [number, number, number]> = {
  CENTRAL: [44,  86,  50],  // fallback only
  NE:      [160, 80,  35],  // warm amber/rust
  NW:      [45,  105, 70],  // forest green (distinct from crown)
  SW:      [155, 125, 20],  // golden ochre
  SE:      [35,  75,  145], // deep blue
};

// Zone rings:
//   Crown    dist 0–2   safe zone, no combat
//   T2       dist 3–5   guild political points only
//   T3-T4    dist 6–9   combat gives +1 abundance tier (T4 for controlling guild)
//   T3-T5    dist 10+   combat gives +2 abundance tier (T5 for controlling guild)
const ZONE_BRIGHTNESS = { t2: 1.0, t3t4: 0.65, t3t5: 0.45 };

// Precomputed fill per hex — looked up O(1) in the draw loop
const HEX_FILL = new Map<string, string>(
  ALL_HEXES.map(([q, r]) => {
    const region = getTileRegion(q, r);
    const dist   = hexDistance(q, r);
    if (region === 'CENTRAL') return [`${q},${r}`, CROWN_FILL];
    const [R, G, B] = REGION_RGB[region];
    const b = dist <= 5 ? ZONE_BRIGHTNESS.t2 : dist <= 9 ? ZONE_BRIGHTNESS.t3t4 : ZONE_BRIGHTNESS.t3t5;
    return [`${q},${r}`, `rgb(${Math.round(R*b)},${Math.round(G*b)},${Math.round(B*b)})`];
  })
);

const REGION_LABEL_POS: Partial<Record<RegionId, [number, number]>> = {
  NE: [ 360, -200], NW: [-360, -200], SW: [-360,  200], SE: [ 360,  200],
};

const MAP_SCALE = HEX_RADIUS / 20; // 2

const VERT = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i);
  return [INNER_R * Math.cos(a), INNER_R * Math.sin(a)] as [number, number];
});
const VERT_FULL = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i);
  return [HEX_RADIUS * Math.cos(a), HEX_RADIUS * Math.sin(a)] as [number, number];
});

const NEIGHBOUR_EDGES: [number, number, number, number][] = [
  [ 1,  0, 0, 1], [ 1, -1, 5, 0], [ 0, -1, 4, 5],
  [-1,  0, 3, 4], [-1,  1, 2, 3], [ 0,  1, 1, 2],
];

const BORDER_SEGS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  for (const [q, r] of ALL_HEXES) {
    const [cx, cy] = HEX_CENTER.get(`${q},${r}`)!;
    const region   = HEX_REGION.get(`${q},${r}`)!;
    for (const [dq, dr, v1, v2] of NEIGHBOUR_EDGES) {
      const nReg = HEX_REGION.get(`${q + dq},${r + dr}`);
      if (nReg && nReg !== region) {
        out.push([
          cx + VERT_FULL[v1]![0], cy + VERT_FULL[v1]![1],
          cx + VERT_FULL[v2]![0], cy + VERT_FULL[v2]![1],
        ]);
      }
    }
  }
  return out;
})();

// ── Plot dot helpers ──────────────────────────────────────────────────────────
function dotHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DOT_SIZES = [3, 4.5, 6] as const;

// T1–T4: lightest to brightest — visually indicates plot tier
const TIER_OPACITY: Record<number, number> = { 1: 0.30, 2: 0.52, 3: 0.74, 4: 0.96 };

// District names appear only when zoomed in past the default (1.5)
const DISTRICT_NAME_ZOOM_MIN  = 1.8;
const DISTRICT_NAME_ZOOM_FULL = 2.3;
// Y offset to the bottom flat edge of the hex interior (textBaseline = 'bottom')
const DISTRICT_NAME_Y = INNER_R * Math.sin(Math.PI / 3) - 2; // ~31.8 world units

type PlotKeep = { id: string; name: string };

type PlotDot = {
  worldX: number; worldY: number;
  type: 'plot' | 'exchange';
  plotId: string; plotName: string;
  districtName: string;
  keeps: PlotKeep[];
  occupied: boolean;
  tier: 1 | 2 | 3 | 4;
  sizeVariant: 0 | 1 | 2;
};

type DistrictEntry = { name: string; total: number; occupied: number };

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cam: Camera,
  hoveredHex: [number, number] | null,
  hoveredPlotId: string | null,
  plotDots: PlotDot[],
  districtInfo: Map<string, DistrictEntry>,
) {
  const { width, height } = canvas;

  ctx.fillStyle = '#18281a';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
  ctx.scale(cam.zoom, cam.zoom);

  // ── Hex tiles ─────────────────────────────────────────────────────────────
  ctx.lineWidth = 0.5 / cam.zoom;
  for (const [q, r] of ALL_HEXES) {
    const key      = `${q},${r}`;
    const [cx, cy] = HEX_CENTER.get(key)!;
    const isHovered = hoveredHex !== null && hoveredHex[0] === q && hoveredHex[1] === r;

    ctx.beginPath();
    ctx.moveTo(cx + VERT[0]![0], cy + VERT[0]![1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(cx + VERT[i]![0], cy + VERT[i]![1]);
    ctx.closePath();

    ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.07)' : HEX_FILL.get(key)!;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  // ── Region border dashes ──────────────────────────────────────────────────
  const dash = 5 / cam.zoom;
  ctx.setLineDash([dash, dash * 0.8]);
  ctx.lineWidth   = 1.8 / cam.zoom;
  ctx.strokeStyle = 'rgba(210,190,120,0.7)';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of BORDER_SEGS) {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Region labels (outer regions) ─────────────────────────────────────────
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `${13 / cam.zoom}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle    = 'rgba(210,190,140,0.42)';
  for (const [rid, pos] of Object.entries(REGION_LABEL_POS) as [RegionId, [number, number]][]) {
    ctx.fillText(REGION_NAMES[rid], pos[0], pos[1]);
  }

  // ── District names (fade in when zoomed far enough) ───────────────────────
  if (cam.zoom >= DISTRICT_NAME_ZOOM_MIN) {
    const alpha = Math.min(1, (cam.zoom - DISTRICT_NAME_ZOOM_MIN) / (DISTRICT_NAME_ZOOM_FULL - DISTRICT_NAME_ZOOM_MIN));
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font         = `${9 / cam.zoom}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle    = `rgba(210,185,120,${alpha * 0.65})`;
    for (const [key, info] of districtInfo) {
      const center = HEX_CENTER.get(key);
      if (!center) continue;
      const [cx, cy] = center;
      ctx.fillText(info.name, cx, cy + DISTRICT_NAME_Y);
    }
  }

  // ── Plot & exchange dots ──────────────────────────────────────────────────
  for (const dot of plotDots) {
    if (dot.type === 'exchange') {
      ctx.beginPath();
      ctx.arc(dot.worldX, dot.worldY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(210,155,30,0.95)';
      ctx.fill();
    } else {
      const isHov = hoveredPlotId === dot.plotId;
      const baseR  = DOT_SIZES[dot.sizeVariant]!;
      const radius = isHov ? baseR * 1.1 : baseR;
      const a     = TIER_OPACITY[dot.tier] ?? 0.30;
      const color = dot.occupied ? `rgba(80,140,230,${a})` : `rgba(210,190,140,${a})`;

      if (isHov) {
        ctx.shadowColor = dot.occupied ? 'rgba(80,140,230,0.7)' : 'rgba(210,190,140,0.7)';
        ctx.shadowBlur  = 14 / cam.zoom;
      }
      ctx.beginPath();
      ctx.arc(dot.worldX, dot.worldY, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHov
        ? (dot.occupied ? `rgba(120,180,255,${Math.min(1, a + 0.15)})` : `rgba(240,220,170,${Math.min(1, a + 0.15)})`)
        : color;
      ctx.fill();
      if (isHov) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
    }
  }

  ctx.restore();
}

// ── Plot panel ────────────────────────────────────────────────────────────────
function PlotPanel({ dot, onClose }: { dot: PlotDot; onClose: () => void }) {
  const navigate = useNavigate();

  if (dot.type === 'exchange') {
    return (
      <Overlay onClose={onClose}>
        <PanelHeader title={dot.plotName} subtitle="Regional Exchange" onClose={onClose} />
        <PanelActions>
          <ActionButton variant="gold" onClick={() => { navigate('/exchange'); onClose(); }}>
            Visit Exchange
          </ActionButton>
        </PanelActions>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <PanelHeader title={dot.plotName} subtitle={dot.districtName} onClose={onClose} />

      {/* Traits */}
      <PanelSection label="Plot Traits">
        <p className="text-stone-600 text-xs italic">No traits recorded — coming once item chains are finalised.</p>
      </PanelSection>

      {/* Actions */}
      <PanelActions>
        {dot.keeps[0] && (
          <ActionButton variant="blue" onClick={() => { navigate(`/kingdom/${dot.keeps[0]!.id}`); onClose(); }}>
            View Keep — {dot.keeps[0].name}
          </ActionButton>
        )}
        <ActionButton variant="muted" disabled>
          Travel here — coming soon
        </ActionButton>
        {dot.keeps.length === 0 && (
          <p className="text-stone-600 text-xs text-center py-1">Empty plot — no keep founded here</p>
        )}
      </PanelActions>

      {/* Empires */}
      {dot.keeps.length > 0 && (
        <PanelSection label="Empires here">
          {dot.keeps.map(k => (
            <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-stone-800 last:border-0">
              <span className="text-parchment-200 text-xs">{k.name}</span>
              <button
                onClick={() => { navigate(`/kingdom/${k.id}`); onClose(); }}
                className="text-xs text-stone-400 hover:text-stone-200 transition-colors"
              >
                View →
              </button>
            </div>
          ))}
        </PanelSection>
      )}
    </Overlay>
  );
}

// ── Panel sub-components (modular, easy to extend) ────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-stone-900 border border-stone-700 rounded-t-xl sm:rounded-xl w-full sm:w-96 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PanelHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-stone-800">
      <div>
        <h2 className="text-parchment-100 font-semibold text-base leading-tight">{title}</h2>
        <p className="text-stone-500 text-xs mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-xl leading-none ml-4 mt-0.5 transition-colors">×</button>
    </div>
  );
}

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-stone-800">
      <h3 className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-2.5">{label}</h3>
      {children}
    </div>
  );
}

function PanelActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      {children}
    </div>
  );
}

function ActionButton({
  children, onClick, variant, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant: 'gold' | 'blue' | 'muted';
  disabled?: boolean;
}) {
  const base = 'w-full text-sm rounded px-3 py-2 transition-colors font-medium';
  const styles = {
    gold:  'bg-amber-800 hover:bg-amber-700 text-amber-100',
    blue:  'bg-blue-800 hover:bg-blue-700 text-blue-100',
    muted: 'text-stone-500 hover:text-stone-300',
  };
  return (
    <button
      className={`${base} ${styles[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RealmPage() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const camRef         = useRef<Camera>({ x: 0, y: 0, zoom: 1.5 });
  const dragRef        = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });
  const hoveredHexRef  = useRef<[number, number] | null>(null);
  const hoveredPlotRef = useRef<PlotDot | null>(null);
  const rafRef         = useRef<number>(0);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const [plotDots, setPlotDots]         = useState<PlotDot[]>([]);
  const plotDotsRef                     = useRef(plotDots);
  plotDotsRef.current                   = plotDots;

  const [districtInfo, setDistrictInfo] = useState<Map<string, DistrictEntry>>(new Map());
  const districtInfoRef                 = useRef(districtInfo);
  districtInfoRef.current               = districtInfo;

  const [selectedPlot, setSelectedPlot] = useState<PlotDot | null>(null);

  const redraw = useCallback(() => {
    if (rafRef.current !== 0) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      draw(
        ctx, canvas, camRef.current,
        hoveredHexRef.current, hoveredPlotRef.current?.plotId ?? null,
        plotDotsRef.current, districtInfoRef.current,
      );
    });
  }, []);

  useEffect(() => {
    Promise.all(['CENTRAL', 'NE', 'NW', 'SW', 'SE'].map(id => api.districts(id)))
      .then(results => {
        const districts = results.flatMap(r => r.districts);
        const dots: PlotDot[] = [];
        const info = new Map<string, DistrictEntry>();

        for (const d of districts) {
          const center = HEX_CENTER.get(`${d.q},${d.r}`);
          if (!center) continue;
          const [cx, cy] = center;

          let occupied = 0;
          for (const plot of d.plots) {
            const keeps: PlotKeep[] = (plot.keeps ?? []).map((k: { id: string; name: string }) => ({ id: k.id, name: k.name }));
            const isOccupied = keeps.length > 0;
            if (isOccupied) occupied++;
            const worldX = cx + (plot.x - d.x) * MAP_SCALE;
            const worldY = cy + (plot.y - d.y) * MAP_SCALE;
            const h = dotHash(plot.id);
            dots.push({
              worldX, worldY, type: 'plot',
              plotId: plot.id, plotName: plot.name,
              districtName: d.name,
              keeps,
              occupied: isOccupied,
              tier:        (Math.min(4, Math.max(1, plot.tier ?? 1))) as 1 | 2 | 3 | 4,
              sizeVariant: (h % 3) as 0 | 1 | 2,
            });
          }
          info.set(`${d.q},${d.r}`, { name: d.name, total: d.plots.length, occupied });
        }

        for (const [key, name] of Object.entries(EXCHANGE_REGION_NAME)) {
          const center = HEX_CENTER.get(key);
          if (!center) continue;
          const [cx, cy] = center;
          dots.push({
            worldX: cx, worldY: cy, type: 'exchange',
            plotId: `exchange-${key}`, plotName: name,
            districtName: name, keeps: [], occupied: false,
            tier: 1, sizeVariant: 1,
          });
        }

        setPlotDots(dots);
        setDistrictInfo(info);
      }).catch(() => {});
  }, []);

  useEffect(() => { redraw(); }, [plotDots, districtInfo, redraw]);

  useEffect(() => {
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
      redraw();
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();
    return () => ro.disconnect();
  }, [redraw]);

  const getWorldPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cam  = camRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left  - canvas.width  / 2 - cam.x) / cam.zoom,
      y: (clientY - rect.top   - canvas.height / 2 - cam.y) / cam.zoom,
    };
  }, []);

  const hitTestHex = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const pos = getWorldPos(clientX, clientY);
    if (!pos) return null;
    const [fq, fr] = pixelToHex(pos.x, pos.y, HEX_RADIUS);
    const [hq, hr] = axialRound(fq, fr);
    return HEX_REGION.has(`${hq},${hr}`) ? [hq, hr] : null;
  }, [getWorldPos]);

  const hitTestPlot = useCallback((clientX: number, clientY: number): PlotDot | null => {
    const pos = getWorldPos(clientX, clientY);
    if (!pos) return null;
    const hitR = Math.max(12, 8 / camRef.current.zoom);
    let closest: PlotDot | null = null;
    let closestDist = hitR;
    for (const dot of plotDotsRef.current) {
      const dist = Math.hypot(dot.worldX - pos.x, dot.worldY - pos.y);
      if (dist < closestDist) { closestDist = dist; closest = dot; }
    }
    return closest;
  }, [getWorldPos]);

  const setCursor = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isDragging = dragRef.current.active;
    const plotHit    = hitTestPlot(clientX, clientY);
    canvas.style.cursor = isDragging ? 'grabbing' : plotHit ? 'pointer' : 'grab';
  }, [hitTestPlot]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag.active) {
      camRef.current.x += e.clientX - drag.lastX;
      camRef.current.y += e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    }

    // Update hovered hex (for subtle tile tint)
    const hexHit  = hitTestHex(e.clientX, e.clientY);
    const prevHex = hoveredHexRef.current;
    const hexChanged = hexHit
      ? prevHex === null || prevHex[0] !== hexHit[0] || prevHex[1] !== hexHit[1]
      : prevHex !== null;
    hoveredHexRef.current = hexHit;

    // Update hovered plot (for glow + cursor)
    const plotHit  = drag.active ? null : hitTestPlot(e.clientX, e.clientY);
    const prevPlot = hoveredPlotRef.current;
    const plotChanged = plotHit?.plotId !== prevPlot?.plotId;
    hoveredPlotRef.current = plotHit;

    if (!drag.active) {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = plotHit ? 'pointer' : 'grab';
    }

    if (drag.active || hexChanged || plotChanged) redraw();
  }, [redraw, hitTestHex, hitTestPlot]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    dragRef.current.active = false;
    const down = mouseDownPosRef.current;
    mouseDownPosRef.current = null;
    setCursor(e.clientX, e.clientY);

    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) < 5) {
      // Plot click → open panel. District click → no action.
      const plotHit = hitTestPlot(e.clientX, e.clientY);
      if (plotHit) setSelectedPlot(plotHit);
    }
  }, [hitTestPlot, setCursor]);

  const onMouseLeave = useCallback(() => {
    hoveredHexRef.current  = null;
    hoveredPlotRef.current = null;
    dragRef.current.active  = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grab';
    redraw();
  }, [redraw]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cam    = camRef.current;
    const rect   = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left  - canvas.width  / 2;
    const mouseY = e.clientY - rect.top   - canvas.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nz     = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
    const ratio  = nz / cam.zoom;
    cam.x = mouseX + (cam.x - mouseX) * ratio;
    cam.y = mouseY + (cam.y - mouseY) * ratio;
    cam.zoom = nz;
    redraw();
  }, [redraw]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="flex items-center gap-4 px-6 py-3 border-b border-stone-800 shrink-0">
        <h1 className="text-sm font-semibold text-parchment-100">Realm Map</h1>
        <span className="text-xs text-stone-500">Scroll to zoom · Drag to pan · Click a plot</span>
      </div>
      <canvas
        ref={canvasRef}
        className="flex-1 w-full"
        style={{ display: 'block', cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      />

      {selectedPlot && (
        <PlotPanel dot={selectedPlot} onClose={() => setSelectedPlot(null)} />
      )}
    </div>
  );
}
