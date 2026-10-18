import { useMemo, useState } from 'react';
import { COMMAND_GROUPS, ZONES, type CommandInfo } from '../course/commands';
import { ArrowIcon } from './ui';

const SHORT = ['Carpeta', 'Preparados', 'Historial', 'Remoto'];
const X = [42, 112, 182, 252];

/** Mini mapa de los cuatro lugares: muestra por dónde viajan los cambios con este comando. */
function Flow({ c, color }: { c: CommandInfo; color: string }) {
  const moves = c.from !== undefined && c.to !== undefined && c.from !== c.to;
  const active = new Set<number>(moves ? [c.from!, c.to!] : (c.at ?? (c.from !== undefined ? [c.from] : [])));
  const dir = moves ? Math.sign(c.to! - c.from!) : 0;
  const x2 = moves ? X[c.to!] - dir * 9 : 0;

  const label = moves
    ? `Mueve cambios de ${ZONES[c.from!]} a ${ZONES[c.to!]}`
    : `Actúa sobre: ${[...active].map((i) => ZONES[i]).join(' y ')}`;

  return (
    <svg viewBox="0 0 294 50" className="w-full" role="img" aria-label={label}>
      <line x1={X[0]} x2={X[3]} y1="14" y2="14" stroke="var(--color-rule)" strokeWidth="4" strokeLinecap="round" />
      {moves && (
        <>
          <line x1={X[c.from!]} x2={X[c.to!]} y1="14" y2="14" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <path
            d={`M${x2 - dir * 7} 7 L${x2 + dir * 1} 14 L${x2 - dir * 7} 21`}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {X.map((x, i) => {
        const on = active.has(i);
        return (
          <g key={i}>
            <circle
              cx={x}
              cy="14"
              r={on ? 9 : 6}
              fill={on ? color : 'var(--color-card)'}
              stroke={on ? color : 'var(--color-rule)'}
              strokeWidth="3.5"
            />
            <text
              x={x}
              y="40"
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={on ? 700 : 500}
              fill={on ? 'var(--color-ink)' : 'var(--color-ink-faint)'}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {SHORT[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CommandCard({ c, color }: { c: CommandInfo; color: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(c.cmd)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {});
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="h-1.5" style={{ background: color }} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <button
          type="button"
          onClick={copy}
          title="Copiar comando"
          className="flex items-start justify-between gap-2 rounded-lg bg-term px-3 py-2 text-left font-mono text-[13.5px] leading-snug text-white transition-colors hover:bg-term-2"
        >
          <span className="min-w-0 break-words">
            <span className="text-white/45">$ </span>
            {c.cmd}
          </span>
          <span className="sign shrink-0 pt-0.5 text-[11px] text-white/55" aria-live="polite">
            {copied ? '¡Copiado!' : 'Copiar'}
          </span>
        </button>

        <p className="text-[16px] leading-snug font-medium text-ink">{c.what}</p>

        <div className="rounded-xl bg-paper/70 px-3 py-2.5">
          <p className="sign text-[11.5px]" style={{ color }}>
            Cuándo usarlo
          </p>
          <p className="mt-0.5 text-[14.5px] leading-snug text-ink-soft">{c.when}</p>
        </div>

        <div className="mt-auto pt-1">
          <Flow c={c} color={color} />
        </div>
      </div>
    </li>
  );
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface Props {
  onHome: () => void;
}

export function CommandsView({ onHome }: Props) {
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    return COMMAND_GROUPS.filter((g) => !only || g.id === only)
      .map((g) => ({
        ...g,
        commands: q
          ? g.commands.filter((c) => normalize(`${c.cmd} ${c.what} ${c.when}`).includes(q))
          : g.commands,
      }))
      .filter((g) => g.commands.length > 0);
  }, [query, only]);

  const total = COMMAND_GROUPS.reduce((n, g) => n + g.commands.length, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="pt-8 pb-6 sm:pt-12">
        <button
          type="button"
          onClick={onHome}
          className="sign inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"
        >
          <span className="rotate-180">
            <ArrowIcon size={13} />
          </span>
          Volver al curso
        </button>
        <p className="sign mt-5 text-[14px] text-line-main">Guía de consulta · {total} comandos</p>
        <h1 className="display mt-2 text-[52px] text-ink sm:text-[72px]">Todos los comandos, en un mapa.</h1>
        <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-ink-soft">
          Cada comando dice qué hace, cuándo conviene usarlo y por dónde viajan tus cambios. Toca uno para copiarlo.
        </p>
      </section>

      <section aria-label="Los cuatro lugares" className="rounded-3xl bg-ink px-5 py-5 text-white sm:px-7">
        <p className="sign text-[13px] text-white/60">Primero, los cuatro lugares por donde viajan tus cambios</p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Tu carpeta', 'Donde editas tus archivos de verdad.'],
            ['Preparados', 'La sala de espera: lo que entrará en el próximo guardado.'],
            ['Historial', 'Los commits ya guardados en tu computadora.'],
            ['Remoto', 'La copia en internet, como GitHub.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[20px] text-ink">
                {i + 1}
              </span>
              <div>
                <p className="text-[16px] font-bold">{t}</p>
                <p className="text-[14px] leading-snug text-white/70">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[14px] text-white/70">
          En cada tarjeta, la flecha de color muestra hacia dónde mueve cambios ese comando. Si solo hay círculos
          marcados, el comando mira o toca ese lugar sin mover nada.
        </p>
      </section>

      <div className="sticky top-0 z-10 -mx-4 mt-6 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block lg:w-72">
            <span className="sr-only">Buscar un comando</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar un comando…"
              className="w-full rounded-xl border border-rule bg-card px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-faint"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              onClick={() => setOnly(null)}
              aria-pressed={only === null}
              className={`rounded-full border-2 px-3.5 py-1 text-[14px] font-bold transition-colors ${
                only === null ? 'border-ink bg-ink text-white' : 'border-rule bg-card text-ink hover:border-ink'
              }`}
            >
              Todos
            </button>
            {COMMAND_GROUPS.map((g) => {
              const on = only === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setOnly(on ? null : g.id)}
                  aria-pressed={on}
                  className="flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1 text-[14px] font-bold transition-colors"
                  style={{
                    borderColor: on ? g.color : 'var(--color-rule)',
                    background: on ? g.color : 'var(--color-card)',
                    color: on ? '#fff' : 'var(--color-ink)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: on ? '#fff' : g.color }}
                  />
                  {g.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-10 text-center text-[17px] text-ink-soft">
          No encontré ningún comando con “{query}”. Prueba con otra palabra, como “guardar” o “subir”.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="pt-10" aria-labelledby={`g-${g.id}`}>
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="h-12 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
              <div>
                <h2 id={`g-${g.id}`} className="display text-[38px] text-ink">
                  {g.title}
                </h2>
                <p className="text-[16px] text-ink-soft">{g.tagline}</p>
              </div>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.commands.map((c) => (
                <CommandCard key={c.cmd} c={c} color={g.color} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
