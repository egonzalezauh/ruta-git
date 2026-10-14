/** Palabras técnicas explicadas con lenguaje cotidiano. */
export const GLOSSARY: Record<string, string> = {
  repositorio:
    'Una carpeta con memoria: Git vigila todo lo que cambia dentro y guarda su historia.',
  commit:
    'Un punto de guardado. Es una foto de tu proyecto en un momento, con un mensaje que dice qué cambió.',
  rama:
    'Una línea de trabajo paralela. Te deja probar algo sin tocar la versión principal.',
  main:
    'La rama principal: la línea “oficial” de tu proyecto. Casi todos los proyectos empiezan con ella.',
  head:
    'El cartel “Estás aquí”: marca en qué punto de la historia estás parado ahora mismo.',
  staging:
    'El área de preparación: una sala de espera donde eliges qué cambios entrarán en el próximo commit.',
  remoto:
    'Una copia de tu repositorio que vive en internet (por ejemplo, en GitHub) para compartirla o respaldarla.',
  merge:
    'Fusionar: unir los cambios de una rama dentro de otra.',
  conflicto:
    'Cuando dos personas cambian la misma línea y Git no sabe cuál conservar. Te toca decidir a ti.',
  clonar: 'Descargar una copia completa de un repositorio, con todo su historial.',
  push: 'Subir tus commits al repositorio remoto.',
  pull: 'Traer los commits nuevos del remoto y unirlos con los tuyos.',
  fetch: 'Mirar qué hay de nuevo en el remoto sin tocar tus archivos todavía.',
  stash: 'Un cajón donde guardas cambios a medias para sacarlos después.',
  etiqueta: 'Un nombre fijo para un commit importante, por ejemplo la versión 1.0.',
};
