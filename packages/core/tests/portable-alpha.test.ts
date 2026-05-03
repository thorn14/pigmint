import { describe, expect, it } from 'vitest';
import {
  validatePortableVocabulary,
  buildTokenRampFromPortable,
  portableToVocabularyEntries,
  remapPortableVocabularyRamps,
} from '../src/index.js';

const BASE_ENGINE = {
  compliance: 'wcag21' as const,
  target: 'AA' as const,
  modes: ['light'],
};

const BASE_VOCAB = {
  surfaces: { bgMain: { ramp: 'slate', step: 0 } },
  foreground: {},
  nonText: {},
};

describe('validatePortableVocabulary — alpha section', () => {
  it('accepts a degenerate alpha token (base + fixed value)', () => {
    const vocab = validatePortableVocabulary(
      {
        ...BASE_VOCAB,
        alpha: {
          overlayScrim: {
            base: '{color.primitive.slate.900}',
            value: 0.4,
            referenceSurface: 'bgMain',
          },
        },
      },
      'test.yaml',
    );
    expect(vocab.alpha?.overlayScrim).toBeDefined();
    expect(vocab.alpha!.overlayScrim!.value).toBe(0.4);
  });

  it('normalises shorthand step reference to DTCG form', () => {
    const vocab = validatePortableVocabulary(
      {
        ...BASE_VOCAB,
        alpha: {
          scrim: { base: 'slate.900', value: 0.4 },
        },
      },
      'test.yaml',
    );
    expect(vocab.alpha!.scrim!.base).toBe('{color.primitive.slate.900}');
  });

  it('accepts a path-1 alpha token (baseRamp + surfaces + preference)', () => {
    const vocab = validatePortableVocabulary(
      {
        ...BASE_VOCAB,
        alpha: {
          borderAlpha: {
            baseRamp: 'slate',
            value: 0.6,
            surfaces: ['bgMain'],
            preference: 'lowest-passing',
            usage: 'nonText',
          },
        },
      },
      'test.yaml',
    );
    expect(vocab.alpha?.borderAlpha?.baseRamp).toBe('slate');
  });

  it('rejects when neither base nor baseRamp is set', () => {
    expect(() =>
      validatePortableVocabulary(
        { ...BASE_VOCAB, alpha: { bad: { value: 0.4 } } },
        'test.yaml',
      ),
    ).toThrow('must have either "base" or "baseRamp"');
  });

  it('rejects when both base and baseRamp are set', () => {
    expect(() =>
      validatePortableVocabulary(
        {
          ...BASE_VOCAB,
          alpha: { bad: { base: 'slate.900', baseRamp: 'slate', value: 0.4 } },
        },
        'test.yaml',
      ),
    ).toThrow('mutually exclusive');
  });

  it('rejects value outside [0,1]', () => {
    expect(() =>
      validatePortableVocabulary(
        { ...BASE_VOCAB, alpha: { bad: { base: 'slate.900', value: 1.5 } } },
        'test.yaml',
      ),
    ).toThrow('between 0 and 1');
  });

  it('rejects baseRamp without surfaces', () => {
    expect(() =>
      validatePortableVocabulary(
        {
          ...BASE_VOCAB,
          alpha: { bad: { baseRamp: 'slate', value: 0.4, preference: 'lowest-passing' } },
        },
        'test.yaml',
      ),
    ).toThrow('surfaces must be a non-empty array');
  });

  it('rejects unknown referenceSurface', () => {
    expect(() =>
      validatePortableVocabulary(
        {
          ...BASE_VOCAB,
          alpha: { bad: { base: 'slate.900', value: 0.4, referenceSurface: 'doesNotExist' } },
        },
        'test.yaml',
      ),
    ).toThrow('unknown surface');
  });

  it('allows vocab with only an alpha section', () => {
    const vocab = validatePortableVocabulary(
      {
        surfaces: { bgMain: { ramp: 'slate', step: 0 } },
        foreground: {},
        nonText: {},
        alpha: { scrim: { base: 'slate.900', value: 0.3 } },
      },
      'test.yaml',
    );
    expect(vocab.alpha?.scrim).toBeDefined();
  });
});

describe('buildTokenRampFromPortable — alpha tokens', () => {
  it('maps a baseRamp alpha token', () => {
    const map = buildTokenRampFromPortable({
      ...BASE_VOCAB,
      alpha: {
        borderAlpha: {
          baseRamp: 'violet',
          value: 0.5,
          surfaces: ['bgMain'],
          preference: 'lowest-passing',
        },
      },
    });
    expect(map.borderAlpha).toBe('violet');
  });

  it('maps a base (step ref) alpha token', () => {
    const map = buildTokenRampFromPortable({
      ...BASE_VOCAB,
      alpha: {
        scrim: { base: '{color.primitive.slate.900}', value: 0.4 },
      },
    });
    expect(map.scrim).toBe('slate');
  });
});

describe('portableToVocabularyEntries — alpha tokens', () => {
  it('produces a decorative entry for base-style alpha token', () => {
    const vocab = {
      ...BASE_VOCAB,
      alpha: { overlayScrim: { base: '{color.primitive.slate.900}', value: 0.4 } },
    };
    const entries = portableToVocabularyEntries(vocab, BASE_ENGINE);
    const entry = entries.find((e) => e.path === 'overlayScrim');
    expect(entry).toBeDefined();
    expect(entry!.usage).toBe('decorative');
    expect(entry!.alpha?.baseRef).toBe('{color.primitive.slate.900}');
    expect(entry!.alpha?.value).toBe(0.4);
  });

  it('produces a nonText entry with intent for path-1 alpha token', () => {
    const vocab = {
      ...BASE_VOCAB,
      alpha: {
        borderAlpha: {
          baseRamp: 'slate',
          value: 0.6,
          surfaces: ['bgMain'],
          preference: 'lowest-passing' as const,
          usage: 'nonText' as const,
        },
      },
    };
    const entries = portableToVocabularyEntries(vocab, BASE_ENGINE);
    const entry = entries.find((e) => e.path === 'borderAlpha');
    expect(entry).toBeDefined();
    expect(entry!.usage).toBe('nonText');
    expect(entry!.primarySurface).toBe('bgMain');
    expect(entry!.alpha?.baseRamp).toBe('slate');
    expect(entry!.alpha?.intent?.preference).toBe('lowest-passing');
    expect(entry!.alpha?.intent?.threshold.usage).toBe('nonText');
  });

  it('inherits engine target level when level is not specified', () => {
    const vocab = {
      ...BASE_VOCAB,
      alpha: {
        t: { baseRamp: 'slate', value: 0.5, surfaces: ['bgMain'], preference: 'lowest-passing' as const },
      },
    };
    const entries = portableToVocabularyEntries(vocab, { ...BASE_ENGINE, target: 'AAA' });
    const entry = entries.find((e) => e.path === 't');
    expect(entry!.alpha?.intent?.threshold.level).toBe('AAA');
  });
});

describe('remapPortableVocabularyRamps — alpha tokens', () => {
  it('remaps baseRamp when the ramp is deleted', () => {
    const vocab = {
      ...BASE_VOCAB,
      alpha: {
        scrim: { baseRamp: 'slate', value: 0.4, surfaces: ['bgMain'], preference: 'lowest-passing' as const },
      },
    };
    const out = remapPortableVocabularyRamps(vocab, ['slate'], 'stone');
    expect(out.alpha?.scrim?.baseRamp).toBe('stone');
  });

  it('remaps the ramp segment in a base step ref when the ramp is deleted', () => {
    const vocab = {
      ...BASE_VOCAB,
      alpha: {
        scrim: { base: '{color.primitive.slate.900}', value: 0.4 },
      },
    };
    const out = remapPortableVocabularyRamps(vocab, ['slate'], 'stone');
    expect(out.alpha?.scrim?.base).toBe('{color.primitive.stone.900}');
  });
});
