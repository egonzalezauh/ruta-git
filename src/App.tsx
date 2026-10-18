import { useCallback, useEffect, useState } from 'react';
import { getChapter, getMission, isReady, ROUTE } from './course';
import { CommandsView } from './components/CommandsView';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { LessonView } from './components/LessonView';
import { MissionView } from './components/MissionView';
import { useProgress } from './state/progress';

/** Rutas simples con el hash: "#/parada/2" y "#/mision/11". Así funciona el botón "atrás" del navegador. */
function parse(hash: string): number | null {
  const m = /^#\/(?:parada|mision)\/(\d+)$/.exec(hash);
  if (!m) return null;
  const id = Number(m[1]);
  return isReady(id) ? id : null;
}

const hashFor = (id: number) => `#/${ROUTE.find((c) => c.id === id)?.kind === 'mission' ? 'mision' : 'parada'}/${id}`;

const COMMANDS_HASH = '#/comandos';

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const { completed, stars, complete, reset } = useProgress();

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const routeId = parse(hash);
  const showCommands = hash === COMMANDS_HASH;

  const go = useCallback((id: number | null) => {
    window.location.hash = id === null ? '#/' : hashFor(id);
    window.scrollTo({ top: 0 });
  }, []);

  const goCommands = useCallback(() => {
    window.location.hash = COMMANDS_HASH;
    window.scrollTo({ top: 0 });
  }, []);

  const lesson = routeId !== null ? getChapter(routeId) : undefined;
  const mission = routeId !== null ? getMission(routeId) : undefined;
  const current = lesson ?? mission;
  const nextMeta = current ? ROUTE.find((c) => c.id === current.id + 1) : undefined;
  const hasNext = !!nextMeta && isReady(nextMeta.id);

  useEffect(() => {
    document.title = showCommands
      ? 'Comandos de Git · Ruta Git'
      : lesson
        ? `Parada ${lesson.id}: ${lesson.title} · Ruta Git`
        : mission
          ? `Misión ${mission.id - 10}: ${mission.title} · Ruta Git`
          : 'Ruta Git';
  }, [lesson, mission, showCommands]);

  return (
    // En la lección (pantallas grandes) todo cabe en la ventana y cada panel hace su propio scroll.
    <div className={`flex min-h-full flex-col ${current && !showCommands ? 'lg:h-full' : ''}`}>
      <Header
        current={showCommands ? null : (current?.id ?? null)}
        completed={completed}
        onGo={go}
        onHome={() => go(null)}
        onCommands={goCommands}
        commandsOpen={showCommands}
      />
      {showCommands ? (
        <CommandsView onHome={() => go(null)} />
      ) : lesson ? (
        <LessonView
          key={lesson.id}
          chapter={lesson}
          hasNext={hasNext}
          nextTitle={nextMeta?.title}
          onComplete={(id) => complete(id)}
          onNext={() => nextMeta && go(nextMeta.id)}
          onHome={() => go(null)}
        />
      ) : mission ? (
        <MissionView
          key={mission.id}
          mission={mission}
          hasNext={hasNext}
          nextTitle={nextMeta?.title}
          onComplete={complete}
          onNext={() => nextMeta && go(nextMeta.id)}
          onHome={() => go(null)}
        />
      ) : (
        <Home completed={completed} stars={stars} onOpen={go} onResetProgress={reset} onCommands={goCommands} />
      )}
    </div>
  );
}
