/** Hash determinista de 40 caracteres hexadecimales (no es SHA-1, pero se ve igual). */
export function hash40(input: string): string {
  let out = '';
  for (let r = 0; r < 5; r++) {
    let h1 = 0xdeadbeef ^ Math.imul(r + 1, 0x9e3779b1);
    let h2 = 0x41c6ce57 ^ Math.imul(r + 1, 0x85ebca6b);
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    out += (h1 >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

export interface Parsed {
  args: string[];
  redirect?: { op: '>' | '>>'; target: string };
  error?: string;
}

/** Separa una línea de comandos respetando comillas y redirecciones (> y >>). */
export function tokenize(line: string): Parsed {
  const args: string[] = [];
  let redirect: Parsed['redirect'];
  let pendingOp: '>' | '>>' | null = null;
  let cur = '';
  let has = false;
  let quote: string | null = null;

  const push = () => {
    if (!has) return;
    if (pendingOp) {
      redirect = { op: pendingOp, target: cur };
      pendingOp = null;
    } else args.push(cur);
    cur = '';
    has = false;
  };

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      has = true;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      continue;
    }
    if (c === '>') {
      push();
      if (line[i + 1] === '>') {
        pendingOp = '>>';
        i++;
      } else pendingOp = '>';
      continue;
    }
    cur += c;
    has = true;
  }
  if (quote) return { args, error: 'hay unas comillas sin cerrar' };
  push();
  if (pendingOp) return { args, error: 'falta el nombre del archivo después de ">"' };
  return { args, redirect };
}

function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
  return new RegExp(`^${esc}$`);
}

/** Interpreta las reglas de un .gitignore (lo básico: nombres, *.ext, carpeta/ y !excepción). */
export function isIgnored(path: string, gitignore: string | undefined): boolean {
  if (!gitignore) return false;
  let ignored = false;
  for (const raw of gitignore.split('\n')) {
    let p = raw.trim();
    if (!p || p.startsWith('#')) continue;
    let negate = false;
    if (p.startsWith('!')) {
      negate = true;
      p = p.slice(1);
    }
    p = p.replace(/^\//, '');
    const dirOnly = p.endsWith('/');
    if (dirOnly) p = p.slice(0, -1);
    const parts = path.split('/');
    let hit = false;
    if (dirOnly || p.includes('/')) {
      const re = globToRegExp(p);
      for (let i = 1; i <= parts.length; i++) {
        if (dirOnly && i === parts.length) break;
        if (re.test(parts.slice(0, i).join('/'))) hit = true;
      }
      if (!dirOnly && re.test(path)) hit = true;
    } else {
      const re = globToRegExp(p);
      hit = parts.some((part) => re.test(part));
    }
    if (hit) ignored = !negate;
  }
  return ignored;
}
