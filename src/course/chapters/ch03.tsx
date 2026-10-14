import { createWorld, headTree, resolveRev } from '../../engine';
import { asUser, script } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

function makeWorld() {
  let w = createWorld({ cwd: 'recetario' });
  w = script(w, [
    'git init',
    'echo "Receta: panqueques" > receta.txt',
    'echo "Ingredientes: harina, leche, huevo" >> receta.txt',
    'git add .',
    'git commit -m "Primera versión de la receta"',
    'echo "Paso 1: mezclar todo" >> receta.txt',
    'git commit -am "Agrego el primer paso"',
    'echo "Paso 2: cocinar en sartén caliente" >> receta.txt',
    'git commit -am "Agrego el segundo paso"',
  ]);
  w = asUser(w, 'Marta', [
    'echo "Receta: panqueques" > receta.txt',
    'echo "Ingredientes: harina, leche, huevo, azúcar" >> receta.txt',
    'echo "Paso 1: mezclar todo" >> receta.txt',
    'echo "Paso 2: cocinar en sartén caliente" >> receta.txt',
    'git commit -am "Agrego azúcar a los ingredientes"',
  ]);
  w = script(w, ['echo "Servir con miel" >> receta.txt', 'git commit -am "Sugerencia para servir"']);
  return w;
}

export const ch03: Chapter = {
  id: 3,
  kind: 'lesson',
  title: 'Viajar en el tiempo',
  tagline: 'Mira el historial y vuelve a versiones anteriores.',
  minutes: 8,
  makeWorld,
  recap: [
    { cmd: 'git log', desc: 'ver el historial con autor y fecha' },
    { cmd: 'git show', desc: 'ver qué cambió en un commit' },
    { cmd: 'git diff', desc: 'comparar dos momentos' },
    { cmd: 'git switch --detach', desc: 'visitar el pasado sin cambiar nada' },
    { cmd: 'git restore --source', desc: 'recuperar un archivo de una versión anterior' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'El historial es un diario',
      body: (
        <>
          <p>
            Este recetario tiene <b>5 puntos de guardado</b>. Git no solo guarda el último estado: guarda toda la
            historia, y puedes consultarla o volver a ella cuando quieras.
          </p>
          <Callout title="Los nombres para moverte">
            <Cmd>HEAD</Cmd> es donde estás ahora. <Cmd>HEAD~1</Cmd> es un guardado antes, <Cmd>HEAD~2</Cmd> dos
            antes, y así. Mira el mapa: las estaciones ya están ahí.
          </Callout>
        </>
      ),
    },
    {
      id: 'log',
      title: 'Lee la historia completa',
      body: (
        <p>
          Hasta ahora usaste <Cmd>--oneline</Cmd> para verla resumida. Prueba <Cmd>git log</Cmd> sin nada más para
          ver quién guardó cada cambio y cuándo.
        </p>
      ),
      suggest: ['git log'],
      check: ({ ran }) => ran(/^git log\b/),
      solution: ['git log'],
      done: (
        <p>
          Cada bloque tiene un identificador largo, el <b>autor</b>, la <b>fecha</b> y el mensaje. Fíjate que Marta
          también aparece: Git sabe quién hizo qué.
        </p>
      ),
    },
    {
      id: 'show',
      title: 'Mira qué cambió en un guardado',
      body: (
        <p>
          <Cmd>git show HEAD~1</Cmd> te enseña lo que cambió en el guardado anterior al actual: las líneas nuevas
          aparecen con <b>+</b>.
        </p>
      ),
      suggest: ['git show HEAD~1'],
      check: ({ ran }) => ran(/^git show\b/),
      solution: ['git show HEAD~1'],
      done: <p>Así puedes entender qué hizo cada persona, sin tener que adivinar.</p>,
    },
    {
      id: 'diff',
      title: 'Compara hoy con hace tres guardados',
      body: (
        <p>
          <Cmd>git diff HEAD~3</Cmd> compara tu receta de hoy con cómo estaba tres guardados atrás. Las líneas con{' '}
          <b>-</b> son las que ya no están.
        </p>
      ),
      suggest: ['git diff HEAD~3'],
      check: ({ ran }) => ran(/^git diff\s+\S+/),
      solution: ['git diff HEAD~3'],
    },
    {
      id: 'detach',
      title: 'Viaja al pasado',
      body: (
        <>
          <p>
            Para <i>visitar</i> un momento anterior sin cambiar nada de tu historia usa{' '}
            <Cmd>git switch --detach HEAD~3</Cmd>.
          </p>
          <p>
            Git te avisará de que estás en «HEAD desacoplado». No es un error: significa que estás mirando el pasado,
            no parado sobre una rama.
          </p>
        </>
      ),
      suggest: ['git switch --detach HEAD~3'],
      check: ({ world }) => world.repo?.head.kind === 'detached',
      solution: ['git switch --detach HEAD~3'],
      done: (
        <p>
          Mira cómo se movió el cartel «Estás aquí» en el mapa y cómo cambió el archivo en «Tu carpeta». Estás
          viendo la receta tal como era entonces.
        </p>
      ),
    },
    {
      id: 'cat',
      title: 'Lee cómo era el archivo',
      body: (
        <p>
          Escribe <Cmd>cat receta.txt</Cmd> para ver el contenido de ese momento.
        </p>
      ),
      suggest: ['cat receta.txt'],
      check: ({ ran }) => ran(/^cat\s+receta/),
      solution: ['cat receta.txt'],
      done: <p>Todavía no tenía el paso 2 ni la miel. Era una receta más corta.</p>,
    },
    {
      id: 'volver',
      title: 'Vuelve al presente',
      body: (
        <p>
          Para regresar escribe <Cmd>git switch main</Cmd>. Nada se perdió: tus puntos de guardado siguen intactos.
        </p>
      ),
      suggest: ['git switch main'],
      check: ({ world }) => world.repo?.head.kind === 'branch',
      solution: ['git switch main'],
      done: <p>De vuelta en la línea principal, con la receta completa.</p>,
    },
    {
      id: 'restore',
      title: 'Rescata solo un archivo del pasado',
      body: (
        <>
          <p>
            A veces no quieres viajar: solo quieres traer un archivo como estaba antes. Con{' '}
            <Cmd>git restore --source=HEAD~3 receta.txt</Cmd> recuperas esa versión sin mover tu historia.
          </p>
        </>
      ),
      suggest: ['git restore --source=HEAD~3 receta.txt'],
      hint: 'Después de restore va --source=HEAD~3 (sin espacios alrededor del =) y luego el nombre del archivo.',
      check: ({ world }) => {
        if (world.repo?.head.kind !== 'branch') return false;
        const id = resolveRev(world, 'HEAD~3');
        return !!id && world.files['receta.txt'] === world.commits[id].tree['receta.txt'] &&
          world.files['receta.txt'] !== headTree(world)['receta.txt'];
      },
      solution: ['git restore --source=HEAD~3 receta.txt'],
      done: (
        <p>
          En «Tu carpeta» el archivo aparece como <b>cambió</b>: es la versión antigua puesta sobre la de hoy.
        </p>
      ),
    },
    {
      id: 'guardar',
      title: 'Guarda esa decisión',
      body: (
        <p>
          Si prefieres esa versión, confírmalo con un commit:{' '}
          <Cmd>git commit -am "Vuelvo a una versión anterior"</Cmd>. La historia queda completa: el cambio es un
          punto más del mapa, no un borrado.
        </p>
      ),
      suggest: ['git commit -am "Vuelvo a una versión anterior"'],
      check: ({ world, before }) => Object.keys(world.commits).length > Object.keys(before.commits).length,
      solution: ['git commit -am "Vuelvo a una versión anterior"'],
      done: (
        <p>
          Ahora sabes <Term k="head">dónde estás</Term>, cómo mirar el pasado y cómo traer algo de vuelta. Eso es
          viajar en el tiempo con Git.
        </p>
      ),
    },
  ],
};
