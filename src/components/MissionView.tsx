import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Mission } from '../course/types';
import { missionWon, objectiveStatus, pendingEvent, starsFor } from '../course/runner';
import { useSimulator } from '../hooks/useSimulator';
import { PracticeArea } from './PracticeArea';
import { ArrowIcon, CheckIcon } from './ui';

const WELCOME = [
  'Terminal de la misión. Aquí no hay pistas ni autocompletado: usa lo que ya sabes.',
  'Si algo sale mal, usa "Empezar de nuevo": nada se rompe de verdad.',
];

const TOTAL_MISSIONS = 4;

function Star({ on, delay }: { on: boolean; delay: number }) {
  return (
    <motion.svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      initial={{ scale: 0, rotate: -40 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14, delay }}
      aria-hidden="true"
    >
      <path
        d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"
        fill={on ? 'var(--color-line-3)' : 'var(--color-rule)'}
        stroke={on ? '#b57d00' : 'var(--color-ink-faint)'}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

interface Props {
  mission: Mission;
  hasNext: boolean;
  nextTitle?: string;
  onComplete: (id: number, stars: number) => void;
  onNext: () => void;
  onHome: () => void;
}

export function MissionView({ mission, hasNext, nextTitle, onComplete, onNext, onHome }: Props) {
  const sim = useSimulator(mission.makeWorld, WELCOME, { hints: false });
  const { world, commands } = sim;
  const [fired, setFired] = useState<string[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const [won, setWon] = useState<{ moves: number; stars: 1 | 2 | 3 } | null>(null);
  const [focusSignal] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const moves = commands.filter((c) => c.changed && c.kind !== 'event').length;
  const status = useMemo(() => objectiveStatus(mission, world), [mission, world]);

  // Después de cada comando: ¿pasó algo inesperado? ¿ya se cumplieron los objetivos?
  useEffect(() => {
    if (won || !commands.length) return;
    const ev = pendingEvent(
      mission,
      world,
      commands.map((c) => c.input),
      fired,
    );
    if (ev) {
      sim.inject(ev.run, ev.message, ev.id);
      setFired((f) => [...f, ev.id]);
      setFeed((f) => [...f, ev.message]);
      return;
    }
    if (missionWon(mission, world)) {
      const stars = starsFor(moves, mission.par);
      setWon({ moves, stars });
      onComplete(mission.id, stars);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands]);

  useEffect(() => {
    if (won) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [won]);

  function restart() {
    sim.reset();
    setFired([]);
    setFeed([]);
    setWon(null);
  }

  const doneCount = status.filter((s) => !s.objective.bonus && s.done).length;
  const required = status.filter((s) => !s.objective.bonus).length;

  return (
    <main className="grid min-h-0 flex-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(340px,430px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <section
        aria-label="Misión"
        className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card"
      >
        <header className="border-b border-rule px-5 pt-4 pb-3.5">
          <p className="sign text-[13px] text-line-1">
            Misión {mission.id - 10} de {TOTAL_MISSIONS} · sin ayuda
          </p>
          <h1 className="display mt-1 text-[34px] text-ink sm:text-[38px]">{mission.title}</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">{mission.tagline}</p>
        </header>

        <div ref={listRef} className="slim-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[16px] leading-relaxed text-ink-soft [&_p+p]:mt-2.5">{mission.story}</div>

          <h2 className="sign mt-5 flex items-baseline justify-between text-[14px] text-ink">
            <span>Objetivos</span>
            <span className="text-[13px] text-ink-faint">
              {doneCount} de {required}
            </span>
          </h2>
          <ul className="mt-2 space-y-2">
            {status.map(({ objective: o, done }) => (
              <li
                key={o.id}
                className={`flex gap-3 rounded-xl border px-3 py-2.5 text-[15.5px] transition-colors ${
                  done ? 'border-line-2/40 bg-[#e9f8f3] text-ink' : 'border-rule bg-card text-ink-soft'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[3px] text-white"
                  style={{
                    borderColor: done ? 'var(--color-line-2)' : 'var(--color-rule)',
                    background: done ? 'var(--color-line-2)' : 'transparent',
                  }}
                >
                  {done && <CheckIcon size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  {o.bonus && <span className="sign mr-2 rounded bg-[#fff3d1] px-1.5 py-0.5 text-[11.5px] text-[#8a6200]">Extra</span>}
                  {o.text}
                  <span className="sr-only">{done ? ' (cumplido)' : ' (pendiente)'}</span>
                </span>
              </li>
            ))}
          </ul>

          {feed.length > 0 && (
            <div className="mt-5">
              <h2 className="sign text-[14px] text-line-1">Novedades</h2>
              <ul className="mt-2 space-y-2">
                {feed.map((m, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border border-line-1/40 bg-[#fff0ea] px-3 py-2.5 text-[15px] text-ink"
                  >
                    {m}
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {won && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-line-3/50 bg-[#fffaf0] p-4"
            >
              <p className="sign text-[13px] text-[#8a6200]">Misión cumplida</p>
              <div className="mt-1 flex gap-1.5">
                <Star on delay={0.1} />
                <Star on={won.stars >= 2} delay={0.25} />
                <Star on={won.stars >= 3} delay={0.4} />
              </div>
              <p className="display mt-1 text-[28px] text-ink">
                {won.stars === 3 ? '¡Impecable!' : won.stars === 2 ? '¡Muy bien!' : '¡Lo lograste!'}
              </p>
              <p className="mt-1 text-[15.5px] text-ink-soft">
                La resolviste en <b>{won.moves}</b> {won.moves === 1 ? 'movimiento' : 'movimientos'} (lo ideal son{' '}
                {mission.par}).
                {won.stars < 3 && ' Puedes repetirla para conseguir las tres estrellas.'}
              </p>
              <div className="mt-3 text-[15.5px] text-ink-soft">{mission.debrief}</div>
              <details className="mt-3 text-[15px]">
                <summary className="cursor-pointer font-medium text-line-main">Una forma de resolverla</summary>
                <ol className="mt-2 space-y-1 font-mono text-[12.5px] text-ink">
                  {mission.solution.map((c, i) => (
                    <li key={i} className="rounded bg-wash px-2 py-1">
                      {c}
                    </li>
                  ))}
                </ol>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {hasNext ? (
                  <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-line-1 px-4 py-2.5 text-[15px] font-bold text-white"
                  >
                    Siguiente: {nextTitle} <ArrowIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onHome}
                    className="inline-flex items-center gap-2 rounded-xl bg-line-1 px-4 py-2.5 text-[15px] font-bold text-white"
                  >
                    Ver el mapa del curso <ArrowIcon />
                  </button>
                )}
                <button type="button" onClick={restart} className="text-[14px] text-ink-soft underline underline-offset-4">
                  Repetir la misión
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-rule bg-paper/60 px-5 py-2.5">
          <p className="text-[13.5px] text-ink-faint" aria-live="polite">
            Movimientos: <b className="text-ink">{moves}</b> · ideal: {mission.par}
          </p>
          <div className="flex items-center gap-4">
            {!won && hasNext && (
              <button
                type="button"
                onClick={onNext}
                className="text-[13.5px] text-ink-faint underline underline-offset-4 hover:text-ink"
              >
                Saltar misión
              </button>
            )}
            <button
              type="button"
              onClick={restart}
              className="text-[13.5px] font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
            >
              Empezar de nuevo
            </button>
          </div>
        </footer>
      </section>

      <PracticeArea
        world={world}
        entries={sim.entries}
        onRun={sim.run}
        onEdit={sim.editFile}
        suggestions={[]}
        focusSignal={focusSignal}
        noHelp
      />
    </main>
  );
}
