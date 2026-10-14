import { useState } from 'react';
import type { World } from '../engine';
import type { TermEntry } from '../hooks/useSimulator';
import { FileEditor } from './FileEditor';
import { MetroMap } from './MetroMap';
import { Terminal } from './Terminal';
import { Panel } from './ui';
import { Zones } from './Zones';

interface Props {
  world: World;
  entries: TermEntry[];
  onRun: (input: string) => void;
  onEdit: (path: string, content: string) => void;
  suggestions: string[];
  focusSignal: number;
  /** En las misiones no hay ayuda: sin sugerencias ni autocompletado. */
  noHelp?: boolean;
}

/** Zona de práctica: tus archivos, el mapa y la terminal. Es igual en lecciones y misiones. */
export function PracticeArea({ world, entries, onRun, onEdit, suggestions, focusSignal, noHelp }: Props) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  function submit(value: string) {
    if (!value.trim()) return;
    onRun(value);
    setDraft('');
  }

  return (
    <>
      <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)_minmax(210px,36%)]">
        <Panel
          title="Tus archivos"
          subtitle="Así viajan los cambios hasta quedar guardados"
          className="order-2 lg:order-1"
        >
          <Zones world={world} onEdit={(p) => setEditing(p)} />
        </Panel>
        <Panel
          title="Tu mapa"
          subtitle="Cada estación es un commit · cada línea es una rama"
          className="order-3 min-h-[250px] lg:order-2 lg:min-h-0"
        >
          <MetroMap world={world} />
        </Panel>
        <Panel
          title="Terminal"
          subtitle={noHelp ? 'Sin ayuda: lo que sabes, aquí' : '↑ historial · Tab completa'}
          className="order-1 min-h-[300px] lg:order-3 lg:min-h-0"
          bodyClassName="bg-term"
        >
          <Terminal
            entries={entries}
            world={world}
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            suggestions={suggestions}
            focusSignal={focusSignal}
            noComplete={noHelp}
          />
        </Panel>
      </div>

      {editing !== null && world.files[editing] !== undefined && (
        <FileEditor
          key={editing}
          path={editing}
          initial={world.files[editing]}
          onClose={() => setEditing(null)}
          onSave={(content) => {
            onEdit(editing, content);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
