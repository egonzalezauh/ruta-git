import { ancestors, createWorld, headId, type World } from '../../engine';
import { script, tryScript } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

function makeWorld() {
  return script(createWorld({ cwd: 'diario' }), [
    'git init',
    'echo "Lunes: empecé el curso" > diario.txt',
    'git add .',
    'git commit -m "Entrada del lunes"',
    'echo "Martes: practiqué ramas" >> diario.txt',
    'git commit -am "Entrada del martes"',
    'echo "Miércoles: entendí los conflictos" >> diario.txt',
    'git commit -am "Entrada del miércoles"',
  ]);
}

const headMessage = (w: World) => {
  const h = w.repo ? headId(w.repo) : null;
  return h ? w.commits[h].message : '';
};

const reachableCount = (w: World) => {
  const h = w.repo ? headId(w.repo) : null;
  return h ? ancestors(w, h).size : 0;
};

/** Deja la carpeta en un estado conocido antes de armar el siguiente escenario. */
const tidy = ['git merge --abort', 'rm -f secreto.txt', 'git restore --staged .', 'git restore .'];

export const ch08: Chapter = {
  id: 8,
  kind: 'lesson',
  title: 'Deshacer errores',
  tagline: '«Me equivoqué»: cómo volver atrás y guardar a medias.',
  minutes: 10,
  makeWorld,
  recap: [
    { cmd: 'git restore archivo', desc: 'descartar cambios que no guardaste' },
    { cmd: 'git restore --staged archivo', desc: 'sacar algo del área de preparación' },
    { cmd: 'git commit --amend', desc: 'corregir el último commit' },
    { cmd: 'git revert', desc: 'deshacer un commit con otro commit' },
    { cmd: 'git stash / pop', desc: 'guardar cambios a medias en un cajón' },
    { cmd: 'git reflog', desc: 'ver todo lo que pasó, incluso lo "perdido"' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Casi todo tiene arreglo',
      body: (
        <>
          <p>
            Equivocarse es parte de trabajar. Git está pensado para que casi nada sea definitivo. La herramienta
            correcta depende de <b>en qué etapa</b> está el error:
          </p>
          <ul>
            <li>Todavía sin guardar → <Cmd>restore</Cmd></li>
            <li>Ya preparado, sin commit → <Cmd>restore --staged</Cmd></li>
            <li>Ya guardado y es el último → <Cmd>commit --amend</Cmd></li>
            <li>Ya guardado y compartido → <Cmd>revert</Cmd></li>
          </ul>
          <Callout title="Vamos con situaciones reales">
            En cada paso preparamos un pequeño desastre y tú lo arreglas.
          </Callout>
        </>
      ),
    },
    {
      id: 'restore',
      title: 'Escribiste algo que no querías',
      setup: (w) => tryScript(w, [...tidy, 'echo "BORRÓN ACCIDENTAL" > diario.txt']),
      setupNote: 'Escenario 1: sin querer pisaste tu diario con un texto que no querías. Todavía no lo guardaste.',
      body: (
        <p>
          Mira «Tu carpeta»: <b>diario.txt</b> aparece como <b>cambió</b>. Para volver a la última versión guardada:{' '}
          <Cmd>git restore diario.txt</Cmd>.
        </p>
      ),
      suggest: ['git restore diario.txt'],
      check: ({ world }) => world.files['diario.txt'] === world.commits[headId(world.repo!)!].tree['diario.txt'],
      solution: ['git restore diario.txt'],
      done: (
        <p>
          El borrón desapareció. Ojo: <Cmd>restore</Cmd> sobre cambios <i>sin guardar</i> no se puede deshacer, porque
          Git nunca los vio. Úsalo con cuidado.
        </p>
      ),
    },
    {
      id: 'unstage',
      title: 'Preparaste un archivo que no debía ir',
      setup: (w) => tryScript(w, [...tidy, 'echo "CLAVE=1234" > secreto.txt', 'git add secreto.txt']),
      setupNote: 'Escenario 2: preparaste sin querer secreto.txt, que tiene una contraseña.',
      body: (
        <p>
          Mira «Preparados»: ahí está <b>secreto.txt</b>. Sácalo de ahí, sin borrar el archivo, con{' '}
          <Cmd>git restore --staged secreto.txt</Cmd>.
        </p>
      ),
      suggest: ['git restore --staged secreto.txt'],
      check: ({ world }) => world.repo?.index['secreto.txt'] === undefined && world.files['secreto.txt'] !== undefined,
      solution: ['git restore --staged secreto.txt'],
      done: (
        <p>
          Salió del área de preparación y el archivo sigue en tu carpeta. Bien: la clave nunca llegó a un commit.
        </p>
      ),
    },
    {
      id: 'amend',
      title: 'El mensaje del commit tiene un error',
      setup: (w) =>
        tryScript(w, [...tidy, 'echo "Jueves: aprendí a deshacer" >> diario.txt', 'git commit -am "asdf"']),
      setupNote: 'Escenario 3: acabas de guardar un commit con el mensaje "asdf".',
      body: (
        <p>
          Si todavía no lo compartiste, puedes reescribir el último commit:{' '}
          <Cmd>git commit --amend -m "Entrada del jueves"</Cmd>.
        </p>
      ),
      suggest: ['git commit --amend -m "Entrada del jueves"'],
      check: ({ world, before }) =>
        headMessage(world) !== 'asdf' && reachableCount(world) === reachableCount(before),
      solution: ['git commit --amend -m "Entrada del jueves"'],
      done: (
        <p>
          El mensaje cambió y no apareció un commit extra. <b>Regla de oro:</b> <Cmd>--amend</Cmd> solo se usa con
          commits que todavía no subiste.
        </p>
      ),
    },
    {
      id: 'revert',
      title: 'Un commit ya compartido salió mal',
      setup: (w) =>
        tryScript(w, [...tidy, 'echo "Viernes: ESTO ES UN ERROR" >> diario.txt', 'git commit -am "Entrada del viernes"']),
      setupNote: 'Escenario 4: el último commit, que tu equipo ya tiene, contiene un error.',
      body: (
        <>
          <p>
            Ese commit ya lo vio todo el mundo, así que no debes borrarlo de la historia. En su lugar, creas uno
            nuevo que lo <b>deshace</b>: <Cmd>git revert HEAD</Cmd>.
          </p>
        </>
      ),
      suggest: ['git revert HEAD'],
      check: ({ world }) => headMessage(world).startsWith('Revert') && !world.files['diario.txt']?.includes('ERROR'),
      solution: ['git revert HEAD'],
      done: (
        <p>
          En el mapa hay una estación nueva que cancela a la anterior. La historia queda honesta: «hubo un error y
          lo arreglamos».
        </p>
      ),
    },
    {
      id: 'stash',
      title: 'Trabajo a medias y una urgencia',
      setup: (w) => tryScript(w, [...tidy, 'echo "Sábado: ideas a medias" >> diario.txt']),
      setupNote: 'Escenario 5: tienes cambios sin terminar y necesitas dejar la carpeta limpia.',
      body: (
        <>
          <p>
            Tienes cosas a medias, pero alguien te pide revisar otra cosa urgente. No quieres guardar un commit
            incompleto. Mételas en el <Term k="stash">cajón</Term>: <Cmd>git stash</Cmd>.
          </p>
        </>
      ),
      suggest: ['git stash'],
      check: ({ world }) => (world.repo?.stash.length ?? 0) > 0 && !world.files['diario.txt']?.includes('ideas a medias'),
      solution: ['git stash'],
      done: <p>Tu carpeta volvió a estar limpia. Los cambios están a salvo en el cajón.</p>,
    },
    {
      id: 'pop',
      title: 'Saca lo que guardaste',
      body: (
        <p>
          Cuando termines lo urgente, recupéralo con <Cmd>git stash pop</Cmd>.
        </p>
      ),
      suggest: ['git stash pop'],
      check: ({ world }) => (world.repo?.stash.length ?? 1) === 0 && !!world.files['diario.txt']?.includes('ideas a medias'),
      solution: ['git stash pop'],
      done: <p>De vuelta, tal como estaba. Cada <Cmd>stash</Cmd> es como un cajón: puedes tener varios.</p>,
    },
    {
      id: 'reset',
      title: 'El accidente a propósito',
      setup: (w) =>
        tryScript(w, [
          ...tidy,
          'git commit -am "Sábado: ideas a medias"',
          'echo "Domingo: descansé" >> diario.txt',
          'git commit -am "Entrada del domingo"',
        ]),
      setupNote: 'Preparamos un par de commits más para que veas qué pasa al retroceder.',
      body: (
        <>
          <p>
            Ahora vas a "perder" dos commits a propósito:{' '}
            <Cmd>git reset --hard HEAD~2</Cmd> mueve tu rama dos guardados atrás y descarta lo que había después.
          </p>
          <Callout tone="warn" title="Este es el comando más peligroso">
            <Cmd>--hard</Cmd> descarta cambios sin preguntar. Úsalo solo cuando estés seguro… o cuando sepas el truco
            del siguiente paso.
          </Callout>
        </>
      ),
      suggest: ['git reset --hard HEAD~2'],
      check: ({ tried, world }) => tried(/^git reset --hard/) && headMessage(world) !== 'Entrada del domingo',
      solution: ['git reset --hard HEAD~2'],
      done: <p>Mira el mapa: tu rama retrocedió y los commits "desaparecieron". Pero no se perdieron.</p>,
    },
    {
      id: 'reflog',
      title: 'Nada se pierde del todo',
      body: (
        <p>
          <Cmd>git reflog</Cmd> es el diario de todo lo que hizo tu <Term k="head">HEAD</Term>, incluso lo que ya no
          aparece en el historial.
        </p>
      ),
      suggest: ['git reflog'],
      check: ({ ran }) => ran(/^git reflog/),
      solution: ['git reflog'],
      done: (
        <p>
          Ahí está tu «Entrada del domingo» con una posición: <Cmd>HEAD@&#123;1&#125;</Cmd> es «un movimiento antes de
          ahora».
        </p>
      ),
    },
    {
      id: 'recover',
      title: 'Recupera lo "perdido"',
      body: (
        <p>
          Vuelve a donde estabas con <Cmd>git reset --hard HEAD@&#123;1&#125;</Cmd>.
        </p>
      ),
      suggest: ['git reset --hard HEAD@{1}'],
      check: ({ world }) => headMessage(world) === 'Entrada del domingo',
      solution: ['git reset --hard HEAD@{1}'],
      done: (
        <p>
          Recuperado. Mientras no hayas hecho nada más, casi siempre puedes volver con <Cmd>reflog</Cmd>. Con esto
          ya no hay error de Git que te asuste.
        </p>
      ),
    },
  ],
};
