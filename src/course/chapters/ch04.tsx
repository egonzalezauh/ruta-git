import { createWorld, isAncestor } from '../../engine';
import { script } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

function makeWorld() {
  let w = createWorld({ cwd: 'mi-sitio' });
  w = script(w, [
    'git init',
    'echo "Bienvenidos a mi sitio" > portada.txt',
    'git add .',
    'git commit -m "Portada inicial"',
    'echo "Contacto: pronto" > contacto.txt',
    'git add .',
    'git commit -m "Agrego contacto"',
  ]);
  return w;
}

export const ch04: Chapter = {
  id: 4,
  kind: 'lesson',
  title: 'Ramas',
  tagline: 'Prueba ideas sin romper nada y únelas después.',
  minutes: 12,
  makeWorld,
  recap: [
    { cmd: 'git branch', desc: 'ver tus ramas' },
    { cmd: 'git switch -c nombre', desc: 'crear una rama y cambiarte a ella' },
    { cmd: 'git switch nombre', desc: 'moverte entre ramas' },
    { cmd: 'git merge nombre', desc: 'unir una rama con la actual' },
    { cmd: 'git branch -d nombre', desc: 'borrar una rama ya unida' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Universos paralelos',
      body: (
        <>
          <p>
            Imagina que quieres probar un cambio arriesgado en tu sitio web, pero sin tocar la versión que ya
            funciona. Para eso existen las <Term k="rama">ramas</Term>.
          </p>
          <Callout title="En el mapa de metro">
            Una rama es una <b>línea nueva</b> que sale de la principal. Puedes avanzar por ella sin afectar a la
            otra, y cuando la idea funciona, la unes en un <b>transbordo</b>.
          </Callout>
        </>
      ),
    },
    {
      id: 'listar',
      title: 'Mira en qué rama estás',
      body: (
        <p>
          <Cmd>git branch</Cmd> lista las ramas. La que tiene un <b>*</b> es en la que estás.
        </p>
      ),
      suggest: ['git branch'],
      check: ({ ran }) => ran(/^git branch\s*$/),
      solution: ['git branch'],
      done: (
        <p>
          Solo existe <Term k="main">main</Term>, la línea principal. Todos los proyectos empiezan con una.
        </p>
      ),
    },
    {
      id: 'crear',
      title: 'Crea una rama para tu idea',
      body: (
        <p>
          Con <Cmd>git switch -c idea-colores</Cmd> creas la rama <b>idea-colores</b> y te cambias a ella en un solo
          paso.
        </p>
      ),
      suggest: ['git switch -c idea-colores'],
      check: ({ world }) =>
        !!world.repo && world.repo.head.kind === 'branch' && world.repo.head.name === 'idea-colores',
      solution: ['git switch -c idea-colores'],
      done: (
        <p>
          En el mapa aparece una etiqueta nueva y «Estás aquí» ahora está sobre <b>idea-colores</b>. Es la misma
          historia, pero tu próximo commit irá solo a esta rama.
        </p>
      ),
    },
    {
      id: 'cambio',
      title: 'Prueba tu idea',
      body: (
        <p>
          Agrega una línea a la portada con <Cmd>echo "Color de fondo: azul" &gt;&gt; portada.txt</Cmd>.
        </p>
      ),
      suggest: ['echo "Color de fondo: azul" >> portada.txt'],
      check: ({ world }) => world.files['portada.txt']?.includes('azul') ?? false,
      solution: ['echo "Color de fondo: azul" >> portada.txt'],
    },
    {
      id: 'commit',
      title: 'Guárdala en esta rama',
      body: (
        <p>
          Haz el commit como siempre: <Cmd>git commit -am "Pruebo un fondo azul"</Cmd>.
        </p>
      ),
      suggest: ['git commit -am "Pruebo un fondo azul"'],
      check: ({ world }) => {
        const b = world.repo?.branches;
        return !!b && !!b['idea-colores'] && b['idea-colores'] !== b.main;
      },
      solution: ['git commit -am "Pruebo un fondo azul"'],
      done: (
        <p>
          Mira el mapa: la línea nueva avanzó una estación y <b>main</b> se quedó donde estaba. Tu idea está a
          salvo y la versión principal, intacta.
        </p>
      ),
    },
    {
      id: 'volver',
      title: 'Vuelve a la línea principal',
      body: (
        <p>
          Cambia a main con <Cmd>git switch main</Cmd> y mira «Tu carpeta» y la portada.
        </p>
      ),
      suggest: ['git switch main'],
      check: ({ world }) => !!world.repo && world.repo.head.kind === 'branch' && world.repo.head.name === 'main',
      solution: ['git switch main'],
      done: (
        <p>
          El archivo volvió a como estaba: sin el fondo azul. Cada rama tiene su propia versión de los archivos y
          Git los cambia por ti al moverte.
        </p>
      ),
    },
    {
      id: 'main-avanza',
      title: 'Mientras tanto, main también avanza',
      body: (
        <p>
          En un proyecto real, el equipo sigue trabajando. Actualiza el contacto en main:{' '}
          <Cmd>echo "Contacto: hola@sitio.com" &gt; contacto.txt</Cmd> y guárdalo con{' '}
          <Cmd>git commit -am "Actualizo el contacto"</Cmd>.
        </p>
      ),
      suggest: ['echo "Contacto: hola@sitio.com" > contacto.txt', 'git commit -am "Actualizo el contacto"'],
      check: ({ world, before }) =>
        world.repo?.branches.main !== before.repo?.branches.main && world.repo?.head.kind === 'branch',
      solution: ['echo "Contacto: hola@sitio.com" > contacto.txt', 'git commit -am "Actualizo el contacto"'],
      done: (
        <p>
          Ahora las dos líneas tienen novedades distintas: cada una avanzó por su lado. Es lo normal cuando hay
          varias personas.
        </p>
      ),
    },
    {
      id: 'merge',
      title: 'Une la idea con la principal',
      body: (
        <p>
          Ya estás en main. Para traer los cambios de la otra rama usa <Cmd>git merge idea-colores</Cmd>.
        </p>
      ),
      suggest: ['git merge idea-colores'],
      check: ({ world }) => {
        const b = world.repo?.branches;
        return !!b && !!b['idea-colores'] && isAncestor(world, b['idea-colores'], b.main);
      },
      solution: ['git merge idea-colores'],
      done: (
        <p>
          ¡Un <b>transbordo</b>! Las dos líneas se juntan en un commit de fusión (con doble anillo en el mapa).
          Git combinó los cambios de portada y contacto sin que tuvieras que hacer nada.
        </p>
      ),
    },
    {
      id: 'borrar',
      title: 'Limpia la rama que ya cumplió',
      body: (
        <p>
          Una vez unida, la rama sobra. Bórrala con <Cmd>git branch -d idea-colores</Cmd>. No pierdes nada: sus
          cambios ya están en main.
        </p>
      ),
      suggest: ['git branch -d idea-colores'],
      check: ({ world }) => !!world.repo && world.repo.branches['idea-colores'] === undefined,
      solution: ['git branch -d idea-colores'],
      done: <p>La línea sigue dibujada en el mapa porque es parte de la historia, pero ya no hay etiqueta.</p>,
    },
    {
      id: 'reto',
      title: 'Reto: tu propia rama',
      body: (
        <>
          <p>
            Crea una rama llamada <b>menu</b>, agrega un archivo <b>menu.txt</b> con lo que quieras, guárdalo y
            únelo a <b>main</b>.
          </p>
          <p>Al terminar deberías estar en main y ver menu.txt en «Historial».</p>
        </>
      ),
      hint: (
        <>
          <Cmd>git switch -c menu</Cmd>, luego <Cmd>echo "Inicio, Contacto" &gt; menu.txt</Cmd>,{' '}
          <Cmd>git add .</Cmd>, <Cmd>git commit -m "Agrego el menú"</Cmd>, <Cmd>git switch main</Cmd> y{' '}
          <Cmd>git merge menu</Cmd>.
        </>
      ),
      check: ({ world }) =>
        !!world.repo &&
        world.repo.head.kind === 'branch' &&
        world.repo.head.name === 'main' &&
        world.commits[world.repo.branches.main]?.tree['menu.txt'] !== undefined,
      solution: [
        'git switch -c menu',
        'echo "Inicio, Contacto" > menu.txt',
        'git add .',
        'git commit -m "Agrego el menú"',
        'git switch main',
        'git merge menu',
      ],
      done: <p>Ese es el ciclo de trabajo de casi todos los proyectos: rama, cambio, commit y fusión.</p>,
    },
  ],
};
