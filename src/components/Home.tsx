import { useRef, useState } from 'react';
import { createWorld, currentBranch, execute, type World } from '../engine';
import { isReady, LESSON_COUNT, MISSION_COUNT, ROUTE } from '../course';
import type { ChapterMeta } from '../course/types';
import { MetroMap } from './MetroMap';
import { ArrowIcon, CheckIcon } from './ui';

function seed(): World {
  let w = createWorld({ cwd: 'mi-proyecto' });
  for (const c of [
    'git init',
    'echo "Mi proyecto" > notas.txt',
    'git add notas.txt',
    'git commit -m "Empiezo"',
    'echo "primer avance" >> notas.txt',
    'git commit -am "Primer avance"',
  ]) {
    w = execute(w, c).world;
  }
  return w;
}

interface Say {
  cmds: string[];
  note: string;
}

function Demo() {
  const [world, setWorld] = useState<World>(seed);
  const [say, setSay] = useState<Say | null>(null);
  const counter = useRef(1);

  const branch = world.repo ? currentBranch(world.repo) : null;
  const ideas = Object.keys(world.repo?.branches ?? {}).filter((b) => b !== 'main');
  const onIdea = branch !== null && branch !== 'main';

  function play(cmds: string[], note: string) {
    let w = world;
    for (const c of cmds) w = execute(w, c).world;
    if (Object.keys(w.commits).length > 12) {
      setWorld(seed());
      setSay({ cmds: ['(el mapa se llenó: empezamos de nuevo)'], note: 'Usa los botones para seguir explorando.' });
      return;
    }
    setWorld(w);
    setSay({ cmds, note });
  }

  const n = () => counter.current++;

  function save() {
    const k = n();
    play(
      [`echo "avance ${k}" >> notas.txt`, `git commit -am "Avance ${k}"`],
      onIdea
        ? 'Guardaste un punto dentro de tu idea. La línea principal sigue intacta.'
        : 'Guardaste un punto: una estación nueva al final de tu línea.',
    );
  }

  function tryIdea() {
    const k = n();
    if (onIdea) return save();
    const name = `idea-${k}`;
    play(
      [`git switch -c ${name}`, `echo "idea ${k}" >> notas.txt`, `git commit -am "Pruebo la idea ${k}"`],
      'Creaste una rama: una línea paralela donde puedes experimentar sin tocar la principal.',
    );
  }

  function join() {
    const target = onIdea ? branch : ideas[ideas.length - 1];
    if (!target) return;
    play(
      ['git switch main', `git merge --no-ff ${target} -m "Uno la idea"`, `git branch -d ${target}`],
      'Fusionaste la idea con la línea principal: dos caminos se vuelven uno en un transbordo.',
    );
  }

  const canJoin = ideas.length > 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-rule bg-card shadow-[0_20px_50px_-30px_rgba(14,22,48,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <p className="sign text-[15px] text-ink">Pruébalo ahora</p>
        <button
          type="button"
          onClick={() => {
            setWorld(seed());
            setSay(null);
          }}
          className="text-[13.5px] text-ink-faint underline underline-offset-4 hover:text-ink"
        >
          Empezar de cero
        </button>
      </div>
      <div className="h-[290px]">
        <MetroMap world={world} />
      </div>
      <div className="border-t border-rule bg-paper/60 px-5 py-4">
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-ink px-4 py-2.5 text-[15px] font-bold text-white transition-transform hover:-translate-y-px"
          >
            Guardar un punto
          </button>
          <button
            type="button"
            onClick={tryIdea}
            className="rounded-xl bg-line-1 px-4 py-2.5 text-[15px] font-bold text-white transition-transform hover:-translate-y-px"
          >
            {onIdea ? 'Seguir con la idea' : 'Probar una idea'}
          </button>
          <button
            type="button"
            onClick={join}
            disabled={!canJoin}
            className="rounded-xl border-2 border-ink px-4 py-2 text-[15px] font-bold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-faint"
          >
            Unir la idea
          </button>
        </div>
        <div className="mt-3 min-h-[3.5rem] text-[14.5px]" aria-live="polite">
          {say ? (
            <>
              <p className="font-mono text-[12.5px] text-ink-soft">
                {say.cmds.map((c) => (
                  <span key={c} className="block truncate">
                    $ {c}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-ink">{say.note}</p>
            </>
          ) : (
            <p className="text-ink-soft">
              Toca un botón y mira cómo se dibuja tu historia. Detrás de cada uno hay un comando real de Git.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const HOW = [
  { n: 1, t: 'Lee una idea corta', d: 'Con una analogía, sin jerga innecesaria.' },
  { n: 2, t: 'Escribe el comando', d: 'En una terminal de práctica donde no puedes romper nada.' },
  { n: 3, t: 'Mira cómo cambia el mapa', d: 'Cada cosa que haces se dibuja al instante.' },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} de 3 estrellas`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"
            fill={i <= n ? 'var(--color-line-3)' : 'var(--color-rule)'}
          />
        </svg>
      ))}
    </span>
  );
}

interface ListProps {
  items: ChapterMeta[];
  completed: number[];
  stars: Record<number, number>;
  onOpen: (id: number) => void;
  /** Color de la línea: azul para las paradas, naranja para las misiones. */
  color: string;
  label: (c: ChapterMeta) => string;
}

function RouteList({ items, completed, stars, onOpen, color, label }: ListProps) {
  return (
    <ol className="relative mt-8">
      {items.map((c, i) => {
        const ready = isReady(c.id);
        const done = completed.includes(c.id);
        return (
          <li key={c.id} className="relative pb-4 pl-14 last:pb-0">
            {i < items.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-[-6px] left-[17px] w-[6px] rounded-full"
                style={{ background: done ? color : 'var(--color-rule)' }}
              />
            )}
            <span
              aria-hidden="true"
              className="display absolute top-1.5 left-0 grid h-10 w-10 place-items-center rounded-full border-[5px] text-[19px]"
              style={{
                borderColor: ready ? color : 'var(--color-rule)',
                borderStyle: ready ? 'solid' : 'dashed',
                background: done ? color : 'var(--color-card)',
                color: done ? '#fff' : ready ? 'var(--color-ink)' : 'var(--color-ink-faint)',
              }}
            >
              {done ? <CheckIcon size={16} /> : label(c)}
            </span>

            <button
              type="button"
              disabled={!ready}
              onClick={() => onOpen(c.id)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-rule bg-card px-5 py-4 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_30px_-22px_rgba(14,22,48,0.5)] disabled:cursor-not-allowed disabled:bg-paper"
              style={{ ['--hover' as string]: color }}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-[19px] leading-tight font-bold ${ready ? 'text-ink' : 'text-ink-faint'}`}>
                  {c.title}
                </p>
                <p className={`mt-0.5 text-[15.5px] ${ready ? 'text-ink-soft' : 'text-ink-faint'}`}>{c.tagline}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="sign text-[13px] text-ink-faint">{c.minutes} min</span>
                {done ? (
                  c.kind === 'mission' && stars[c.id] ? (
                    <Stars n={stars[c.id]} />
                  ) : (
                    <span className="sign rounded-full bg-[#e9f8f3] px-2.5 py-0.5 text-[12px] text-line-2">Completada</span>
                  )
                ) : (
                  <span className="sign flex items-center gap-1 text-[13px]" style={{ color }}>
                    Empezar <ArrowIcon size={13} />
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface Props {
  completed: number[];
  stars: Record<number, number>;
  onOpen: (id: number) => void;
  onResetProgress: () => void;
  onCommands: () => void;
}

export function Home({ completed, stars, onOpen, onResetProgress, onCommands }: Props) {
  const lessons = ROUTE.filter((c) => c.kind === 'lesson');
  const missions = ROUTE.filter((c) => c.kind === 'mission');
  const firstPending = ROUTE.find((c) => isReady(c.id) && !completed.includes(c.id));
  const started = completed.length > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-14 lg:py-16">
        <div>
          <p className="sign text-[14px] text-line-main">Curso interactivo de Git · en español</p>
          <h1 className="display mt-3 text-[56px] text-ink sm:text-[76px] lg:text-[88px]">
            Aprende Git viajando por tu propio mapa.
          </h1>
          <p className="mt-5 max-w-xl text-[19px] leading-relaxed text-ink-soft">
            Escribe comandos de verdad y mira cómo crece la historia de tu proyecto. Sin instalar nada, sin saber
            programar y sin miedo a romper algo.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onOpen(firstPending?.id ?? 1)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-line-main px-6 py-3.5 text-[17px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(36,71,245,0.8)] transition-transform hover:-translate-y-0.5"
            >
              {started
                ? `Continuar: ${ROUTE.find((c) => c.id === (firstPending?.id ?? 1))?.title}`
                : 'Empezar el viaje'}
              <ArrowIcon size={18} />
            </button>
            <a href="#paradas" className="text-[16px] font-medium text-ink underline decoration-2 underline-offset-4">
              Ver las {LESSON_COUNT} paradas y {MISSION_COUNT} misiones
            </a>
          </div>
        </div>
        <Demo />
      </section>

      <section aria-label="Cómo funciona" className="rounded-3xl bg-ink px-6 py-6 text-white sm:px-8">
        <ol className="grid gap-5 sm:grid-cols-3">
          {HOW.map((h) => (
            <li key={h.n} className="flex gap-3.5">
              <span className="display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[22px] text-ink">
                {h.n}
              </span>
              <div>
                <p className="text-[17px] font-bold">{h.t}</p>
                <p className="text-[15px] text-white/70">{h.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="paradas" className="scroll-mt-6 pt-14" aria-labelledby="paradas-titulo">
        <p className="sign text-[14px] text-line-main">Línea azul · guiada</p>
        <h2 id="paradas-titulo" className="display text-[44px] text-ink">
          Las {LESSON_COUNT} paradas
        </h2>
        <p className="mt-2 max-w-xl text-[17px] text-ink-soft">
          Cada parada dura entre 5 y 15 minutos. Te acompañan con explicaciones, sugerencias y pistas. Puedes avanzar
          a tu ritmo y repetir las que quieras.
        </p>
        <RouteList
          items={lessons}
          completed={completed}
          stars={stars}
          onOpen={onOpen}
          color="var(--color-line-main)"
          label={(c) => String(c.id)}
        />
      </section>

      <section id="misiones" className="scroll-mt-6 pt-16" aria-labelledby="misiones-titulo">
        <div className="rounded-3xl border-2 border-line-1/30 bg-[#fff6f1] px-5 py-7 sm:px-8">
          <p className="sign text-[14px] text-line-1">Línea naranja · sin ayuda</p>
          <h2 id="misiones-titulo" className="display text-[44px] text-ink">
            {MISSION_COUNT} misiones para ponerte a prueba
          </h2>
          <p className="mt-2 max-w-2xl text-[17px] text-ink-soft">
            Aquí no hay pasos, ni sugerencias, ni pistas. Solo una historia, unos objetivos y tu terminal. Pasan
            cosas inesperadas, y ganas hasta tres estrellas según cuántos movimientos necesites.
          </p>
          <RouteList
            items={missions}
            completed={completed}
            stars={stars}
            onOpen={onOpen}
            color="var(--color-line-1)"
            label={(c) => `M${c.id - 10}`}
          />
        </div>
      </section>

      <section className="pt-16" aria-labelledby="comandos-titulo">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-ink px-6 py-7 text-white sm:px-8">
          <div className="max-w-xl">
            <p className="sign text-[14px] text-white/60">Guía de consulta</p>
            <h2 id="comandos-titulo" className="display mt-1 text-[40px]">
              Todos los comandos en un solo lugar
            </h2>
            <p className="mt-2 text-[16.5px] text-white/75">
              Una lista ordenada por tipo: qué hace cada comando, cuándo usarlo y por dónde viajan tus cambios.
            </p>
          </div>
          <button
            type="button"
            onClick={onCommands}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-6 py-3.5 text-[17px] font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            Ver los comandos
            <ArrowIcon size={18} />
          </button>
        </div>
      </section>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5 text-[14.5px] text-ink-faint">
        <p>Todo ocurre en tu navegador. Tu progreso se guarda en este dispositivo.</p>
        {started && (
          <button type="button" onClick={onResetProgress} className="underline underline-offset-4 hover:text-ink">
            Borrar mi progreso
          </button>
        )}
      </footer>
    </main>
  );
}
