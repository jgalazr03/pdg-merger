// Lectura y relleno de formularios PDF (AcroForm) 100% en el navegador con
// pdf-lib. Verificado: los 5 tipos de campo se leen, se escriben y persisten
// tras guardar. No soporta XFA (Adobe LiveCycle). pdf-lib se importa de forma
// dinámica para no arrastrarlo al bundle inicial de la ruta.

export type FieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'optionlist';

export interface FormField {
  name: string;
  type: FieldType;
  value: string | boolean | string[] | undefined;
  /** Opciones disponibles para dropdown, radio y optionlist. */
  options?: string[];
}

export type FieldValue = string | boolean | string[];

export interface FillResult {
  bytes: Uint8Array;
  applied: string[];
  skipped: { name: string; reason: string }[];
}

export async function listFields(file: File): Promise<FormField[]> {
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFRadioGroup,
    PDFOptionList,
  } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  return doc
    .getForm()
    .getFields()
    .map((f): FormField => {
      const name = f.getName();
      if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() };
      if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() };
      if (f instanceof PDFDropdown)
        return { name, type: 'dropdown', value: f.getSelected(), options: f.getOptions() };
      if (f instanceof PDFRadioGroup)
        return { name, type: 'radio', value: f.getSelected(), options: f.getOptions() };
      if (f instanceof PDFOptionList)
        return { name, type: 'optionlist', value: f.getSelected(), options: f.getOptions() };
      // Botones, firmas u otros tipos no editables: se listan pero no se rellenan.
      return { name, type: 'text', value: undefined };
    });
}

export async function fillForm(
  file: File,
  values: Record<string, FieldValue>,
  { flatten = false }: { flatten?: boolean } = {}
): Promise<FillResult> {
  const {
    PDFDocument,
    StandardFonts,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFRadioGroup,
    PDFOptionList,
  } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const applied: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const [name, val] of Object.entries(values)) {
    // getField LANZA si el nombre no existe (no devuelve null).
    const field = (() => {
      try {
        return form.getField(name);
      } catch {
        return null;
      }
    })();
    if (!field) {
      skipped.push({ name, reason: 'no encontrado' });
      continue;
    }
    try {
      if (field instanceof PDFTextField) {
        field.setText(typeof val === 'string' ? val : String(val ?? ''));
      } else if (field instanceof PDFCheckBox) {
        if (val) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        const sel = Array.isArray(val) ? val : val ? [String(val)] : [];
        if (!sel.length) continue; // sin selección: se deja como está
        field.select(sel);
      } else if (field instanceof PDFRadioGroup) {
        if (typeof val !== 'string' || !val) continue;
        field.select(val);
      } else if (field instanceof PDFOptionList) {
        const sel = Array.isArray(val) ? val : val ? [String(val)] : [];
        if (!sel.length) continue;
        field.select(sel);
      } else {
        skipped.push({ name, reason: 'tipo no soportado' });
        continue;
      }
      applied.push(name);
    } catch (e) {
      // p.ej. "WinAnsi cannot encode" con caracteres fuera de Latin-1.
      skipped.push({ name, reason: (e as Error).message });
    }
  }

  // Sin esto, algunos visores (incluido Vista Previa de macOS) no pintan los
  // valores hasta hacer clic en el campo.
  form.updateFieldAppearances(font);
  if (flatten) form.flatten(); // irreversible: deja el PDF no editable.

  return { bytes: await doc.save(), applied, skipped };
}
