import { describe, it, expect } from 'vitest';
import { toSidecar } from './sidecar';
import type { Annotation } from '../types';

function mark(partial: Partial<Annotation>): Annotation {
  return {
    id: crypto.randomUUID(),
    type: 'rectangle',
    x: 0, y: 0, width: 10, height: 10,
    strokeWidth: 2,
    ...partial,
  };
}

describe('toSidecar', () => {
  it('returns an empty string when nothing is marked', () => {
    expect(toSidecar([], 'shot.png')).toBe('');
  });

  it('skips annotations that carry no kind and no note', () => {
    expect(toSidecar([mark({ number: 1 })], 'shot.png')).toBe('');
  });

  it('orders by number, not by array position', () => {
    const out = toSidecar([
      mark({ number: 2, kind: 'keep', note: 'the water crest' }),
      mark({ number: 1, kind: 'wrong', note: 'shadow is zero-length' }),
    ], 'shot.png');
    expect(out).toBe(
      '# shot.png\n\n' +
      '1. `wrong` - shadow is zero-length\n' +
      '2. `keep` - the water crest\n'
    );
  });

  it('numbers unnumbered marks after numbered ones, in array order', () => {
    const out = toSidecar([
      mark({ kind: 'cut', note: 'second' }),
      mark({ number: 1, kind: 'ask', note: 'first' }),
    ], 'shot.png');
    expect(out).toBe(
      '# shot.png\n\n' +
      '1. `ask` - first\n' +
      '2. `cut` - second\n'
    );
  });

  it('emits the kind alone when there is no note', () => {
    const out = toSidecar([mark({ number: 1, kind: 'keep' })], 'shot.png');
    expect(out).toBe('# shot.png\n\n1. `keep`\n');
  });

  it('emits a bare note when there is no kind', () => {
    const out = toSidecar([mark({ number: 1, note: 'look here' })], 'shot.png');
    expect(out).toBe('# shot.png\n\n1. look here\n');
  });

  it('collapses newlines in a note so one mark stays one line', () => {
    const out = toSidecar([mark({ number: 1, kind: 'wrong', note: 'a\nb' })], 'shot.png');
    expect(out).toBe('# shot.png\n\n1. `wrong` - a b\n');
  });
});
