// Exporta a Word (.docx) el contenido en Markdown que generan los paneles de
// Medios (minuta, análisis, documento). Convierte el subconjunto de Markdown que
// producimos — encabezados `#`/`##`/`###`, viñetas `-`, `**negrita**`,
// `_cursiva_`, `` `código` `` — a párrafos OOXML con la librería `docx`.
//
// La librería se carga con import DINÁMICO (solo al pulsar «Descargar Word»),
// así su peso NO entra en el bundle inicial de los paneles.

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Genera y descarga un `.docx` a partir de un texto en Markdown. */
export async function downloadMarkdownAsDocx(markdown: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(
    'docx'
  );

  // Divide una línea en runs con su formato inline (negrita/cursiva/código).
  const inlineRuns = (text: string): InstanceType<typeof TextRun>[] => {
    const runs: InstanceType<typeof TextRun>[] = [];
    const re = /\*\*([^*]+)\*\*|`([^`]+)`|_([^_]+)_/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
      if (m[1] != null) runs.push(new TextRun({ text: m[1], bold: true }));
      else if (m[2] != null)
        runs.push(new TextRun({ text: m[2], font: 'Consolas' }));
      else if (m[3] != null) runs.push(new TextRun({ text: m[3], italics: true }));
      last = re.lastIndex;
    }
    if (last < text.length) runs.push(new TextRun(text.slice(last)));
    return runs.length ? runs : [new TextRun(text)];
  };

  const paragraphs = markdown
    .split('\n')
    .reduce<InstanceType<typeof Paragraph>[]>((acc, raw) => {
      const line = raw.trim();
      if (!line) return acc; // las líneas en blanco no crean párrafos vacíos
      if (line.startsWith('### '))
        acc.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: inlineRuns(line.slice(4)),
          })
        );
      else if (line.startsWith('## '))
        acc.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: inlineRuns(line.slice(3)),
          })
        );
      else if (line.startsWith('# '))
        acc.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: inlineRuns(line.slice(2)),
          })
        );
      else if (/^[-*]\s+/.test(line))
        acc.push(
          new Paragraph({
            bullet: { level: 0 },
            children: inlineRuns(line.replace(/^[-*]\s+/, '')),
          })
        );
      else acc.push(new Paragraph({ children: inlineRuns(line) }));
      return acc;
    }, []);

  const doc = new Document({
    sections: [
      { children: paragraphs.length ? paragraphs : [new Paragraph('')] },
    ],
  });
  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, filename);
}
