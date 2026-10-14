import { createWorld, headTree, statusInfo } from '../../engine';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

export const ch02: Chapter = {
  id: 2,
  kind: 'lesson',
  title: 'Tu primer repositorio',
  tagline: 'Crea uno desde cero y guarda tu primer cambio.',
  minutes: 10,
  makeWorld: () => createWorld({ cwd: 'mi-proyecto' }),
  recap: [
    { cmd: 'git init', desc: 'convertir una carpeta en repositorio' },
    { cmd: 'git status', desc: 'ver en qué estado está todo' },
    { cmd: 'git add', desc: 'preparar archivos para guardarlos' },
    { cmd: 'git commit -m "…"', desc: 'guardar un punto con un mensaje' },
    { cmd: 'git diff', desc: 'ver qué cambió exactamente' },
    { cmd: 'git log --oneline', desc: 'repasar la historia' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Una carpeta con memoria',
      body: (
        <>
          <p>
            Delante tienes una carpeta vacía llamada <b>mi-proyecto</b>. Una carpeta normal no recuerda nada: si
            cambias un archivo, lo de antes se pierde. Vamos a convertirla en un{' '}
            <Term k="repositorio">repositorio</Term>.
          </p>
          <Callout title="Guardar en Git es como sacar una foto">
            Primero eliges quién sale en la foto (<b>preparas</b> los archivos) y después disparas (
            <b>haces un commit</b>). Arriba a la derecha ves ese recorrido: Tu carpeta → Preparados → Historial.
          </Callout>
        </>
      ),
    },
    {
      id: 'init',
      title: 'Activa la memoria',
      body: (
        <p>
          Escribe <Cmd>git init</Cmd> en la terminal y presiona Enter. Solo hay que hacerlo una vez por proyecto.
        </p>
      ),
      suggest: ['git init'],
      hint: 'Son dos palabras: git, un espacio, init. Después presiona Enter.',
      check: ({ world }) => world.repo !== null,
      solution: ['git init'],
      done: (
        <p>
          Git creó una carpeta oculta llamada <Cmd>.git</Cmd>: ahí guarda toda su memoria. Mira «Tu mapa»: dice
          que está vacío, la línea empezará a crecer con tu primer commit.
        </p>
      ),
    },
    {
      id: 'archivo',
      title: 'Crea tu primer archivo',
      body: (
        <>
          <p>
            Vamos a escribir un archivo de texto. El comando <Cmd>echo</Cmd> escribe un texto y el símbolo{' '}
            <Cmd>&gt;</Cmd> lo guarda dentro de un archivo.
          </p>
          <p>Copia la sugerencia de la terminal con un clic y presiona Enter.</p>
        </>
      ),
      suggest: ['echo "Hola, mundo" > saludo.txt'],
      hint: 'Puedes usar cualquier texto y cualquier nombre de archivo. Lo importante es el símbolo > en el medio.',
      check: ({ world }) => Object.keys(world.files).length > 0,
      solution: ['echo "Hola, mundo" > saludo.txt'],
      done: (
        <p>
          Mira «Tu carpeta»: apareció tu archivo marcado como <b>nuevo</b>. Git ya lo ve, pero todavía no lo
          sigue.
        </p>
      ),
    },
    {
      id: 'status',
      title: 'Pregúntale a Git qué ve',
      body: (
        <p>
          El comando que más vas a usar es <Cmd>git status</Cmd>: te cuenta qué cambió y qué falta por guardar.
          Pruébalo.
        </p>
      ),
      suggest: ['git status'],
      check: ({ ran }) => ran(/^git status/),
      solution: ['git status'],
      done: (
        <p>
          «Archivos sin seguimiento» quiere decir que Git ve el archivo pero no lo está guardando. Cuando dudes
          de algo, escribe <Cmd>git status</Cmd>: casi siempre te dice qué hacer a continuación.
        </p>
      ),
    },
    {
      id: 'add',
      title: 'Prepara el archivo',
      body: (
        <p>
          Con <Cmd>git add</Cmd> eliges qué archivos entrarán en la próxima foto. Escribe <Cmd>git add</Cmd>{' '}
          seguido del nombre de tu archivo.
        </p>
      ),
      suggest: (w) => {
        const file = Object.keys(w.files).find((f) => f !== '.gitignore') ?? 'saludo.txt';
        return [`git add ${file}`];
      },
      hint: 'El nombre del archivo es el que escribiste después del símbolo >, por ejemplo saludo.txt.',
      check: ({ world }) => !!world.repo && Object.keys(world.repo.index).length > 0,
      solution: ['git add saludo.txt'],
      done: (
        <p>
          El archivo pasó a <b>Preparados</b>: está en la sala de espera. Todavía no quedó guardado. Puedes
          preparar varios archivos y guardarlos juntos.
        </p>
      ),
    },
    {
      id: 'commit',
      title: 'Guarda tu primer punto',
      body: (
        <>
          <p>
            Ahora sí: <Cmd>git commit -m "Mi primer commit"</Cmd>. El texto entre comillas es el mensaje: una
            nota para tu yo del futuro sobre qué cambió.
          </p>
          <Callout tone="warn" title="Ojo con las comillas">
            El mensaje tiene que ir entre comillas. Sin ellas, Git cree que cada palabra es un archivo.
          </Callout>
        </>
      ),
      suggest: ['git commit -m "Mi primer commit"'],
      check: ({ world }) => Object.keys(world.commits).length > 0,
      solution: ['git commit -m "Mi primer commit"'],
      done: (
        <p>
          ¡Tu primera <Term k="commit">estación</Term>! Aparece en el mapa con el cartel «Estás aquí» y el
          nombre de la rama <Term k="main">main</Term>. Además, el archivo ya figura en «Historial».
        </p>
      ),
    },
    {
      id: 'cambio',
      title: 'Cambia el archivo',
      body: (
        <p>
          Vamos a modificarlo. El símbolo <Cmd>&gt;&gt;</Cmd> (doble) agrega una línea <i>al final</i> en lugar de
          reemplazar todo. También puedes hacer clic en el archivo, en «Tu carpeta», para editarlo como en un
          editor de texto.
        </p>
      ),
      suggest: (w) => {
        const file = Object.keys(w.files).find((f) => f !== '.gitignore') ?? 'saludo.txt';
        return [`echo "Esta es mi segunda línea" >> ${file}`];
      },
      check: ({ world }) => !!world.repo && statusInfo(world).unstaged.length > 0,
      solution: ['echo "Esta es mi segunda línea" >> saludo.txt'],
      done: (
        <p>
          En «Tu carpeta» el archivo ahora dice <b>cambió</b>. Git comparó con la última versión guardada y notó
          la diferencia.
        </p>
      ),
    },
    {
      id: 'diff',
      title: 'Mira qué cambió exactamente',
      body: (
        <p>
          <Cmd>git diff</Cmd> te muestra la diferencia línea por línea entre lo guardado y lo que tienes ahora.
        </p>
      ),
      suggest: ['git diff'],
      check: ({ ran }) => ran(/^git diff/),
      solution: ['git diff'],
      done: (
        <p>
          Las líneas que empiezan con <b>+</b> (en verde) son nuevas; las que empiezan con <b>-</b> (en rojo) se
          quitaron.
        </p>
      ),
    },
    {
      id: 'commit-am',
      title: 'Guarda el cambio',
      body: (
        <p>
          Esta vez usa el atajo <Cmd>git commit -am "mensaje"</Cmd>: la <Cmd>a</Cmd> significa «todos los
          archivos que Git ya conoce», así te ahorras el <Cmd>git add</Cmd>. Solo funciona con archivos que ya
          guardaste antes.
        </p>
      ),
      suggest: ['git commit -am "Agrego una segunda línea"'],
      check: ({ world }) => Object.keys(world.commits).length >= 2,
      solution: ['git commit -am "Agrego una segunda línea"'],
      done: <p>Segunda estación. Fíjate cómo la línea del mapa se estira.</p>,
    },
    {
      id: 'log',
      title: 'Repasa la historia',
      body: (
        <p>
          Usa <Cmd>git log --oneline</Cmd> para ver tus puntos de guardado, del más nuevo al más antiguo.
        </p>
      ),
      suggest: ['git log --oneline'],
      check: ({ ran }) => ran(/^git log/),
      solution: ['git log --oneline'],
      done: <p>Cada línea es una estación de tu mapa, con su código corto y su mensaje.</p>,
    },
    {
      id: 'reto',
      title: 'Reto: dos archivos, un solo commit',
      body: (
        <>
          <p>
            Crea <b>dos archivos nuevos</b> (el nombre y el contenido son lo de menos) y guárdalos juntos en{' '}
            <b>un solo commit</b>.
          </p>
          <p>Cuando termines, «Tus archivos» debe quedar sin pendientes.</p>
        </>
      ),
      suggest: [
        'echo "huevos" > recetas.txt',
        'echo "leche" > lista.txt',
        'git add .',
        'git commit -m "Agrego recetas y lista"',
      ],
      hint: (
        <>
          Crea cada archivo con <Cmd>echo "texto" &gt; nombre.txt</Cmd>. Luego <Cmd>git add .</Cmd> prepara todo de
          una vez (el punto significa «todo») y <Cmd>git commit -m "…"</Cmd> lo guarda.
        </>
      ),
      check: ({ world }) =>
        !!world.repo &&
        Object.keys(world.commits).length >= 3 &&
        statusInfo(world).clean &&
        Object.keys(headTree(world)).length >= 3,
      solution: [
        'echo "huevos" > recetas.txt',
        'echo "leche" > lista.txt',
        'git add .',
        'git commit -m "Agrego recetas y lista"',
      ],
      done: (
        <p>
          Un commit puede guardar varios archivos a la vez: es una foto de <i>todo</i> el proyecto en ese momento.
        </p>
      ),
    },
  ],
};
