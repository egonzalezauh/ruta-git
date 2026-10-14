import { createWorld, execute, type World } from '../../engine';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter } from '../types';

/** Un informe con cuatro versiones guardadas, para poder viajar por su historia. */
function makeWorld(): World {
  const cmds = [
    'git init',
    'echo "Informe de ventas" > informe.txt',
    'git add informe.txt',
    'git commit -m "Primer borrador"',
    'echo "Ventas del trimestre: 120" >> informe.txt',
    'git commit -am "Agrego las ventas"',
    'echo "Conclusión: vamos bien" >> informe.txt',
    'git commit -am "Escribo la conclusión"',
    'echo "Informe de ventas" > informe.txt',
    'echo "Ventas del trimestre: 120" >> informe.txt',
    'echo "Conclusión: vamos muy bien" >> informe.txt',
    'git commit -am "Corrijo la conclusión"',
  ];
  let w = createWorld({ cwd: 'mi-informe' });
  for (const c of cmds) w = execute(w, c).world;
  return w;
}

export const ch01: Chapter = {
  id: 1,
  kind: 'lesson',
  title: '¿Qué es Git?',
  tagline: 'La máquina del tiempo de tu proyecto.',
  minutes: 5,
  makeWorld,
  recap: [
    { cmd: 'git log --oneline', desc: 'ver la lista de puntos de guardado' },
    { cmd: 'git show HEAD~2:archivo', desc: 'mirar cómo era un archivo hace dos guardados' },
  ],
  steps: [
    {
      id: 'problema',
      title: 'El problema de siempre',
      body: (
        <>
          <p>
            Seguro te ha pasado: <b>informe_final.docx</b>, <b>informe_final_v2.docx</b>,{' '}
            <b>informe_final_v2_ahora_sí.docx</b>… Copias y más copias, y al final ya no sabes cuál es la buena.
          </p>
          <p>
            Programadores, diseñadores, escritores y estudiantes comparten ese problema: cambiar cosas sin miedo a
            perder lo que ya funcionaba.
          </p>
        </>
      ),
    },
    {
      id: 'idea',
      title: 'La idea: puntos de guardado',
      body: (
        <>
          <p>
            <b>Git</b> resuelve eso con una idea sencilla: en vez de copiar archivos, vas guardando{' '}
            <Term k="commit">puntos de guardado</Term>. Cada uno es una foto de tu proyecto en un momento, con un
            mensaje que dice qué cambió.
          </p>
          <Callout title="Piensa en un mapa de metro">
            Mira «Tu mapa» a la derecha. Cada <b>estación</b> es un punto de guardado. Esta carpeta tiene un informe
            con <b>4 estaciones</b>: cuatro versiones que Git recuerda por ti.
          </Callout>
          <p>
            Todo lo que ves en esta página es un simulador: puedes escribir comandos sin riesgo de romper nada.
          </p>
        </>
      ),
    },
    {
      id: 'log',
      title: 'Pídele a Git que te cuente la historia',
      body: (
        <p>
          Escribe <Cmd>git log --oneline</Cmd> en la terminal. Te mostrará una línea por cada punto de guardado,
          del más nuevo al más antiguo.
        </p>
      ),
      suggest: ['git log --oneline'],
      hint: 'Escríbelo tal cual, con los dos guiones antes de oneline, y presiona Enter.',
      check: ({ ran }) => ran(/^git log\b/),
      solution: ['git log --oneline'],
      done: (
        <p>
          Cada línea es una estación del mapa: un código corto (como <Cmd>a1b2c3d</Cmd>) y el mensaje que
          escribió quien la guardó. El de arriba es el más reciente.
        </p>
      ),
    },
    {
      id: 'viajar',
      title: 'Mira el informe como era hace dos guardados',
      body: (
        <>
          <p>
            Git te deja ver cualquier versión anterior sin deshacer nada. El nombre <Cmd>HEAD</Cmd> es el cartel{' '}
            <Term k="head">«Estás aquí»</Term>, y <Cmd>HEAD~2</Cmd> significa «dos estaciones antes».
          </p>
          <p>
            Prueba <Cmd>git show HEAD~2:informe.txt</Cmd>.
          </p>
        </>
      ),
      suggest: ['git show HEAD~2:informe.txt'],
      hint: 'Después de show va un espacio, luego HEAD~2, dos puntos y el nombre del archivo, sin espacios.',
      check: ({ ran }) => ran(/^git show\s+\S+:informe\.txt/),
      solution: ['git show HEAD~2:informe.txt'],
      done: (
        <p>
          Eso es lo que decía el informe en aquel momento. Tu archivo actual no cambió: solo estuviste
          «mirando» el pasado.
        </p>
      ),
    },
    {
      id: 'comparar',
      title: 'Compara con la versión de hoy',
      body: (
        <p>
          Ahora lee el archivo tal como está hoy con <Cmd>cat informe.txt</Cmd> y fíjate en la conclusión.
        </p>
      ),
      suggest: ['cat informe.txt'],
      check: ({ ran }) => ran(/^cat\s+informe\.txt/),
      solution: ['cat informe.txt'],
      done: (
        <p>
          La conclusión cambió entre una versión y otra, y tú puedes tener las dos a mano. Ya no hace falta
          «informe_final_v2». Git guarda todas por ti.
        </p>
      ),
    },
    {
      id: 'adelante',
      title: 'Lo que viene en el viaje',
      body: (
        <>
          <p>En las próximas paradas vas a aprender a:</p>
          <ul>
            <li>
              crear tu propio <Term k="repositorio">repositorio</Term> y guardar cambios,
            </li>
            <li>
              probar ideas en una <Term k="rama">rama</Term> sin romper lo que ya funciona,
            </li>
            <li>
              trabajar en equipo con un <Term k="remoto">remoto</Term> como GitHub,
            </li>
            <li>resolver conflictos y deshacer errores sin pánico.</li>
          </ul>
          <p>Y al final, cuatro misiones sin ninguna ayuda para ponerte a prueba.</p>
        </>
      ),
    },
  ],
};
