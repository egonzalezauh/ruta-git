import { createWorld, hasConflictMarkers, headId } from '../../engine';
import { asUser, script, tryScript } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

function makeWorld() {
  let w = createWorld({ cwd: 'restaurante' });
  w = script(w, [
    'git init',
    'echo "Menú del día" > menu.txt',
    'echo "Sopa: tomate" >> menu.txt',
    'echo "Plato: pollo" >> menu.txt',
    'echo "Postre: flan" >> menu.txt',
    'git add .',
    'git commit -m "Menú inicial"',
    'git switch -c postre-ana',
  ]);
  w = asUser(w, 'Ana', [
    'echo "Menú del día" > menu.txt',
    'echo "Sopa: tomate" >> menu.txt',
    'echo "Plato: pollo" >> menu.txt',
    'echo "Postre: helado" >> menu.txt',
    'git commit -am "Cambio el postre a helado"',
  ]);
  w = script(w, [
    'git switch main',
    'echo "Menú del día" > menu.txt',
    'echo "Sopa: tomate" >> menu.txt',
    'echo "Plato: pollo" >> menu.txt',
    'echo "Postre: gelatina" >> menu.txt',
    'git commit -am "Cambio el postre a gelatina"',
  ]);
  return w;
}

/** Segundo conflicto, independiente del menú, para practicar cancelar una fusión. */
function secondConflict(w: Parameters<typeof tryScript>[0]) {
  let n = tryScript(w, [
    'git merge --abort',
    'git switch main',
    'echo "Plato especial" > especial.txt',
    'echo "Entrada: ensalada" >> especial.txt',
    'echo "Fondo: pollo" >> especial.txt',
    'git add especial.txt',
    'git commit -m "Agrego el plato especial"',
    'git switch -c plato-luis',
  ]);
  n = structuredClone(n);
  const prev = n.user;
  n.user = { name: 'Luis', email: 'luis@correo.com' };
  n = tryScript(n, [
    'echo "Plato especial" > especial.txt',
    'echo "Entrada: ensalada" >> especial.txt',
    'echo "Fondo: pescado" >> especial.txt',
    'git commit -am "Cambio el fondo a pescado"',
  ]);
  n.user = prev;
  return tryScript(n, [
    'git switch main',
    'echo "Plato especial" > especial.txt',
    'echo "Entrada: ensalada" >> especial.txt',
    'echo "Fondo: carne" >> especial.txt',
    'git commit -am "Cambio el fondo a carne"',
  ]);
}

export const ch05: Chapter = {
  id: 5,
  kind: 'lesson',
  title: 'Conflictos',
  tagline: 'Qué pasa cuando dos cambios chocan y cómo resolverlo.',
  minutes: 10,
  makeWorld,
  recap: [
    { cmd: 'git merge rama', desc: 'unir; si chocan, Git te avisa' },
    { cmd: 'git status', desc: 'ver qué archivos tienen conflicto' },
    { cmd: 'git add archivo', desc: 'marcar un conflicto como resuelto' },
    { cmd: 'git commit', desc: 'cerrar la fusión' },
    { cmd: 'git merge --abort', desc: 'cancelar y volver al inicio' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Dos personas, la misma línea',
      body: (
        <>
          <p>
            Ana y tú editaron la <b>misma línea</b> del menú de un restaurante, cada quien en su rama. Ana puso
            «helado» y tú «gelatina». Git puede combinar cambios en líneas distintas, pero aquí no sabe cuál
            elegir.
          </p>
          <Callout title="Un conflicto no es un error">
            Es Git diciéndote: «aquí necesito que decidas tú». Pasa en el trabajo en equipo todo el tiempo y se
            arregla en unos minutos.
          </Callout>
        </>
      ),
    },
    {
      id: 'merge',
      title: 'Provoca el conflicto',
      body: (
        <p>
          Estás en <b>main</b>. Une la rama de Ana con <Cmd>git merge postre-ana</Cmd> y mira qué pasa.
        </p>
      ),
      suggest: ['git merge postre-ana'],
      check: ({ world }) => !!world.repo?.merge,
      solution: ['git merge postre-ana'],
      done: (
        <p>
          Git unió lo que pudo y se detuvo en <b>menu.txt</b>. En «Tu carpeta» el archivo aparece como{' '}
          <b>conflicto</b>. La fusión está a medias, esperando que la termines.
        </p>
      ),
    },
    {
      id: 'status',
      title: 'Pregunta qué falta',
      body: (
        <p>
          <Cmd>git status</Cmd> te dice exactamente qué archivos tienen conflicto y qué hacer a continuación.
        </p>
      ),
      suggest: ['git status'],
      check: ({ ran }) => ran(/^git status/),
      solution: ['git status'],
      done: (
        <p>
          Fíjate en «ambos modificados»: los dos lados tocaron <b>menu.txt</b>.
        </p>
      ),
    },
    {
      id: 'cat',
      title: 'Mira el archivo',
      body: (
        <>
          <p>
            Abre el archivo con <Cmd>cat menu.txt</Cmd>. Verás unas marcas que puso Git:
          </p>
          <pre className="my-2 overflow-x-auto rounded-lg bg-wash px-3 py-2 font-mono text-[13px] text-ink">
            {`<<<<<<< main\nPostre: gelatina\n=======\nPostre: helado\n>>>>>>> postre-ana`}
          </pre>
        </>
      ),
      suggest: ['cat menu.txt'],
      check: ({ ran }) => ran(/^cat\s+menu/),
      solution: ['cat menu.txt'],
      done: (
        <p>
          Lo que está entre <Cmd>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Cmd> y <Cmd>=======</Cmd> es <b>tu versión</b>. Lo que
          está entre <Cmd>=======</Cmd> y <Cmd>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</Cmd> es la <b>de Ana</b>.
        </p>
      ),
    },
    {
      id: 'resolver',
      title: 'Decide y limpia el archivo',
      body: (
        <>
          <p>
            Ahora te toca a ti. Deja el archivo con el postre que decidan (gelatina, helado, o los dos) y{' '}
            <b>borra las tres marcas</b>.
          </p>
          <p>
            Lo más fácil: haz clic en <b>menu.txt</b> en «Tu carpeta» para abrir el editor, cambia el texto y
            guarda.
          </p>
        </>
      ),
      hint: (
        <>
          El resultado final debe quedar así, sin ninguna marca:{' '}
          <Cmd>Menú del día / Sopa: tomate / Plato: pollo / Postre: helado y gelatina</Cmd> (una línea cada uno).
        </>
      ),
      check: ({ world }) => {
        const f = world.files['menu.txt'];
        return !!f && !hasConflictMarkers(f) && f.includes('Postre');
      },
      solution: [
        'echo "Menú del día" > menu.txt',
        'echo "Sopa: tomate" >> menu.txt',
        'echo "Plato: pollo" >> menu.txt',
        'echo "Postre: helado y gelatina" >> menu.txt',
      ],
      done: <p>Eso fue lo difícil. Ahora solo falta avisarle a Git que ya está resuelto.</p>,
    },
    {
      id: 'add',
      title: 'Marca el conflicto como resuelto',
      body: (
        <p>
          Con <Cmd>git add menu.txt</Cmd> le dices a Git: «ya lo arreglé».
        </p>
      ),
      suggest: ['git add menu.txt'],
      check: ({ world }) => !!world.repo?.merge && world.repo.merge.conflicts.length === 0,
      solution: ['git add menu.txt'],
      done: <p>El archivo ya no figura en conflicto. Solo queda cerrar la fusión.</p>,
    },
    {
      id: 'commit',
      title: 'Cierra la fusión con un commit',
      body: (
        <p>
          <Cmd>git commit -m "Resuelvo el conflicto del postre"</Cmd>
        </p>
      ),
      suggest: ['git commit -m "Resuelvo el conflicto del postre"'],
      check: ({ world }) => {
        const r = world.repo;
        if (!r || r.merge) return false;
        const h = headId(r);
        return !!h && world.commits[h].parents.length === 2;
      },
      solution: ['git commit -m "Resuelvo el conflicto del postre"'],
      done: (
        <p>
          ¡Transbordo completado! Mira el mapa: las dos líneas, la tuya y la de Ana, se unen en la nueva estación
          con <Term k="merge">doble anillo</Term>.
        </p>
      ),
    },
    {
      id: 'abort',
      title: 'Y si te asustas: cancela',
      setup: secondConflict,
      setupNote:
        'Escenario nuevo: Luis y tú cambiaron la misma línea del plato especial. La rama de Luis se llama plato-luis.',
      body: (
        <>
          <p>
            Prepararon otra situación: Luis y tú cambiaron el fondo del <b>plato especial</b>. Esta vez, en vez de
            resolverlo, vas a practicar la salida de emergencia.
          </p>
          <p>
            Lanza <Cmd>git merge plato-luis</Cmd>, y cuando aparezca el conflicto, cancélalo con{' '}
            <Cmd>git merge --abort</Cmd>.
          </p>
        </>
      ),
      suggest: ['git merge plato-luis', 'git merge --abort'],
      check: ({ ran, tried, world }) => tried(/^git merge plato-luis/) && ran(/^git merge --abort/) && !world.repo?.merge,
      solution: ['git merge plato-luis', 'git merge --abort'],
      done: (
        <p>
          Todo volvió a como estaba antes de fusionar, sin consecuencias. Cancelar es siempre una opción: úsala si
          no estás seguro y pregunta a tu equipo.
        </p>
      ),
    },
  ],
};
