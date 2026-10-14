import { describe, expect, it } from 'vitest';
import {
  createWorld,
  execute,
  headId,
  headTree,
  makeCommit,
  statusInfo,
  type ExecResult,
  type World,
} from './index';

function run(world: World, ...cmds: string[]): { world: World; last: ExecResult; text: string; all: ExecResult[] } {
  let w = world;
  let last: ExecResult = { world, lines: [], ok: true };
  const all: ExecResult[] = [];
  for (const c of cmds) {
    last = execute(w, c);
    w = last.world;
    all.push(last);
  }
  return { world: w, last, text: last.lines.map((l) => l.text).join('\n'), all };
}

const fresh = () => createWorld({ cwd: 'proyecto' });

describe('lo básico: init, add, commit', () => {
  it('git init crea el repositorio', () => {
    const { world, text } = run(fresh(), 'git init');
    expect(world.repo).not.toBeNull();
    expect(text).toContain('Inicializado repositorio Git vacío');
  });

  it('antes de git init, los comandos git fallan con una pista', () => {
    const { last, text } = run(fresh(), 'git status');
    expect(last.ok).toBe(false);
    expect(text).toContain('git init');
  });

  it('flujo completo: archivo → add → commit', () => {
    const { world, all } = run(
      fresh(),
      'git init',
      'echo "hola" > hola.txt',
      'git status',
      'git add hola.txt',
      'git commit -m "Primer commit"',
    );
    expect(all[2].lines.map((l) => l.text).join('\n')).toContain('Archivos sin seguimiento');
    expect(all[4].ok).toBe(true);
    expect(all[4].lines[0].text).toMatch(/^\[main \(commit raíz\) [0-9a-f]{7}\] Primer commit$/);
    const r = world.repo!;
    expect(Object.keys(world.commits)).toHaveLength(1);
    expect(headTree(world)).toEqual({ 'hola.txt': 'hola\n' });
    expect(statusInfo(world).clean).toBe(true);
    expect(r.index['hola.txt']).toBe('hola\n');
  });

  it('commit sin nada preparado no crea commit', () => {
    const { last, world } = run(fresh(), 'git init', 'echo a > a.txt', 'git commit -m "x"');
    expect(last.ok).toBe(false);
    expect(Object.keys(world.commits)).toHaveLength(0);
  });

  it('commit sin -m da una pista', () => {
    const { last, text } = run(fresh(), 'git init', 'echo a > a.txt', 'git add .', 'git commit');
    expect(last.ok).toBe(false);
    expect(text).toContain('git commit -m');
  });

  it('mensaje sin comillas se explica', () => {
    const { last, text } = run(fresh(), 'git init', 'echo a > a.txt', 'git add .', 'git commit -m Mi primer commit');
    expect(last.ok).toBe(false);
    expect(text).toContain('entre comillas');
  });

  it('git add . respeta .gitignore', () => {
    const { world } = run(
      fresh(),
      'git init',
      'echo "*.log" > .gitignore',
      'echo "secreto" > debug.log',
      'echo "ok" > app.txt',
      'git add .',
    );
    expect(Object.keys(world.repo!.index).sort()).toEqual(['.gitignore', 'app.txt']);
    expect(statusInfo(world).untracked).toEqual([]);
  });

  it('git status muestra modificados y preparados', () => {
    const { text } = run(
      fresh(),
      'git init',
      'echo "uno" > a.txt',
      'git add a.txt',
      'git commit -m "a"',
      'echo "dos" >> a.txt',
      'echo "nuevo" > b.txt',
      'git add b.txt',
      'git status',
    );
    expect(text).toContain('Cambios a ser confirmados');
    expect(text).toContain('nuevo archivo:');
    expect(text).toContain('Cambios no preparados');
    expect(text).toContain('modificado:');
  });

  it('commit -am guarda cambios de archivos ya seguidos', () => {
    const { world } = run(
      fresh(),
      'git init',
      'echo "uno" > a.txt',
      'git add .',
      'git commit -m "a"',
      'echo "dos" >> a.txt',
      'git commit -am "cambio"',
    );
    expect(Object.keys(world.commits)).toHaveLength(2);
    expect(headTree(world)['a.txt']).toBe('uno\ndos\n');
  });

  it('git log --oneline lista del más nuevo al más antiguo', () => {
    const { text } = run(
      fresh(),
      'git init',
      'echo 1 > a.txt',
      'git add .',
      'git commit -m "uno"',
      'echo 2 >> a.txt',
      'git commit -am "dos"',
      'git log --oneline',
    );
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('(HEAD -> main)');
    expect(lines[0]).toContain('dos');
    expect(lines[1]).toContain('uno');
  });
});

describe('deshacer', () => {
  const base = () =>
    run(fresh(), 'git init', 'echo "v1" > a.txt', 'git add .', 'git commit -m "v1"', 'echo "v2" > a.txt', 'git commit -am "v2"')
      .world;

  it('restore descarta cambios sin preparar', () => {
    const { world } = run(base(), 'echo "borrador" > a.txt', 'git restore a.txt');
    expect(world.files['a.txt']).toBe('v2\n');
  });

  it('restore --staged saca del área de preparación', () => {
    const { world } = run(base(), 'echo "x" > b.txt', 'git add b.txt', 'git restore --staged b.txt');
    expect(world.repo!.index['b.txt']).toBeUndefined();
    expect(world.files['b.txt']).toBe('x\n');
  });

  it('reset --hard HEAD~1 vuelve atrás y el reflog permite recuperar', () => {
    const start = base();
    const v2 = headId(start.repo!)!;
    const { world, last } = run(start, 'git reset --hard HEAD~1');
    expect(last.ok).toBe(true);
    expect(world.files['a.txt']).toBe('v1\n');
    expect(headId(world.repo!)).not.toBe(v2);
    const back = run(world, 'git reset --hard HEAD@{1}');
    expect(headId(back.world.repo!)).toBe(v2);
    expect(back.world.files['a.txt']).toBe('v2\n');
  });

  it('reset --soft deja los cambios preparados', () => {
    const { world } = run(base(), 'git reset --soft HEAD~1');
    expect(world.repo!.index['a.txt']).toBe('v2\n');
    expect(headTree(world)['a.txt']).toBe('v1\n');
  });

  it('reset --mixed deja los cambios sin preparar', () => {
    const { world } = run(base(), 'git reset HEAD~1');
    expect(world.repo!.index['a.txt']).toBe('v1\n');
    expect(world.files['a.txt']).toBe('v2\n');
  });

  it('revert crea un commit nuevo que deshace el anterior', () => {
    const { world, last } = run(base(), 'git revert HEAD --no-edit');
    expect(last.ok).toBe(true);
    expect(Object.keys(world.commits)).toHaveLength(3);
    expect(world.files['a.txt']).toBe('v1\n');
    expect(world.commits[headId(world.repo!)!].message).toContain('Revert "v2"');
  });

  it('git show rev:archivo muestra una versión antigua', () => {
    const { text } = run(base(), 'git show HEAD~1:a.txt');
    expect(text).toBe('v1');
  });
});

describe('ramas y fusiones', () => {
  const base = () =>
    run(fresh(), 'git init', 'echo "a" > a.txt', 'git add .', 'git commit -m "inicio"').world;

  it('crear rama y cambiar', () => {
    const { world, last } = run(base(), 'git branch idea', 'git switch idea');
    expect(last.ok).toBe(true);
    expect(world.repo!.head).toEqual({ kind: 'branch', name: 'idea' });
  });

  it('switch -c crea y cambia', () => {
    const { world } = run(base(), 'git switch -c idea');
    expect(world.repo!.head).toEqual({ kind: 'branch', name: 'idea' });
    expect(Object.keys(world.repo!.branches).sort()).toEqual(['idea', 'main']);
  });

  it('los archivos cambian al cambiar de rama', () => {
    const { world } = run(
      base(),
      'git switch -c idea',
      'echo "solo en idea" > idea.txt',
      'git add .',
      'git commit -m "idea"',
      'git switch main',
    );
    expect(world.files['idea.txt']).toBeUndefined();
    const back = run(world, 'git switch idea');
    expect(back.world.files['idea.txt']).toBe('solo en idea\n');
  });

  it('merge con avance rápido', () => {
    const { world, text } = run(
      base(),
      'git switch -c idea',
      'echo "x" > x.txt',
      'git add .',
      'git commit -m "x"',
      'git switch main',
      'git merge idea',
    );
    expect(text).toContain('Fast-forward');
    expect(world.files['x.txt']).toBe('x\n');
    expect(Object.keys(world.commits)).toHaveLength(2);
  });

  it('merge de ramas divergentes crea un commit de fusión', () => {
    const { world, last, text } = run(
      base(),
      'git switch -c idea',
      'echo "x" > x.txt',
      'git add .',
      'git commit -m "x"',
      'git switch main',
      'echo "y" > y.txt',
      'git add .',
      'git commit -m "y"',
      'git merge idea',
    );
    expect(last.ok).toBe(true);
    expect(text).toContain('estrategia');
    const head = world.commits[headId(world.repo!)!];
    expect(head.parents).toHaveLength(2);
    expect(world.files['x.txt']).toBe('x\n');
    expect(world.files['y.txt']).toBe('y\n');
  });

  it('cambios en líneas distintas del mismo archivo se combinan solos', () => {
    const w0 = run(
      fresh(),
      'git init',
      'echo "linea 1" > f.txt',
      'echo "linea 2" >> f.txt',
      'echo "linea 3" >> f.txt',
      'echo "linea 4" >> f.txt',
      'echo "linea 5" >> f.txt',
      'git add .',
      'git commit -m "base"',
    ).world;
    const { world, last } = run(
      w0,
      'git switch -c otra',
      'echo "linea 1" > f.txt',
      'echo "linea 2" >> f.txt',
      'echo "linea 3" >> f.txt',
      'echo "linea 4" >> f.txt',
      'echo "linea 5 (otra)" >> f.txt',
      'git commit -am "cambia el final"',
      'git switch main',
      'echo "linea 1 (main)" > f.txt',
      'echo "linea 2" >> f.txt',
      'echo "linea 3" >> f.txt',
      'echo "linea 4" >> f.txt',
      'echo "linea 5" >> f.txt',
      'git commit -am "cambia el inicio"',
      'git merge otra',
    );
    expect(last.ok).toBe(true);
    expect(world.files['f.txt']).toBe('linea 1 (main)\nlinea 2\nlinea 3\nlinea 4\nlinea 5 (otra)\n');
  });

  it('conflicto: marca el archivo y se resuelve con add + commit', () => {
    const w0 = run(
      fresh(),
      'git init',
      'echo "color: azul" > tema.txt',
      'git add .',
      'git commit -m "base"',
      'git switch -c rojo',
      'echo "color: rojo" > tema.txt',
      'git commit -am "rojo"',
      'git switch main',
      'echo "color: verde" > tema.txt',
      'git commit -am "verde"',
    ).world;
    const merged = run(w0, 'git merge rojo');
    expect(merged.last.ok).toBe(false);
    expect(merged.text).toContain('CONFLICTO');
    expect(merged.world.files['tema.txt']).toContain('<<<<<<< main');
    expect(merged.world.files['tema.txt']).toContain('color: rojo');
    expect(merged.world.files['tema.txt']).toContain('>>>>>>> rojo');
    expect(merged.world.repo!.merge?.conflicts).toEqual(['tema.txt']);

    const status = run(merged.world, 'git status');
    expect(status.text).toContain('ambos modificados');

    const early = run(merged.world, 'git commit -m "intento"');
    expect(early.last.ok).toBe(false);

    const fixed = run(
      merged.world,
      'echo "color: verde y rojo" > tema.txt',
      'git add tema.txt',
      'git commit -m "Resuelvo el conflicto"',
    );
    expect(fixed.last.ok).toBe(true);
    expect(fixed.world.repo!.merge).toBeNull();
    expect(world(fixed).commits[headId(fixed.world.repo!)!].parents).toHaveLength(2);
    expect(fixed.world.files['tema.txt']).toBe('color: verde y rojo\n');
  });

  it('merge --abort deja todo como estaba', () => {
    const w0 = run(
      fresh(),
      'git init',
      'echo "a" > t.txt',
      'git add .',
      'git commit -m "base"',
      'git switch -c b',
      'echo "b" > t.txt',
      'git commit -am "b"',
      'git switch main',
      'echo "c" > t.txt',
      'git commit -am "c"',
      'git merge b',
      'git merge --abort',
    ).world;
    expect(w0.repo!.merge).toBeNull();
    expect(w0.files['t.txt']).toBe('c\n');
  });

  it('no deja borrar una rama sin fusionar, pero sí una fusionada', () => {
    const w0 = run(base(), 'git switch -c idea', 'echo x > x.txt', 'git add .', 'git commit -m "x"', 'git switch main').world;
    const noMerged = run(w0, 'git branch -d idea');
    expect(noMerged.last.ok).toBe(false);
    expect(noMerged.text).toContain('-D');
    const merged = run(w0, 'git merge idea', 'git branch -d idea');
    expect(merged.last.ok).toBe(true);
    expect(merged.world.repo!.branches.idea).toBeUndefined();
  });

  it('cambiar de rama con cambios pendientes que chocan se bloquea', () => {
    const w0 = run(
      base(),
      'git switch -c idea',
      'echo "idea" > a.txt',
      'git commit -am "idea"',
      'git switch main',
      'echo "sin guardar" > a.txt',
    ).world;
    const { last, text } = run(w0, 'git switch idea');
    expect(last.ok).toBe(false);
    expect(text).toContain('sobrescritos');
  });

  it('checkout de un commit deja HEAD desacoplado', () => {
    const w0 = run(base(), 'echo 2 >> a.txt', 'git commit -am "dos"').world;
    const { world } = run(w0, 'git checkout HEAD~1');
    expect(world.repo!.head.kind).toBe('detached');
    expect(world.files['a.txt']).toBe('a\n');
  });
});

describe('stash y etiquetas', () => {
  const base = () =>
    run(fresh(), 'git init', 'echo "a" > a.txt', 'git add .', 'git commit -m "inicio"').world;

  it('stash guarda y pop recupera', () => {
    const w0 = run(base(), 'echo "trabajo a medias" >> a.txt').world;
    const saved = run(w0, 'git stash');
    expect(saved.world.files['a.txt']).toBe('a\n');
    expect(saved.world.repo!.stash).toHaveLength(1);
    const back = run(saved.world, 'git stash pop');
    expect(back.world.files['a.txt']).toBe('a\ntrabajo a medias\n');
    expect(back.world.repo!.stash).toHaveLength(0);
  });

  it('stash sin cambios avisa', () => {
    const { last, text } = run(base(), 'git stash');
    expect(last.ok).toBe(false);
    expect(text).toContain('No hay cambios');
  });

  it('tag crea y lista', () => {
    const { text, world } = run(base(), 'git tag v1.0', 'git tag');
    expect(text).toBe('v1.0');
    expect(world.repo!.tags['v1.0']).toBe(headId(world.repo!));
  });
});

describe('remoto: clone, push, pull', () => {
  const URL = 'https://github.com/tu-usuario/mi-proyecto.git';

  function withServer(): World {
    const w = createWorld({ cwd: 'proyecto' });
    w.servers[URL] = { branches: {}, tags: {} };
    return w;
  }

  it('push a un repositorio vacío con -u', () => {
    const { world, last, text } = run(
      withServer(),
      'git init',
      'echo "hola" > a.txt',
      'git add .',
      'git commit -m "inicio"',
      `git remote add origin ${URL}`,
      'git push -u origin main',
    );
    expect(last.ok).toBe(true);
    expect(text).toContain('nueva rama');
    expect(world.servers[URL].branches.main).toBe(headId(world.repo!));
    expect(world.repo!.upstream.main).toBe('origin/main');
  });

  it('push sin upstream explica qué hacer', () => {
    const { last, text } = run(
      withServer(),
      'git init',
      'echo a > a.txt',
      'git add .',
      'git commit -m "x"',
      `git remote add origin ${URL}`,
      'git push',
    );
    expect(last.ok).toBe(false);
    expect(text).toContain('--set-upstream origin main');
  });

  it('push a una dirección que no existe falla', () => {
    const { last, text } = run(
      withServer(),
      'git init',
      'echo a > a.txt',
      'git add .',
      'git commit -m "x"',
      'git remote add origin https://github.com/nadie/nada.git',
      'git push -u origin main',
    );
    expect(last.ok).toBe(false);
    expect(text).toContain('no encontrado');
  });

  it('push rechazado si el remoto tiene cambios nuevos; pull y push después funciona', () => {
    let w = run(
      withServer(),
      'git init',
      'echo "hola" > a.txt',
      'git add .',
      'git commit -m "inicio"',
      `git remote add origin ${URL}`,
      'git push -u origin main',
    ).world;
    // Ana sube un cambio por su lado
    const server = w.servers[URL];
    const tip = server.branches.main;
    const c = makeCommit(w, 'Ana agrega recetas', [tip], { ...w.commits[tip].tree, 'ana.txt': 'receta\n' }, 'Ana <ana@correo.com>');
    server.branches.main = c.id;

    // Yo hago un commit local distinto
    w = run(w, 'echo "mio" > mio.txt', 'git add .', 'git commit -m "algo mío"').world;
    const rejected = run(w, 'git push');
    expect(rejected.last.ok).toBe(false);
    expect(rejected.text).toContain('rechazado');
    expect(rejected.world.servers[URL].branches.main).toBe(c.id);

    const pulled = run(rejected.world, 'git pull');
    expect(pulled.last.ok).toBe(true);
    expect(pulled.world.files['ana.txt']).toBe('receta\n');
    expect(pulled.world.files['mio.txt']).toBe('mio\n');

    const pushed = run(pulled.world, 'git push');
    expect(pushed.last.ok).toBe(true);
    expect(pushed.world.servers[URL].branches.main).toBe(headId(pushed.world.repo!));
  });

  it('status avisa cuando vas adelantado y fetch trae lo nuevo sin tocar archivos', () => {
    let w = run(
      withServer(),
      'git init',
      'echo "hola" > a.txt',
      'git add .',
      'git commit -m "inicio"',
      `git remote add origin ${URL}`,
      'git push -u origin main',
      'echo "dos" >> a.txt',
      'git commit -am "dos"',
    ).world;
    expect(run(w, 'git status').text).toContain('adelantada');

    const tip = w.servers[URL].branches.main;
    const c = makeCommit(w, 'Ana', [tip], { ...w.commits[tip].tree, 'ana.txt': 'x\n' }, 'Ana <ana@correo.com>');
    w.servers[URL].branches.main = c.id;
    const fetched = run(w, 'git fetch');
    expect(fetched.text).toContain('origin/main');
    expect(fetched.world.files['ana.txt']).toBeUndefined();
    expect(run(fetched.world, 'git status').text).toContain('divergido');
  });

  it('clone trae archivos e historial', () => {
    const w = createWorld({ cwd: 'proyecto' });
    const c = makeCommit(w, 'Receta inicial', [], { 'receta.txt': 'huevos\n' }, 'Ana <ana@correo.com>');
    w.servers['https://github.com/ana/recetas.git'] = { branches: { main: c.id }, tags: {} };
    const { world, last } = run(w, 'git clone https://github.com/ana/recetas.git');
    expect(last.ok).toBe(true);
    expect(world.files['receta.txt']).toBe('huevos\n');
    expect(world.cwd).toBe('recetas');
    expect(world.repo!.upstream.main).toBe('origin/main');
    expect(run(world, 'git status').text).toContain('actualizada');
  });
});

describe('mensajes de ayuda', () => {
  it('comando git mal escrito sugiere el correcto', () => {
    const { text, last } = run(fresh(), 'git init', 'git comit -m "x"');
    expect(last.ok).toBe(false);
    expect(text).toContain('commit');
  });

  it('comando desconocido orienta', () => {
    const { text, last } = run(fresh(), 'hola');
    expect(last.ok).toBe(false);
    expect(text).toContain('help');
  });

  it('un comando que falla no cambia el mundo', () => {
    const w0 = run(fresh(), 'git init', 'echo a > a.txt').world;
    const { world } = run(w0, 'git commit -m "nada"');
    expect(world).toEqual(w0);
  });
});

function world(r: { world: World }) {
  return r.world;
}
