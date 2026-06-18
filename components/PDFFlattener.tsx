'use client';

import { Layers } from 'lucide-react';
import { getTool } from '@/lib/tools';
import { useBatchProcessor } from '@/hooks/use-batch-processor';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import BatchPanel from '@/components/tools/BatchPanel';

const tool = getTool('aplanar-pdf');
const accent = tool.accent;

const isPdf = (f: File) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

async function flattenPdf(file: File): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  try {
    const form = pdf.getForm();
    if (form.getFields().length > 0) form.flatten();
  } catch {
    // PDF sin formulario válido: se guarda igual.
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export default function PDFFlattener() {
  const batch = useBatchProcessor({
    accept: isPdf,
    process: flattenPdf,
    outName: (f) => `${f.name.replace(/\.pdf$/i, '')}_aplanado.pdf`,
    zipName: 'pdfs-aplanados.zip',
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
        idleSubtitle="Haz clic o arrastra uno o varios PDF para aplanarlos"
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
        actionLabel="Aplanar"
        actioningLabel="Aplanando…"
        ActionIcon={Layers}
        onRun={batch.run}
        onRemove={batch.removeItem}
        onReset={batch.reset}
        onDownloadAll={batch.downloadAll}
        onDownloadOne={batch.downloadOne}
        resultHint="Los formularios quedaron fijos y ya no se pueden editar."
      />
    </ToolShell>
  );
}
