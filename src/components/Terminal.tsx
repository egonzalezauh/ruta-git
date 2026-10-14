import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { LineKind, World } from '../engine';
import { currentBranch } from '../engine';
import type { TermEntry } from '../hooks/useSimulator';

const KIND_CLASS: Record<LineKind | 'default', string> = {
  default: 'text-[#dde3f5]',
  out: 'text-[#dde3f5]',
  err: 'text-[#ff8f86]',
  ok: 'text-[#5fe3b2]',
  warn: 'text-[#ffd166]',
  dim: 'text-[#8c97bd]',
  add: 'text-[#5fe3b2]',
  del: 'text-[#ff8f86]',
  hunk: 'text-[#8dbbff]',
  head: 'text-[#ffd166]',
  bold: 'font-medium text-white',
};

const SHELL = ['git', 'ls', 'cat', 'echo', 'touch', 'rm', 'mv', 'cp', 'pwd', 'clear', 'help'];
const GIT_SUB = [
  'init', 'status', 'add', 'commit', 'log', 'diff', 'show', 'branch', 'switch', 'checkout', 'merge',
  'restore', 'reset', 'revert', 'stash', 'tag', 'remote', 'clone', 'fetch', 'pull', 'push', 'reflog', 'rm', 'mv', 'config',
];

function commonPrefix(items: string[]) {
  return items.reduce((p, s) => {
    let i = 0;
    while (i < p.length && i < s.length && p[i] === s[i]) i++;
    return p.slice(0, i);
  });
}

function complete(value: string, world: World): string {
  const parts = value.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool: string[];
  if (parts.length === 1) pool = SHELL;
  else if (parts[0] === 'git' && parts.length === 2) pool = GIT_SUB;
  else {
    pool = [...Object.keys(world.files), ...Object.keys(world.repo?.branches ?? {})];
  }
  const hits = pool.filter((p) => p.startsWith(last) && p !== last);
  if (!hits.length) return value;
  const pref = commonPrefix(hits);
  const next = hits.length === 1 ? pref + ' ' : pref;
  return [...parts.slice(0, -1), next].join(' ');
}

interface Props {
  entries: TermEntry[];
  world: World;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  suggestions: string[];
  focusSignal: number;
  /** Desactiva Tab para completar (en las misiones). */
  noComplete?: boolean;
}

function Prompt({ cwd, branch }: { cwd: string; branch: string | null | undefined }) {
  return (
    <span className="shrink-0 select-none">
      <span className="text-[#7fe3c0]">~/{cwd}</span>
      {branch && <span className="text-[#ffd166]"> ({branch})</span>}
      <span className="text-[#8c97bd]"> $</span>
    </span>
  );
}

export function Terminal({ entries, world, value, onChange, onSubmit, suggestions, focusSignal, noComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const history = useMemo(() => entries.filter((e) => e.type === 'cmd').map((e) => e.text), [entries]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
      setCursor(null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const idx = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(idx);
      onChange(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor === null) return;
      const idx = cursor + 1;
      if (idx >= history.length) {
        setCursor(null);
        onChange('');
      } else {
        setCursor(idx);
        onChange(history[idx]);
      }
    } else if (e.key === 'Tab' && !noComplete) {
      e.preventDefault();
      onChange(complete(value, world));
    }
  }

  const branch = world.repo ? (currentBranch(world.repo) ?? 'HEAD') : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-term font-mono text-[13.5px] leading-[1.55]"
      onClick={() => inputRef.current?.focus()}
    >
      <div role="log" aria-live="polite" className="term-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-3">
        {entries.map((e) =>
          e.type === 'cmd' ? (
            <div key={e.id} className="mt-1.5 flex gap-2 whitespace-pre-wrap break-words">
              <Prompt cwd={e.cwd ?? world.cwd} branch={e.branch} />
              <span className="text-white">{e.text}</span>
            </div>
          ) : (
            <div key={e.id} className={`whitespace-pre-wrap break-words ${KIND_CLASS[e.kind ?? 'default']}`}>
              {e.text || ' '}
            </div>
          ),
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-term-2 px-3 py-2">
          <span className="text-[12px] text-[#8c97bd]">Prueba con:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onChange(s);
                inputRef.current?.focus();
              }}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[12.5px] text-[#ffd166] transition-colors hover:border-[#ffd166]/70 hover:bg-white/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 border-t border-white/10 bg-term-2 px-4 py-2.5 focus-within:bg-[#1b2650]">
        <Prompt cwd={world.cwd} branch={branch} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(null);
          }}
          onKeyDown={onKeyDown}
          placeholder="Escribe un comando…"
          aria-label="Escribe un comando"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-white caret-[#ffd166] outline-none placeholder:text-[#5d688f]"
        />
      </label>
    </div>
  );
}
