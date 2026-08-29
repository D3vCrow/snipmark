import type { Annotation } from '../types';

/**
 * Turn the annotation array into the markdown sidecar that ships beside the PNG.
 *
 * The image says where; this says what. Without it a reader has to infer intent
 * from geometry, which is the whole failure this tool exists to remove.
 *
 * Pure: no React, no Wails, no IO. That is what keeps it unit-testable.
 */
export function toSidecar(annotations: Annotation[], imageName: string): string {
  const marked = annotations.filter((a) => a.kind || (a.note && a.note.trim()));
  if (marked.length === 0) return '';

  const numbered = marked
    .filter((a) => typeof a.number === 'number')
    .sort((a, b) => (a.number as number) - (b.number as number));
  const unnumbered = marked.filter((a) => typeof a.number !== 'number');

  const lines = [...numbered, ...unnumbered].map((a, i) => {
    const note = (a.note ?? '').replace(/\s*\n\s*/g, ' ').trim();
    if (a.kind && note) return `${i + 1}. \`${a.kind}\` - ${note}`;
    if (a.kind) return `${i + 1}. \`${a.kind}\``;
    return `${i + 1}. ${note}`;
  });

  return `# ${imageName}\n\n${lines.join('\n')}\n`;
}
