import { Out, runGit } from './git';
import type { ExecResult, OutLine, World } from './types';
import { tokenize } from './util';

export * from './core';
export * from './types';
export { hasConflictMarkers } from './diff';

const SHELL_HELP = [
  'Comandos que entiende esta terminal:',
  '',
  '  Archivos:  ls, cat, echo, touch, rm, mv, cp, pwd, clear',
  '  Git:       git init, status, add, commit, log, diff, show, branch,',
  '             switch, checkout, merge, restore, reset, revert, stash,',
  '             tag, remote, clone, fetch, pull, push, reflog',
  '',
  'Ejemplos:',
  '  echo "hola" > saludo.txt     crea un archivo con ese texto',
  '  echo "otra línea" >> saludo.txt   agrega una línea al final',
  '  git status                   mira en qué estado está tu proyecto',
];

function topLevel(files: string[], all: boolean) {
  const names = new Set<string>();
  for (const f of files) {
    const [first, ...rest] = f.split('/');
    if (!all && first.startsWith('.')) continue;
    names.add(rest.length ? `${first}/` : first);
  }
  return [...names].sort();
}

function runShell(w: World, cmd: string, args: string[], redirect: { op: '>' | '>>'; target: string } | undefined, o: Out): boolean | null {
  switch (cmd) {
    case 'ls': {
      const all = args.some((a) => /^-[a-zA-Z]*a/.test(a));
      const names = topLevel(Object.keys(w.files), all);
      if (names.length) o.out(names.join('  '));
      return true;
    }
    case 'pwd':
      o.out(`/home/tu/${w.cwd}`);
      return true;
    case 'cat': {
      const files = args.filter((a) => !a.startsWith('-'));
      if (!files.length) {
        o.err('cat: indica qué archivo quieres leer. Ejemplo: cat saludo.txt');
        return false;
      }
      for (const f of files) {
        const c = w.files[f];
        if (c === undefined) {
          o.err(`cat: ${f}: No existe ese archivo`);
          return false;
        }
        if (c !== '') o.out(c.replace(/\n$/, ''));
      }
      return true;
    }
    case 'echo': {
      const text = args.join(' ');
      if (!redirect) {
        o.out(text);
        return true;
      }
      const { op, target } = redirect;
      const prev = w.files[target] ?? '';
      if (op === '>>' && prev !== '' && !prev.endsWith('\n')) w.files[target] = prev + '\n' + text + '\n';
      else w.files[target] = (op === '>>' ? prev : '') + text + '\n';
      return true;
    }
    case 'touch': {
      const files = args.filter((a) => !a.startsWith('-'));
      if (!files.length) {
        o.err('touch: indica el nombre del archivo. Ejemplo: touch notas.txt');
        return false;
      }
      for (const f of files) if (w.files[f] === undefined) w.files[f] = '';
      return true;
    }
    case 'rm': {
      const recursive = args.some((a) => /^-[a-zA-Z]*[rR]/.test(a));
      const files = args.filter((a) => !a.startsWith('-'));
      if (!files.length) {
        o.err('rm: indica qué archivo quieres borrar. Ejemplo: rm notas.txt');
        return false;
      }
      for (const f of files) {
        const hits = Object.keys(w.files).filter((p) => p === f || (recursive && p.startsWith(f.replace(/\/$/, '') + '/')));
        if (!hits.length) {
          o.err(`rm: no se puede borrar '${f}': No existe ese archivo`);
          return false;
        }
        for (const h of hits) delete w.files[h];
      }
      return true;
    }
    case 'mv':
    case 'cp': {
      const [a, b] = args.filter((x) => !x.startsWith('-'));
      if (!a || !b) {
        o.err(`${cmd}: faltan el origen y el destino. Ejemplo: ${cmd} viejo.txt nuevo.txt`);
        return false;
      }
      if (w.files[a] === undefined) {
        o.err(`${cmd}: no se puede encontrar '${a}': No existe ese archivo`);
        return false;
      }
      w.files[b] = w.files[a];
      if (cmd === 'mv') delete w.files[a];
      return true;
    }
    case 'help':
    case 'ayuda':
      for (const l of SHELL_HELP) o.out(l);
      return true;
    case 'mkdir':
      o.dim('En este simulador las carpetas se crean solas al nombrar un archivo, por ejemplo: touch docs/notas.txt');
      return true;
    default:
      return null;
  }
}

export interface ExecOptions {
  /** `false` en las misiones: sin pistas, sin sugerencias y sin ayuda. */
  hints?: boolean;
}

const HINT_LINE = /^(Pista|Tip|Ejemplo|Si estás seguro|Ramas que|Revisa que|Primero crea|Escribe "help"|Arregla los conflictos|Los más usados|Uso:|uso:)/;

function stripHints(lines: OutLine[]): OutLine[] {
  const out: OutLine[] = [];
  let skip = false;
  for (const l of lines) {
    if (l.text.startsWith('¿Quisiste decir')) skip = true;
    if (skip) continue;
    if (l.kind === 'dim' && HINT_LINE.test(l.text)) continue;
    out.push(l);
  }
  while (out.length && out[out.length - 1].text === '') out.pop();
  return out;
}

/** Ejecuta una línea escrita en la terminal. Devuelve el mundo nuevo y lo que hay que mostrar. */
export function execute(world: World, input: string, opts: ExecOptions = {}): ExecResult {
  const hints = opts.hints !== false;
  const line = input.trim();
  if (!line) return { world, lines: [], ok: true };
  if (line === 'clear' || line === 'cls') return { world, lines: [], ok: true, clear: true };

  if (!hints && /^(help|ayuda|git help|git --help|git -h)$/.test(line)) {
    return {
      world,
      lines: [{ text: 'En las misiones no hay ayuda. ¡Tú puedes!', kind: 'dim' }],
      ok: true,
    };
  }

  const parsed = tokenize(line);
  const o = new Out();
  if (parsed.error) {
    o.err(`Error: ${parsed.error}.`);
    return { world, lines: o.lines, ok: false };
  }
  const [cmd, ...args] = parsed.args;
  if (!cmd) return { world, lines: [], ok: true };

  const w = structuredClone(world);
  let ok: boolean;
  if (cmd === 'git') {
    ok = runGit(w, args, o);
  } else {
    const r = runShell(w, cmd, args, parsed.redirect, o);
    if (r === null) {
      o.err(`${cmd}: comando no encontrado.`);
      o.dim('Escribe "help" para ver los comandos disponibles. Los de Git empiezan con "git".');
      return { world, lines: hints ? o.lines : stripHints(o.lines), ok: false };
    }
    ok = r;
  }
  return { world: ok || o.keep ? w : world, lines: hints ? o.lines : stripHints(o.lines), ok };
}
