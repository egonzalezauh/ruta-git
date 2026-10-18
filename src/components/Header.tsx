import { isReady, ROUTE } from '../course';
import { CheckIcon, LogoMark } from './ui';

interface Props {
  current: number | null;
  completed: number[];
  onGo: (id: number) => void;
  onHome: () => void;
  onCommands: () => void;
  commandsOpen: boolean;
}

const stationLabel = (id: number, kind: string) => (kind === 'mission' ? `M${id - 10}` : String(id));

export function Header({ current, completed, onGo, onHome, onCommands, commandsOpen }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule bg-card px-4 sm:px-5">
      <button type="button" onClick={onHome} className="flex shrink-0 items-center gap-2.5" aria-label="Ir al inicio">
        <LogoMark />
        <span className="display text-[27px] text-ink">
          Ruta <span className="text-line-main">Git</span>
        </span>
      </button>

      <nav aria-label="Paradas y misiones del curso" className="hidden min-w-0 flex-1 items-center md:flex">
        <ol className="mx-auto flex w-full max-w-4xl items-center">
          {ROUTE.map((c, i) => {
            const isCurrent = c.id === current;
            const isDone = completed.includes(c.id);
            const ready = isReady(c.id);
            const mission = c.kind === 'mission';
            const color = mission ? 'var(--color-line-1)' : 'var(--color-line-main)';
            const next = ROUTE[i + 1];
            const currentIdx = ROUTE.findIndex((r) => r.id === current);
            const segmentLit = isDone || (currentIdx >= 0 && i < currentIdx);
            const segmentColor = next?.kind === 'mission' ? 'var(--color-line-1)' : color;
            return (
              <li key={c.id} className="flex flex-1 items-center last:flex-none">
                <div className="group relative">
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => onGo(c.id)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`${mission ? 'Misión' : 'Parada'} ${mission ? c.id - 10 : c.id}: ${c.title}${isDone ? ' (completada)' : ''}`}
                    className="grid place-items-center rounded-full border-[4px] bg-card text-[11px] font-bold transition-transform enabled:hover:scale-110 disabled:cursor-not-allowed"
                    style={{
                      width: isCurrent ? 30 : 20,
                      height: isCurrent ? 30 : 20,
                      borderColor: ready ? color : 'var(--color-rule)',
                      borderStyle: ready ? 'solid' : 'dashed',
                      background: isDone || isCurrent ? color : 'var(--color-card)',
                      color: '#fff',
                    }}
                  >
                    {isDone ? <CheckIcon size={10} /> : isCurrent ? stationLabel(c.id, c.kind) : null}
                  </button>
                  <span
                    role="tooltip"
                    className="sign pointer-events-none absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    {mission ? `Misión ${c.id - 10}` : `Parada ${c.id}`} · {c.title}
                  </span>
                </div>
                {i < ROUTE.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="mx-1 h-[4px] flex-1 rounded-full"
                    style={{ background: segmentLit ? segmentColor : 'var(--color-rule)' }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
        <p className="sign hidden text-[13px] text-ink-soft sm:block">
          {completed.length} de {ROUTE.length} completadas
        </p>
        <button
          type="button"
          onClick={onCommands}
          aria-current={commandsOpen ? 'page' : undefined}
          className={`rounded-lg border px-3 py-1.5 text-[14px] font-medium ${
            commandsOpen ? 'border-ink bg-ink text-white' : 'border-rule text-ink hover:bg-wash'
          }`}
        >
          Comandos
        </button>
        {(current !== null || commandsOpen) && (
          <button
            type="button"
            onClick={onHome}
            className="rounded-lg border border-rule px-3 py-1.5 text-[14px] font-medium text-ink hover:bg-wash"
          >
            Mapa del curso
          </button>
        )}
      </div>
    </header>
  );
}
