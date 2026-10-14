import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  allTips,
  ancestors,
  headId,
  reachable,
  shortId,
  type World,
} from '../engine';

const PALETTE = [
  'var(--color-line-main)',
  'var(--color-line-1)',
  'var(--color-line-2)',
  'var(--color-line-3)',
  'var(--color-line-4)',
  'var(--color-line-5)',
];
const SLATE = 'var(--color-ink-faint)';

const X_GAP = 112;
const LANE_GAP = 72;
const PAD_X = 64;
const CHIP_H = 22;
const CHIP_STEP = 25;
const BELOW = 78;

interface Chip {
  text: string;
  kind: 'branch' | 'tag' | 'remote' | 'head';
  color: string;
  current?: boolean;
}

interface LNode {
  id: string;
  x: number;
  y: number;
  color: string;
  merge: boolean;
  local: boolean;
  isHead: boolean;
  chips: Chip[];
  hash: string;
  message: string;
}

interface LEdge {
  id: string;
  d: string;
  color: string;
}

interface Layout {
  nodes: LNode[];
  edges: LEdge[];
  width: number;
  height: number;
  lanes: number;
}

const laneOffset = (k: number) => (k === 0 ? 0 : k % 2 === 1 ? -(k + 1) / 2 : k / 2);

function edgePath(x1: number, y1: number, x2: number, y2: number, diagFirst: boolean) {
  if (y1 === y2) return `M${x1},${y1} L${x2},${y2}`;
  const dy = Math.abs(y2 - y1);
  const d = Math.min(dy, x2 - x1 - 10);
  return diagFirst ? `M${x1},${y1} L${x1 + d},${y2} L${x2},${y2}` : `M${x1},${y1} L${x2 - d},${y1} L${x2},${y2}`;
}

export function buildLayout(world: World): Layout | null {
  const r = world.repo;
  if (!r) return null;
  const commits = reachable(world, allTips(world)).reverse(); // del más antiguo al más nuevo
  if (!commits.length) return null;

  // Orden de ramas: main primero y luego por antigüedad de su punta.
  const names = Object.keys(r.branches).sort((a, b) => {
    const rank = (n: string) => (n === 'main' || n === 'master' ? -1 : (world.commits[r.branches[n]]?.seq ?? 0));
    return rank(a) - rank(b);
  });
  const colorOfBranch = new Map(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]));

  // Cada commit pertenece a la primera rama (por orden) que lo alcanza siguiendo el primer padre.
  const laneOf = new Map<string, number>();
  const laneColor: string[] = [];
  const claim = (name: string, tip: string | undefined, color: string) => {
    let id = tip;
    let lane: number | undefined;
    while (id && !laneOf.has(id) && world.commits[id]) {
      if (lane === undefined) {
        lane = laneColor.length;
        laneColor.push(color);
      }
      laneOf.set(id, lane);
      id = world.commits[id].parents[0];
    }
    void name;
  };
  for (const n of names) claim(n, r.branches[n], colorOfBranch.get(n)!);
  const hid = headId(r);
  if (hid && !laneOf.has(hid)) claim('HEAD', hid, 'var(--color-ink)');
  for (const [n, id] of Object.entries(r.tracking)) if (!laneOf.has(id)) claim(n, id, SLATE);
  for (const [n, id] of Object.entries(r.tags)) if (!laneOf.has(id)) claim(n, id, SLATE);
  // Ramas ya fusionadas y borradas: su línea sigue en la historia, con un color propio.
  let extra = names.length;
  for (const c of [...commits].reverse()) {
    if (!laneOf.has(c.id)) claim(c.id, c.id, PALETTE[extra++ % PALETTE.length]);
  }

  const laneCount = laneColor.length;
  const offsets = laneColor.map((_, k) => laneOffset(k));
  const minOff = Math.min(...offsets);
  const maxOff = Math.max(...offsets);

  // Rótulos sobre cada estación
  const chipsAt = new Map<string, Chip[]>();
  const add = (id: string, chip: Chip) => chipsAt.set(id, [...(chipsAt.get(id) ?? []), chip]);
  for (const [n, id] of Object.entries(r.tracking)) add(id, { text: n, kind: 'remote', color: SLATE });
  for (const [n, id] of Object.entries(r.tags)) add(id, { text: n, kind: 'tag', color: 'var(--color-ink-soft)' });
  for (const [n, id] of Object.entries(r.branches)) {
    add(id, {
      text: n,
      kind: 'branch',
      color: colorOfBranch.get(n)!,
      current: r.head.kind === 'branch' && r.head.name === n,
    });
  }
  if (r.head.kind === 'detached') add(r.head.id, { text: 'HEAD', kind: 'head', color: 'var(--color-ink)', current: true });
  for (const list of chipsAt.values()) list.sort((a, b) => Number(!!a.current) - Number(!!b.current));

  const maxStack = Math.max(0, ...[...chipsAt.entries()].map(([id, l]) => l.length + (id === hid ? 1 : 0)));
  const headroom = maxStack * CHIP_STEP + 18;
  const yOf = (lane: number) => headroom + (offsets[lane] - minOff) * LANE_GAP;

  const remoteReach = new Set<string>();
  const hasRemote = Object.keys(r.remotes).length > 0;
  for (const id of Object.values(r.tracking)) for (const a of ancestors(world, id)) remoteReach.add(a);

  const byId = new Map<string, LNode>();
  const nodes: LNode[] = commits.map((c, i) => {
    const lane = laneOf.get(c.id) ?? 0;
    const node: LNode = {
      id: c.id,
      x: PAD_X + i * X_GAP,
      y: yOf(lane),
      color: laneColor[lane],
      merge: c.parents.length > 1,
      local: hasRemote && !remoteReach.has(c.id),
      isHead: c.id === hid,
      chips: chipsAt.get(c.id) ?? [],
      hash: shortId(c.id),
      message: c.message.split('\n')[0],
    };
    byId.set(c.id, node);
    return node;
  });

  const edges: LEdge[] = [];
  for (const c of commits) {
    const child = byId.get(c.id)!;
    c.parents.forEach((pid, idx) => {
      const parent = byId.get(pid);
      if (!parent) return;
      edges.push({
        id: `${pid}>${c.id}`,
        d: edgePath(parent.x, parent.y, child.x, child.y, idx === 0),
        color: idx === 0 ? child.color : parent.color,
      });
    });
  }

  return {
    nodes,
    edges,
    lanes: laneCount,
    width: PAD_X * 2 + (nodes.length - 1) * X_GAP + 40,
    height: headroom + (maxOff - minOff) * LANE_GAP + BELOW,
  };
}

function trim(text: string, n: number) {
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

function ChipView({ chip, slot }: { chip: Chip; slot: number }) {
  const prefix = chip.kind === 'remote' ? '☁ ' : chip.kind === 'tag' ? '◆ ' : '';
  const label = `${prefix}${chip.text}`;
  const w = Math.max(40, label.length * 7.6 + 20);
  const filled = chip.kind === 'branch' || chip.kind === 'head';
  return (
    <g transform={`translate(0, ${-(slot * CHIP_STEP) - 26})`}>
      <rect
        x={-w / 2}
        y={-CHIP_H / 2}
        width={w}
        height={CHIP_H}
        rx={CHIP_H / 2}
        fill={filled ? chip.color : 'var(--color-card)'}
        stroke={filled ? 'none' : chip.color}
        strokeWidth={filled ? 0 : 1.8}
        strokeDasharray={chip.kind === 'remote' ? '4 3' : undefined}
      />
      <text
        textAnchor="middle"
        dy="0.36em"
        fontSize="13"
        className="sign"
        fill={filled ? '#fff' : chip.color}
        style={{ letterSpacing: '0.04em', textTransform: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export function MetroMap({ world }: { world: World }) {
  const layout = useMemo(() => buildLayout(world), [world]);
  const scroller = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  const count = layout?.nodes.length ?? 0;
  const hasLayout = layout !== null;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [count]);

  // Si hay muchas líneas y no caben en alto, el mapa se reduce un poco en vez de cortarse.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setBoxH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasLayout]);

  if (!world.repo) {
    return (
      <Empty
        title="Aquí aparecerá tu mapa"
        text="Esta carpeta todavía no es un repositorio, así que Git no está siguiendo nada. Cuando lo crees, empezará a dibujarse."
      />
    );
  }
  if (!layout) {
    return (
      <Empty
        title="Tu mapa está vacío"
        text="Cada commit que hagas será una estación. Haz el primero y la línea empezará a crecer."
      />
    );
  }

  const summary = `Mapa de commits con ${layout.nodes.length} ${layout.nodes.length === 1 ? 'estación' : 'estaciones'}.`;
  const vbW = Math.max(layout.width, 320);
  const scale = boxH > 0 ? Math.min(1, Math.max(0.62, (boxH - 6) / layout.height)) : 1;

  return (
    <div ref={scroller} className="slim-scroll flex h-full w-full overflow-auto" tabIndex={0} aria-label="Mapa de commits">
      <svg
        role="img"
        aria-label={summary}
        width={vbW * scale}
        height={layout.height * scale}
        viewBox={`0 0 ${vbW} ${layout.height}`}
        className="m-auto block shrink-0"
      >
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <AnimatePresence initial={false}>
            {layout.edges.map((e) => (
              <motion.path
                key={`${e.id}:${e.color}`}
                d={e.d}
                style={{ stroke: e.color }}
                strokeWidth={7}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>
        </g>
        <AnimatePresence initial={false}>
          {layout.nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <motion.g
                style={{ transformOrigin: '0px 0px' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.1 }}
              >
                <title>{`${n.hash} — ${n.message}${n.local ? ' (solo en tu computador)' : ''}`}</title>
                {n.isHead && (
                  <circle r={19} fill="none" style={{ stroke: 'var(--color-ink)' }} strokeWidth={2} strokeDasharray="3 4" />
                )}
                <circle
                  r={n.merge ? 12 : 10}
                  style={{ fill: 'var(--color-card)', stroke: n.color }}
                  strokeWidth={5}
                  strokeDasharray={n.local ? '5 3.5' : undefined}
                />
                {n.merge && <circle r={4.5} style={{ fill: n.color }} />}

                {n.isHead && (
                  <g transform="translate(0, -26)">
                    <path d="M-5,9 L0,15 L5,9 Z" style={{ fill: 'var(--color-ink)' }} />
                    <rect x={-45} y={-11} width={90} height={22} rx={6} style={{ fill: 'var(--color-ink)' }} />
                    <text textAnchor="middle" dy="0.36em" fontSize="12.5" className="sign" fill="#fff">
                      Estás aquí
                    </text>
                  </g>
                )}
                {n.chips.map((chip, i) => (
                  <ChipView key={chip.text + chip.kind} chip={chip} slot={i + (n.isHead ? 1 : 0)} />
                ))}

                <text y={34} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" style={{ fill: 'var(--color-ink-faint)' }}>
                  {n.hash}
                </text>
                <text y={51} textAnchor="middle" fontSize="13" style={{ fill: 'var(--color-ink)' }}>
                  {trim(n.message, 16)}
                </text>
                {n.local && (
                  <text y={67} textAnchor="middle" fontSize="11" style={{ fill: 'var(--color-ink-faint)' }}>
                    solo en tu compu
                  </text>
                )}
              </motion.g>
            </g>
          ))}
        </AnimatePresence>
      </svg>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 px-6 py-6 text-center">
      <svg width="120" height="34" viewBox="0 0 120 34" aria-hidden="true">
        <path d="M6 17h108" stroke="var(--color-rule)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />
        <circle cx="60" cy="17" r="9" fill="var(--color-card)" stroke="var(--color-rule)" strokeWidth="5" strokeDasharray="4 3" />
      </svg>
      <div>
        <p className="sign text-[17px] text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[15px] text-ink-soft">{text}</p>
      </div>
    </div>
  );
}
