'use client';

import { useState } from 'react';
import { Plus, X, BookMarked } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { VOCAB_MAX_TERMS } from '@/lib/customVocab';

type Props = {
  terms: string[];
  onChange: (terms: string[]) => void;
  accent: ToolAccent;
};

/**
 * Editor de "vocabulario del despacho": términos propios (clientes, siglas,
 * productos) que se suman al keyterm boosting del modo servidor para mejorar el
 * reconocimiento. El padre persiste en localStorage; aquí solo se edita.
 */
export default function VocabEditor({ terms, onChange, accent }: Props) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (!v || terms.length >= VOCAB_MAX_TERMS) return;
    if (!terms.some((t) => t.toLowerCase() === v.toLowerCase())) {
      onChange([...terms, v]);
    }
    setInput('');
  };

  const remove = (term: string) => onChange(terms.filter((t) => t !== term));

  return (
    <div className="mt-4 rounded-lg border-2 border-ink/15 bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        <BookMarked className={cn('h-4 w-4', accent.text)} strokeWidth={2.5} />
        <h3 className="text-sm font-bold text-ink">Vocabulario personalizado</h3>
        <span className="text-xs text-muted-foreground">(opcional)</span>
      </div>
      <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">
        Agrega nombres de clientes, siglas o productos para que se reconozcan
        mejor. Se guardan en este navegador.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="p. ej. Grupo Aresa, nombres propios, siglas…"
          aria-label="Agregar término al vocabulario"
          maxLength={60}
          className="h-9 min-w-0 flex-1 rounded-lg border-2 border-ink/20 bg-surface px-3 text-sm text-ink outline-none transition-colors duration-150 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim() || terms.length >= VOCAB_MAX_TERMS}
          aria-label="Agregar término"
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg border-2 border-ink px-2.5 text-sm font-bold text-ink transition-colors duration-150 hover-fine:bg-muted disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Agregar
        </button>
      </div>

      {terms.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border-2 border-ink/20 py-0.5 pl-2.5 pr-1 text-xs text-ink"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                aria-label={`Quitar ${t}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover-fine:bg-ink hover-fine:text-white"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
