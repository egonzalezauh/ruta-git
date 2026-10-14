import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Chapter } from '../course/types';
import { makeCtx, stepPassed } from '../course/runner';
import { useSimulator } from '../hooks/useSimulator';
import { PracticeArea } from './PracticeArea';
import { ArrowIcon, CheckIcon } from './ui';

const WELCOME = [
  'Terminal de práctica. Aquí no puedes romper nada: si algo sale mal, usa "Empezar de nuevo".',
  'Los comandos son los de Git de verdad; la terminal te responde en español.',
  'Escribe "help" para ver los comandos disponibles.',
];

interface Props {
  chapter: Chapter;
  hasNext: boolean;
  nextTitle?: string;
  onComplete: (id: number) => void;
  onNext: () => void;
  onHome: () => void;
}

export function LessonView({ chapter, hasNext, nextTitle, onComplete, onNext, onHome }: Props) {
  const sim = useSimulator(chapter.makeWorld, WELCOME);
  const { world, commands } = sim;
  const [active, setActive] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [fired, setFired] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [hintFor, setHintFor] = useState<number | null>(null);
  const start = useRef({ world, cmd: 0 });
  const activeRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const steps = chapter.steps;
  const step = steps[active];
  const stepDone = done.includes(active);

  // Comprueba si lo que acaba de hacer la persona cumple el objetivo del paso.
  useEffect(() => {
    if (!step?.check || stepDone) return;
    const since = commands.slice(start.current.cmd);
    if (!since.length) return;
    if (stepPassed(step, makeCtx(world, start.current.world, since))) {
      setDone((d) => (d.includes(active) ? d : [...d, active]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands]);

  // Mantiene visible el paso actual dentro de la lista, sin mover toda la página.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (finished) {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
      return;
    }
    const el = activeRef.current;
    if (el) list.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: 'smooth' });
  }, [active, finished]);

  const suggestions = useMemo(() => {
    if (!step || stepDone || finished) return [];
    return typeof step.suggest === 'function' ? step.suggest(world) : (step.suggest ?? []);
  }, [step, stepDone, finished, world]);

  function advance() {
    if (active + 1 >= steps.length) {
      setFinished(true);
      onComplete(chapter.id);
      return;
    }
    const next = steps[active + 1];
    let w = world;
    if (next.setup) w = sim.inject(next.setup, next.setupNote ?? '', 'escenario', false);
    start.current = { world: w, cmd: commands.length };
    setActive(active + 1);
    setHintFor(null);
    setFocusSignal((n) => n + 1);
  }

  function restart() {
    const w = sim.reset();
    setActive(0);
    setDone([]);
    setFired([]);
    setFinished(false);
    setHintFor(null);
    start.current = { world: w, cmd: 0 };
  }

  return (
    <main className="grid min-h-0 flex-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(340px,430px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      {/* Columna de la lección */}
      <section
        aria-label="Lección"
        className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card"
      >
        <header className="border-b border-rule px-5 pt-4 pb-3.5">
          <p className="sign text-[13px] text-line-main">Parada {chapter.id} de 10</p>
          <h1 className="display mt-1 text-[34px] text-ink sm:text-[38px]">{chapter.title}</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">{chapter.tagline}</p>
        </header>

        <ol ref={listRef} className="slim-scroll relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {steps.map((s, i) => {
            const isActive = i === active && !finished;
            const isDone = finished || i < active || (i === active && stepDone);
            return (
              <li
                key={s.id}
                ref={isActive ? activeRef : undefined}
                className={`relative pb-5 pl-9 last:pb-1 ${isActive || finished ? '' : 'hidden lg:block'}`}
              >
                {i < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-6 bottom-0 left-[9px] w-[4px] rounded-full"
                    style={{ background: i < active || finished ? 'var(--color-line-main)' : 'var(--color-rule)' }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute top-[3px] left-0 grid h-[22px] w-[22px] place-items-center rounded-full border-[4px] bg-card"
                  style={{
                    borderColor: isDone || isActive ? 'var(--color-line-main)' : 'var(--color-rule)',
                    background: isDone ? 'var(--color-line-main)' : 'var(--color-card)',
                    color: '#fff',
                  }}
                >
                  {isDone && <CheckIcon size={11} />}
                </span>

                <h2
                  className={`text-[17px] leading-snug font-bold ${
                    isActive ? 'text-ink' : isDone ? 'text-ink-soft' : 'text-ink-faint'
                  }`}
                >
                  {s.title}
                </h2>

                {isActive && (
                  <div className="mt-1.5 text-[16px] leading-relaxed text-ink-soft [&_p+p]:mt-2.5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                    {typeof s.body === 'function' ? s.body(world) : s.body}

                    {s.actions && s.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.actions.map((a, k) => {
                          const key = `${i}:${k}`;
                          const used = fired.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={used}
                              onClick={() => {
                                sim.inject(a.run, a.message, a.label);
                                setFired((f) => [...f, key]);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border-2 border-line-1 bg-[#fff0ea] px-3.5 py-2 text-[14.5px] font-bold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-default disabled:border-rule disabled:bg-wash disabled:text-ink-faint"
                            >
                              {used ? <CheckIcon size={13} /> : <span aria-hidden="true">▶</span>}
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {s.hint && !stepDone && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setHintFor(hintFor === i ? null : i)}
                          className="text-[14.5px] font-medium text-line-main underline decoration-2 underline-offset-4"
                          aria-expanded={hintFor === i}
                        >
                          {hintFor === i ? 'Ocultar pista' : '¿Necesitas una pista?'}
                        </button>
                        {hintFor === i && (
                          <p className="mt-2 rounded-lg bg-[#fff8e6] px-3 py-2 text-[15px] text-ink">{s.hint}</p>
                        )}
                      </div>
                    )}

                    <AnimatePresence>
                      {stepDone && s.done && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 rounded-xl border border-line-2/30 bg-[#e9f8f3] px-3.5 py-3 text-[15.5px] text-ink"
                        >
                          <p className="sign mb-0.5 flex items-center gap-1.5 text-[13px] text-line-2">
                            <CheckIcon size={13} /> ¡Bien hecho!
                          </p>
                          {s.done}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-3.5 flex flex-wrap items-center gap-3">
                      {(!s.check || stepDone) && (
                        <button
                          type="button"
                          onClick={advance}
                          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[15px] font-bold text-white transition-transform hover:-translate-y-px active:translate-y-0"
                        >
                          {i + 1 >= steps.length ? 'Terminar parada' : s.check ? 'Continuar' : 'Entendido, sigamos'}
                          <ArrowIcon />
                        </button>
                      )}
                      {s.check && !stepDone && (
                        <button
                          type="button"
                          onClick={advance}
                          className="text-[14px] text-ink-faint underline underline-offset-4 hover:text-ink"
                        >
                          Saltar este paso
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}

          {finished && (
            <li className="relative pl-9">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-line-main/25 bg-[#eef1ff] p-4"
              >
                <p className="sign text-[13px] text-line-main">Parada {chapter.id} completada</p>
                <p className="display mt-1 text-[26px] text-ink">¡Muy bien, llegaste a la estación!</p>
                <p className="mt-1 text-[15px] text-ink-soft">Esto es lo que ahora sabes hacer:</p>
                <dl className="mt-2.5 grid grid-cols-[max-content_1fr] items-baseline gap-x-3 gap-y-2">
                  {chapter.recap.map((r) => (
                    <div key={r.cmd} className="contents">
                      <dt className="cmd !bg-white">{r.cmd}</dt>
                      <dd className="text-[15px] text-ink-soft">{r.desc}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {hasNext ? (
                    <button
                      type="button"
                      onClick={onNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-line-main px-4 py-2.5 text-[15px] font-bold text-white"
                    >
                      Siguiente: {nextTitle} <ArrowIcon />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onHome}
                      className="inline-flex items-center gap-2 rounded-xl bg-line-main px-4 py-2.5 text-[15px] font-bold text-white"
                    >
                      Ver el mapa del curso <ArrowIcon />
                    </button>
                  )}
                  <button type="button" onClick={restart} className="text-[14px] text-ink-soft underline underline-offset-4">
                    Repetir esta parada
                  </button>
                </div>
              </motion.div>
            </li>
          )}
        </ol>

        <footer className="flex items-center justify-between gap-3 border-t border-rule bg-paper/60 px-5 py-2.5">
          <p className="text-[13.5px] text-ink-faint">
            Paso {Math.min(active + 1, steps.length)} de {steps.length}
          </p>
          <button
            type="button"
            onClick={restart}
            className="text-[13.5px] font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Empezar de nuevo
          </button>
        </footer>
      </section>

      <PracticeArea
        world={world}
        entries={sim.entries}
        onRun={sim.run}
        onEdit={sim.editFile}
        suggestions={suggestions}
        focusSignal={focusSignal}
      />
    </main>
  );
}
