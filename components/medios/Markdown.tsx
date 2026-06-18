import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Renderizador de Markdown ligero (sin dependencias) para las respuestas de
 * Claude: negritas, cursivas, código en línea, y listas ordenadas/no ordenadas.
 * Evita que el texto muestre los `**` crudos sin cargar una librería de Markdown
 * (que además arriesgaría el bug de bundling de Next 13.5.1).
 */

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_)/g;

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] != null)
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {m[3]}
        </code>
      );
    else if (m[4] != null) nodes.push(<em key={key++}>{m[4]}</em>);
    else if (m[5] != null) nodes.push(<em key={key++}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'ol' | 'ul'; items: string[] };

const OL = /^\s*\d+\.\s+(.*)$/;
const UL = /^\s*[-*]\s+(.*)$/;
const H = /^(#{1,6})\s+(.*)$/;

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const hm = line.match(H);
    if (hm) {
      blocks.push({ type: 'h', level: hm[1].length, text: hm[2] });
      i++;
      continue;
    }
    if (OL.test(line)) {
      const items: string[] = [];
      let mm: RegExpMatchArray | null;
      while (i < lines.length && (mm = lines[i].match(OL))) {
        items.push(mm[1]);
        i++;
      }
      blocks.push({ type: 'ol', items });
    } else if (UL.test(line)) {
      const items: string[] = [];
      let mm: RegExpMatchArray | null;
      while (i < lines.length && (mm = lines[i].match(UL))) {
        items.push(mm[1]);
        i++;
      }
      blocks.push({ type: 'ul', items });
    } else {
      const parts: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !OL.test(lines[i]) &&
        !UL.test(lines[i]) &&
        !H.test(lines[i])
      ) {
        parts.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'p', text: parts.join(' ') });
    }
  }
  return blocks;
}

export default function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blocks = parse(children || '');
  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const Tag = `h${Math.min(b.level, 6)}` as keyof JSX.IntrinsicElements;
          const size =
            b.level <= 1 ? 'text-lg' : b.level === 2 ? 'text-base' : 'text-sm';
          return (
            <Tag
              key={i}
              className={cn('font-bold leading-tight text-ink', size)}
            >
              {renderInline(b.text)}
            </Tag>
          );
        }
        if (b.type === 'p')
          return (
            <p key={i} className="leading-relaxed">
              {renderInline(b.text)}
            </p>
          );
        if (b.type === 'ol')
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(it)}
                </li>
              ))}
            </ol>
          );
        return (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j} className="leading-relaxed">
                {renderInline(it)}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
