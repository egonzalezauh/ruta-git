import { AnimatePresence, motion } from 'motion/react';
import { diffTrees, headId, headTree, shortId, statusInfo, type World } from '../engine';
import { isIgnored } from '../engine/util';
import { FileIcon } from './ui';

type Tone = 'plain' | 'new' | 'modified' | 'deleted' | 'conflict' | 'ignored' | 'staged' | 'saved';

interface Item {
  path: string;
  tone: Tone;
  label?: string;
}

const TONE: Record<Tone, { box: string; tag: string }> = {
  plain: { box: 'border-rule bg-card text-ink', tag: 'text-ink-faint' },
  new: { box: 'border-dashed border-ink-faint bg-card text-ink', tag: 'text-ink-soft' },
  modified: { box: 'border-line-3 bg-[#fff8e6] text-ink', tag: 'text-[#8a6200]' },
  deleted: { box: 'border-line-1 bg-[#fff0ea] text-ink-soft line-through', tag: 'text-line-1 no-underline' },
  conflict: { box: 'border-line-1 bg-[#fff0ea] text-ink', tag: 'text-line-1' },
  ignored: { box: 'border-rule bg-wash/60 text-ink-faint', tag: 'text-ink-faint' },
  staged: { box: 'border-line-2 bg-[#e9f8f3] text-ink', tag: 'text-line-2' },
  saved: { box: 'border-line-main/40 bg-[#eef1ff] text-ink', tag: 'text-line-main' },
};

function Column({
  title,
  hint,
  items,
  empty,
  accent,
  footer,
  onPick,
}: {
  title: string;
  hint: string;
  items: Item[];
  empty: string;
  accent: string;
  footer?: string;
  /** Si se indica, cada archivo se puede abrir en el editor. */
  onPick?: (path: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-paper/70 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0">
          <h3 className="sign truncate text-[14px] leading-tight text-ink">{title}</h3>
          <p className="truncate text-[12.5px] leading-tight text-ink-faint">{hint}</p>
        </div>
      </div>
      <ul className="flex min-h-[44px] flex-col gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((it) => (
            <motion.li
              key={it.path}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`rounded-lg border text-[13.5px] ${TONE[it.tone].box}`}
            >
              {onPick && it.tone !== 'deleted' ? (
                <button
                  type="button"
                  onClick={() => onPick(it.path)}
                  title="Abrir en el editor"
                  aria-label={`Editar ${it.path}`}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink/5"
                >
                  <FileIcon size={13} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{it.path}</span>
                  {it.label && (
                    <span className={`shrink-0 text-[11.5px] font-medium ${TONE[it.tone].tag}`}>{it.label}</span>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <FileIcon size={13} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{it.path}</span>
                  {it.label && (
                    <span className={`shrink-0 text-[11.5px] font-medium ${TONE[it.tone].tag}`}>{it.label}</span>
                  )}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {!items.length && <li className="px-1 py-1.5 text-[13px] text-ink-faint">{empty}</li>}
      </ul>
      {footer && <p className="mt-auto truncate pt-2 font-mono text-[11.5px] text-ink-faint">{footer}</p>}
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div
      className="flex shrink-0 flex-row items-center justify-center gap-2 py-0.5 text-ink-faint sm:flex-col sm:gap-1 sm:px-0.5 sm:py-0"
      aria-hidden="true"
    >
      <span className="rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</span>
      <svg className="rotate-90 sm:rotate-0" width="26" height="12" viewBox="0 0 26 12" fill="none">
        <path d="M1 6h22M18 1.5L23.5 6 18 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Zones({ world, onEdit }: { world: World; onEdit?: (path: string) => void }) {
  const r = world.repo;
  const gi = world.files['.gitignore'];
  let work: Item[] = [];
  let staged: Item[] = [];
  let saved: Item[] = [];
  let lastCommit = '';

  if (!r) {
    work = Object.keys(world.files)
      .sort()
      .map((p) => ({ path: p, tone: 'plain' as Tone, label: 'sin seguimiento' }));
  } else {
    const s = statusInfo(world);
    const paths = new Set([...Object.keys(world.files), ...Object.keys(r.index)]);
    work = [...paths].sort().map((p): Item => {
      if (s.unmerged.includes(p)) return { path: p, tone: 'conflict', label: 'conflicto' };
      if (world.files[p] === undefined) return { path: p, tone: 'deleted', label: 'borrado' };
      if (r.index[p] === undefined) {
        return isIgnored(p, gi) ? { path: p, tone: 'ignored', label: 'ignorado' } : { path: p, tone: 'new', label: 'nuevo' };
      }
      if (world.files[p] !== r.index[p]) return { path: p, tone: 'modified', label: 'cambió' };
      return { path: p, tone: 'plain' };
    });
    staged = diffTrees(headTree(world), r.index)
      .filter((c) => !s.unmerged.includes(c.path))
      .map((c) => ({
        path: c.path,
        tone: 'staged' as Tone,
        label: c.kind === 'new' ? 'nuevo' : c.kind === 'deleted' ? 'borrado' : 'cambió',
      }));
    saved = Object.keys(headTree(world))
      .sort()
      .map((p) => ({ path: p, tone: 'saved' as Tone }));
    const hid = headId(r);
    if (hid) lastCommit = `${shortId(hid)} · ${world.commits[hid].message.split('\n')[0]}`;
  }

  return (
    <div className="flex flex-col items-stretch gap-1 p-2.5 sm:flex-row">
      <Column
        title="Tu carpeta"
        hint={onEdit ? 'donde trabajas · clic para editar' : 'donde trabajas'}
        items={work}
        empty="Vacía por ahora"
        accent="var(--color-line-3)"
        onPick={onEdit}
      />
      <Connector label="git add" />
      <Column
        title="Preparados"
        hint="irán en el próximo commit"
        items={staged}
        empty="Nada preparado"
        accent="var(--color-line-2)"
      />
      <Connector label="git commit" />
      <Column
        title="Historial"
        hint="lo que ya está guardado"
        items={saved}
        empty={r ? 'Sin commits todavía' : 'Aún sin Git'}
        accent="var(--color-line-main)"
        footer={lastCommit}
      />
    </div>
  );
}
