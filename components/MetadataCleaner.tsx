'use client';

import { Eraser } from 'lucide-react';
import { getTool } from '@/lib/tools';
import { useBatchProcessor } from '@/hooks/use-batch-processor';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import BatchPanel from '@/components/tools/BatchPanel';

const tool = getTool('limpiar-metadatos');
const accent = tool.accent;

const isPdf = (f: File) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

async function cleanMetadata(file: File): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await file.arrayBuffer(), {
    updateMetadata: false,
  });
  pdf.setTitle('');
  pdf.setAuthor('');
  pdf.setSubject('');
  pdf.setKeywords([]);
  pdf.setCreator('');
  pdf.setProducer('');
  // Fecha fija neutra para no dejar rastro temporal del momento de saneo.
  const fixedDate = new Date(0);
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export default function MetadataCleaner() {
  const batch = useBatchProcessor({
    accept: isPdf,
    process: cleanMetadata,
    outName: (f) => `${f.name.replace(/\.pdf$/i, '')}_sin_metadatos.pdf`,
    zipName: 'pdfs-sin-metadatos.zip',
    rejectMessage: 'Solo se aceptan archivos PDF',
  });

  const step: 1 | 2 | 3 =
    batch.items.length === 0 ? 1 : batch.doneCount > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept=".pdf,application/pdf"
        multiple
        idleTitle="Selecciona archivos PDF"
        idleSubtitle="Haz clic o arrastra uno o varios PDF para quitarles los metadatos"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF"
        onFiles={batch.addFiles}
      />

      <ToolConstraints items={tool.constraints} />

      <BatchPanel
        items={batch.items}
        accent={accent}
        isProcessing={batch.isProcessing}
        done={batch.done}
        doneCount={batch.doneCount}
        errorCount={batch.errorCount}
        actionLabel="Quitar metadatos"
        actioningLabel="Quitando…"
        ActionIcon={Eraser}
        onRun={batch.run}
        onRemove={batch.removeItem}
        onReset={batch.reset}
        onDownloadAll={batch.downloadAll}
        onDownloadOne={batch.downloadOne}
        resultHint="Se borraron autor, título, fechas y software de cada PDF."
      />
    </ToolShell>
  );
}
