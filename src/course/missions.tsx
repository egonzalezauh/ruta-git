import { ancestors, createWorld, hasConflictMarkers, statusInfo, type World } from '../engine';
import { addServer, branchCommit, script, serverCommit } from '../engine/scenario';
import { merged } from './runner';
import type { Mission } from './types';

const treeAtBranch = (w: World, branch: string) => {
  const tip = w.repo?.branches[branch];
  return tip ? w.commits[tip]?.tree : undefined;
};

const serverTree = (w: World, url: string, branch: string) => {
  const tip = w.servers[url]?.branches[branch];
  return tip ? w.commits[tip]?.tree : undefined;
};

/* ------------------------------------------------------------------ */
/* Misión 1: El archivo fugitivo                                       */
/* ------------------------------------------------------------------ */

export const m11: Mission = {
  id: 11,
  kind: 'mission',
  title: 'El archivo fugitivo',
  tagline: 'Recupera lo que se perdió, sin romper lo demás.',
  minutes: 6,
  par: 3,
  makeWorld: () =>
    script(createWorld({ cwd: 'tesis' }), [
      'git init',
      'echo "Capítulo 1: Introducción" > capitulo1.txt',
      'echo "Capítulo 2: Método" > capitulo2.txt',
      'echo "Bibliografía: 12 fuentes" > biblio.txt',
      'git add .',
      'git commit -m "Primera entrega"',
      'echo "Capítulo 1: Introducción (revisada)" > capitulo1.txt',
      'git commit -am "Reviso la introducción"',
      'rm biblio.txt',
      'git commit -am "Limpieza de archivos"',
      'echo "Capítulo 2: borrar todo y empezar" > capitulo2.txt',
      'git commit -am "Reescribo el método"',
    ]),
  story: (
    <>
      <p>
        Es la noche antes de entregar tu tesis. Limpiaste la carpeta con prisa y, al revisar, descubres{' '}
        <b>dos desastres</b>: la bibliografía desapareció y, sin querer, reescribiste el capítulo del método.
      </p>
      <p>Por suerte, tu tesis vive en un repositorio. Arréglalo todo antes de dormir.</p>
    </>
  ),
  objectives: [
    {
      id: 'biblio',
      text: 'El archivo biblio.txt vuelve a existir, con sus 12 fuentes, y queda guardado en la historia.',
      check: (w) => treeAtBranch(w, 'main')?.['biblio.txt']?.includes('12 fuentes') ?? false,
    },
    {
      id: 'metodo',
      text: 'capitulo2.txt recupera el método original y queda guardado.',
      check: (w) => treeAtBranch(w, 'main')?.['capitulo2.txt'] === 'Capítulo 2: Método\n',
    },
    {
      id: 'intro',
      text: 'La introducción revisada (capitulo1.txt) se conserva.',
      check: (w) => treeAtBranch(w, 'main')?.['capitulo1.txt']?.includes('revisada') ?? false,
    },
    {
      id: 'limpio',
      text: 'No queda nada pendiente de guardar.',
      check: (w) => !!w.repo && statusInfo(w).clean,
    },
    {
      id: 'historia',
      text: 'La historia sigue completa: ningún commit fue borrado.',
      bonus: true,
      check: (w) => {
        const tip = w.repo?.branches.main;
        if (!tip) return false;
        const msgs = [...ancestors(w, tip)].map((id) => w.commits[id].message);
        return msgs.includes('Reescribo el método') && msgs.includes('Limpieza de archivos');
      },
    },
  ],
  solution: ['git checkout HEAD~2 -- biblio.txt capitulo2.txt', 'git commit -m "Recupero archivos"'],
  debrief: (
    <p>
      Practicaste <b>recuperar archivos de versiones anteriores</b> sin borrar la historia: el pasado siempre está
      a un comando de distancia.
    </p>
  ),
};

/* ------------------------------------------------------------------ */
/* Misión 2: Dos cocineros                                             */
/* ------------------------------------------------------------------ */

const SOPA_ANA = 'Sopa de verduras\nIngredientes:\n- zanahoria\n- ajo\n- cebolla\nSal: al gusto y pimienta negra\n';
const SOPA_LUIS = 'Sopa de verduras\nIngredientes:\n- zanahoria\n- cebolla\n- tomillo\nSal: sin sal\n';

export const m12: Mission = {
  id: 12,
  kind: 'mission',
  title: 'Dos cocineros, una receta',
  tagline: 'Une el trabajo de los dos. Luis siempre trae sorpresas.',
  minutes: 8,
  par: 8,
  makeWorld: () => {
    let w = script(createWorld({ cwd: 'recetario' }), [
      'git init',
      'echo "Sopa de verduras" > sopa.txt',
      'echo "Ingredientes:" >> sopa.txt',
      'echo "- zanahoria" >> sopa.txt',
      'echo "- cebolla" >> sopa.txt',
      'echo "Sal: al gusto" >> sopa.txt',
      'git add .',
      'git commit -m "Receta base de sopa"',
      'git branch ana-pimienta',
      'git branch luis-postre',
    ]);
    w = branchCommit(w, 'ana-pimienta', { 'sopa.txt': SOPA_ANA }, 'Agrego ajo y pimienta', 'Ana <ana@correo.com>');
    w = branchCommit(w, 'luis-postre', { 'postre.txt': 'Postre: fruta de temporada\n' }, 'Agrego un postre');
    w = script(w, [
      'echo "Sopa de verduras" > sopa.txt',
      'echo "Ingredientes:" >> sopa.txt',
      'echo "- zanahoria" >> sopa.txt',
      'echo "- cebolla" >> sopa.txt',
      'echo "Sal: una pizca" >> sopa.txt',
      'git commit -am "Pongo menos sal"',
    ]);
    return w;
  },
  story: (
    <>
      <p>
        Ana y Luis cocinan contigo en el recetario. Ana quiere <b>ajo y pimienta</b> en la sopa; Luis, un{' '}
        <b>postre</b> y su toque especial. Cada uno trabajó en su rama. Tú cuidas la receta principal.
      </p>
      <p>Hoy te toca unirlo todo en main. Y ojo: Luis nunca llega sin sorpresas.</p>
    </>
  ),
  objectives: [
    {
      id: 'ana',
      text: 'La rama ana-pimienta está unida a main.',
      check: (w) => merged(w, 'ana-pimienta', 'main'),
    },
    {
      id: 'luis',
      text: 'La rama luis-postre está unida a main, con todo lo que Luis tenga.',
      check: (w) => merged(w, 'luis-postre', 'main'),
    },
    {
      id: 'marcas',
      text: 'Ningún archivo conserva marcas de conflicto y no hay una fusión a medias.',
      check: (w) => !!w.repo && !w.repo.merge && !Object.values(w.files).some(hasConflictMarkers),
    },
    {
      id: 'sopa',
      text: 'La sopa final lleva el ajo y la pimienta de Ana y el tomillo de Luis.',
      check: (w) => {
        const s = treeAtBranch(w, 'main')?.['sopa.txt'] ?? '';
        return s.includes('- ajo') && s.includes('pimienta') && s.includes('tomillo');
      },
    },
    {
      id: 'limpio',
      text: 'Todo está guardado: la carpeta no tiene cambios pendientes.',
      check: (w) => !!w.repo && statusInfo(w).clean,
    },
    {
      id: 'pizca',
      text: 'La sopa conserva tu decisión original: «una pizca» de sal.',
      bonus: true,
      check: (w) => treeAtBranch(w, 'main')?.['sopa.txt']?.includes('una pizca') ?? false,
    },
  ],
  events: [
    {
      id: 'luis-sopa',
      when: ({ world }) => merged(world, 'ana-pimienta', 'main'),
      run: (w) =>
        branchCommit(w, 'luis-postre', { 'sopa.txt': SOPA_LUIS }, 'Pongo tomillo y quito la sal'),
      message:
        'Novedad: Luis acaba de agregar tomillo a la sopa en su rama luis-postre... ¡y también tocó la línea de la sal!',
    },
  ],
  solution: [
    'git merge ana-pimienta',
    'echo "Sopa de verduras" > sopa.txt',
    'echo "Ingredientes:" >> sopa.txt',
    'echo "- zanahoria" >> sopa.txt',
    'echo "- ajo" >> sopa.txt',
    'echo "- cebolla" >> sopa.txt',
    'echo "Sal: una pizca y pimienta negra" >> sopa.txt',
    'git add sopa.txt',
    'git commit -m "Uno la sopa de Ana"',
    'git merge luis-postre',
    'echo "Sopa de verduras" > sopa.txt',
    'echo "Ingredientes:" >> sopa.txt',
    'echo "- zanahoria" >> sopa.txt',
    'echo "- ajo" >> sopa.txt',
    'echo "- cebolla" >> sopa.txt',
    'echo "- tomillo" >> sopa.txt',
    'echo "Sal: una pizca y pimienta negra" >> sopa.txt',
    'git add sopa.txt',
    'git commit -m "Uno la sopa de Luis"',
  ],
  debrief: (
    <p>
      Practicaste <b>fusionar ramas con conflictos</b> y decidir qué se conserva. Un consejo: usa el editor (clic en
      el archivo) para resolver en un solo movimiento.
    </p>
  ),
};

/* ------------------------------------------------------------------ */
/* Misión 3: Rescate en la nube                                        */
/* ------------------------------------------------------------------ */

const URL13 = 'https://github.com/equipo/web-ayuda.git';

export const m13: Mission = {
  id: 13,
  kind: 'mission',
  title: 'Rescate en la nube',
  tagline: 'Corrige un error del sitio con las reglas del equipo.',
  minutes: 10,
  par: 11,
  makeWorld: () => {
    let w = addServer(createWorld({ cwd: 'rescate' }), URL13);
    w = serverCommit(w, URL13, 'main', { 'README.txt': 'Sitio de ayuda\n' }, 'Primer commit');
    w = serverCommit(
      w,
      URL13,
      'main',
      { 'index.txt': 'Bienvenido a nuestro sitoi\nAquí encontrarás ayuda.\n' },
      'Agrego la portada',
    );
    w = serverCommit(w, URL13, 'main', { 'estilos.txt': 'Fondo: blanco\n' }, 'Agrego estilos');
    return w;
  },
  story: (
    <>
      <p>
        Acabas de entrar a un equipo remoto y todavía no tienes el proyecto en tu computador. Está en{' '}
        <b>{URL13}</b>.
      </p>
      <p>
        Al revisar la web, notas que el título de bienvenida tiene un error de escritura (dice «sitoi»). Las reglas
        del equipo: <b>nadie escribe directo en main</b>; cada arreglo viaja en su propia rama con el nombre{' '}
        <b>arreglo-titulo</b>, y al final la versión debe quedar etiquetada como <b>v1.0</b>.
      </p>
    </>
  ),
  objectives: [
    {
      id: 'clon',
      text: 'Tienes una copia del proyecto en tu computador, conectada al servidor.',
      check: (w) => !!w.repo && !!w.repo.remotes.origin,
    },
    {
      id: 'rama',
      text: 'El arreglo viaja en la rama arreglo-titulo, publicada en el servidor, con el título corregido.',
      check: (w) => {
        const t = serverTree(w, URL13, 'arreglo-titulo')?.['index.txt'] ?? '';
        return t.includes('sitio') && !t.includes('sitoi');
      },
    },
    {
      id: 'main-arreglo',
      text: 'La rama main del servidor ya tiene el título corregido.',
      check: (w) => {
        const t = serverTree(w, URL13, 'main')?.['index.txt'] ?? '';
        return t.includes('sitio') && !t.includes('sitoi');
      },
    },
    {
      id: 'main-ana',
      text: 'La rama main del servidor conserva lo que Ana publicó mientras tanto.',
      check: (w) => serverTree(w, URL13, 'main')?.['contacto.txt'] !== undefined,
    },
    {
      id: 'tag',
      text: 'La versión v1.0 está publicada en el servidor, sobre el main final.',
      check: (w) => {
        const s = w.servers[URL13];
        return !!s && !!s.tags['v1.0'] && s.tags['v1.0'] === s.branches.main;
      },
    },
    {
      id: 'sync',
      text: 'Tu computador y el servidor quedaron idénticos en main.',
      bonus: true,
      check: (w) => !!w.repo && w.repo.branches.main !== undefined && w.repo.branches.main === w.servers[URL13]?.branches.main,
    },
  ],
  events: [
    {
      id: 'ana-contacto',
      when: ({ world }) => !!world.servers[URL13]?.branches['arreglo-titulo'],
      run: (w) =>
        serverCommit(w, URL13, 'main', { 'contacto.txt': 'Escríbenos a ayuda@equipo.com\n' }, 'Agrego la página de contacto'),
      message: 'Novedad: mientras subías tu arreglo, Ana publicó la página de contacto directamente en main.',
    },
  ],
  solution: [
    `git clone ${URL13}`,
    'git switch -c arreglo-titulo',
    'echo "Bienvenido a nuestro sitio" > index.txt',
    'echo "Aquí encontrarás ayuda." >> index.txt',
    'git commit -am "Corrijo el título"',
    'git push -u origin arreglo-titulo',
    'git switch main',
    'git pull',
    'git merge arreglo-titulo',
    'git push',
    'git tag v1.0',
    'git push --tags',
  ],
  debrief: (
    <p>
      Practicaste el ciclo completo de equipo: <b>clonar, rama, publicar, integrar, etiquetar</b>, y manejar que
      alguien más se adelante.
    </p>
  ),
};

/* ------------------------------------------------------------------ */
/* Misión 4: El gran lanzamiento                                       */
/* ------------------------------------------------------------------ */

const URL14 = 'https://github.com/equipo/lanzamiento.git';

export const m14: Mission = {
  id: 14,
  kind: 'mission',
  title: 'El gran lanzamiento',
  tagline: 'Todo a la vez, sin perder nada de tu trabajo.',
  minutes: 12,
  par: 9,
  makeWorld: () => {
    let w = addServer(createWorld({ cwd: 'lanzamiento' }), URL14);
    w = script(w, [
      'git init',
      'echo "App de tareas v1" > app.txt',
      'echo "Guía rápida" > leeme.txt',
      'git add .',
      'git commit -m "Versión 1 de la app"',
      'echo "Funciones: crear y borrar tareas" >> app.txt',
      'git commit -am "Agrego crear y borrar"',
      `git remote add origin ${URL14}`,
      'git push -u origin main',
      'echo "Pantalla de login activada" >> app.txt',
      'echo "Formulario de login" > login.txt',
    ]);
    return w;
  },
  story: (
    <>
      <p>
        Es domingo de lanzamiento. Anoche empezaste a programar el <b>login</b>… pero lo hiciste directamente en{' '}
        <b>main</b> y sin guardar nada: tienes un archivo nuevo (login.txt) y un cambio en app.txt colgando.
      </p>
      <p>
        Hay que mover ese trabajo a su propia rama <b>nueva-funcion</b>, integrarlo con lo que haya hecho el
        equipo, publicar main y etiquetar la <b>v2.0</b>. Sin perder una sola línea.
      </p>
    </>
  ),
  objectives: [
    {
      id: 'rama',
      text: 'Tu trabajo nuevo está guardado en la rama nueva-funcion (login.txt y el cambio de app.txt).',
      check: (w) => {
        const t = treeAtBranch(w, 'nueva-funcion');
        return !!t && t['login.txt'] !== undefined && (t['app.txt'] ?? '').includes('login');
      },
    },
    {
      id: 'main-local',
      text: 'La función nueva está unida a main en tu computador.',
      check: (w) => merged(w, 'nueva-funcion', 'main'),
    },
    {
      id: 'hotfix',
      text: 'Tu main incluye el arreglo urgente que Ana subió a leeme.txt.',
      check: (w) => treeAtBranch(w, 'main')?.['leeme.txt']?.includes('revisada por Ana') ?? false,
    },
    {
      id: 'publicado',
      text: 'La rama main está publicada en el servidor, con el login incluido.',
      check: (w) => {
        const s = serverTree(w, URL14, 'main');
        return !!s && s['login.txt'] !== undefined && w.repo?.branches.main === w.servers[URL14]?.branches.main;
      },
    },
    {
      id: 'tag',
      text: 'La versión v2.0 está publicada en el servidor, sobre ese main.',
      check: (w) => {
        const s = w.servers[URL14];
        return !!s && !!s.tags['v2.0'] && s.tags['v2.0'] === s.branches.main;
      },
    },
    {
      id: 'limpio',
      text: 'Tu carpeta quedó limpia: nada pendiente ni archivos sueltos.',
      bonus: true,
      check: (w) => !!w.repo && statusInfo(w).clean,
    },
  ],
  events: [
    {
      id: 'ana-hotfix',
      when: ({ world }) => {
        const b = world.repo?.branches;
        return !!b && !!b['nueva-funcion'] && b['nueva-funcion'] !== b.main;
      },
      run: (w) =>
        serverCommit(w, URL14, 'main', { 'leeme.txt': 'Guía rápida (revisada por Ana)\n' }, 'Arreglo urgente de la guía'),
      message: 'Novedad: Ana publicó un arreglo urgente en main mientras terminabas tu función.',
    },
  ],
  solution: [
    'git switch -c nueva-funcion',
    'git add .',
    'git commit -m "Agrego el login"',
    'git switch main',
    'git merge nueva-funcion',
    'git push',
    'git pull',
    'git push',
    'git tag v2.0',
    'git push --tags',
  ],
  debrief: (
    <p>
      Practicaste <b>mover trabajo a una rama nueva sin perderlo</b>, integrar con un equipo que se adelanta y
      lanzar una versión. Eso es el día a día de cualquier proyecto con Git.
    </p>
  ),
};
