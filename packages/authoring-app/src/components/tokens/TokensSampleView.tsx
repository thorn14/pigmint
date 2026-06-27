import { useMemo, useState } from 'react';
import { formatCss } from 'culori';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, useEffectiveMode, CVD_PROFILE_OPTIONS } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { runResolve } from '../../lib/resolveState';
import { getRelativeLuminance } from '../../lib/colorMath';
import { CvdFilterDefs, cvdFilterCss, CVD_PROFILE_LABELS } from '../../lib/cvdFilter';
import type { ResolvedToken, CvdProfile } from '@pigmint/core';
import { AppSelect } from './AppSelect';
import { EditTokenModal } from './EditTokenModal';

// Titles drawn from canonical works on colour science and colour theory.
const SAMPLE_TITLES = [
  'Interaction of Color',
  'Theory of Colours',
  'Remarks on Colour',
  'Opticks',
  'The Art of Colour',
  'A Color Notation',
  'The Elements of Color',
  'On the Theory of Light and Colours',
  'Treatise on Physiological Optics',
  'The Reproduction of Colour',
  'Color Appearance Models',
  'Color and Culture',
  'Light and Colour in the Outdoors',
  'The Retinex Theory of Color Vision',
  'Colorimetry',
  'Outlines of a Theory of Light Sensation',
  'The Perception of Color',
  'The Science of Color',
  'Eye, Brain, and Vision',
  'A Grammar of Color',
  'Color for the Sciences',
  'Principles of Color Technology',
  'Vision and the Eye',
  'Color in Nature',
] as const;

// Sentences drawn from the literature of colour science.
const SAMPLE_SENTENCES = [
  'Newton showed in the Opticks that white light is composed of every colour of the visible spectrum.',
  'Goethe argued that colour arises at the boundary where light meets darkness, not from light alone.',
  'Hering proposed that human colour vision is mediated by three opponent channels: red–green, blue–yellow, and black–white.',
  'Trichromatic vision derives from three classes of cone photoreceptor sensitive to long, medium, and short wavelengths.',
  'Land’s retinex model accounts for the perceptual constancy of colour under changing illumination.',
  'The CIE 1931 chromaticity diagram established the first quantitative coordinates of human colour perception.',
  'Munsell organised colour into three independent perceptual axes: hue, value, and chroma.',
  'Albers observed that no colour is ever truly seen alone — every hue is shaped by what surrounds it.',
  'Helmholtz extended Young’s trichromatic hypothesis by mapping receptor responses to the spectral light reaching the retina.',
  'Wittgenstein’s remarks treat colour not as a physical property but as a question of logical grammar.',
  'The Bezold–Brücke effect describes how perceived hue shifts as luminance changes.',
  'Simultaneous contrast causes a single colour to appear warmer or cooler depending on its surround.',
  'The Purkinje shift reflects the transition from cone-mediated to rod-mediated vision at low light.',
  'Colour constancy allows the visual system to estimate surface reflectance independently of the illuminant.',
  'The CIELAB colour space was designed to be perceptually uniform across the full gamut of human vision.',
  'OKLab and OKLCh refine CIELAB by improving uniformity for chroma and hue perception.',
  'Itten’s seven contrasts catalogued the perceptual relationships designers use to organise colour.',
  'Hurvich and Jameson reconciled the trichromatic and opponent-process theories by modelling the retinal pathway.',
  'Metameric pairs share an identical perceived colour while their spectral compositions differ entirely.',
  'Mach bands reveal the role of lateral inhibition in shaping the perceived edges between adjacent tones.',
  'Dichromatic vision arises when one of the three cone classes is absent or non-functional.',
  'Perceived brightness depends not only on luminance but on the spatial context in which a stimulus appears.',
  'MacAdam’s chromaticity diagram mapped the just-noticeable differences in colour across the visible gamut.',
  'The Helmholtz–Kohlrausch effect shows that highly chromatic colours appear brighter than their luminance predicts.',
] as const;

// Deterministic pick by (seed, slot, surface). Same inputs => same phrase, so
// scrolling/re-renders don't reshuffle; the Refresh button bumps the seed.
function pickPhrase<T>(list: readonly T[], seed: number, slot: number, surface: string): T {
  let h = (seed * 2654435761) ^ (slot * 1597) ^ surface.length;
  for (let i = 0; i < surface.length; i++) h = (h * 31 + surface.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % list.length;
  return list[idx] as T;
}

type FgEntry = { path: string; color: string };
type NtEntry = { path: string; color: string };

type Row =
  | { kind: 'title'; fg: FgEntry; phrase: string }
  | { kind: 'body'; fg: FgEntry; phrase: string }
  | { kind: 'hr'; nt: NtEntry };

// fg[0] -> bold title, all nonText hrs stacked beneath it, then every fg
// (including fg[0]) gets a body sentence so every token reads in prose too.
function buildRows(
  fgs: FgEntry[],
  nonTexts: NtEntry[],
  seed: number,
  surface: string,
): Row[] {
  const rows: Row[] = [];
  if (fgs.length === 0) return rows;

  rows.push({
    kind: 'title',
    fg: fgs[0]!,
    phrase: pickPhrase(SAMPLE_TITLES, seed, 0, surface),
  });
  for (const nt of nonTexts) {
    rows.push({ kind: 'hr', nt });
  }
  for (let i = 0; i < fgs.length; i++) {
    rows.push({
      kind: 'body',
      fg: fgs[i]!,
      phrase: pickPhrase(SAMPLE_SENTENCES, seed, i, surface),
    });
  }
  return rows;
}

export function TokensSampleView() {
  const scales           = usePaletteStore((s) => s.scales);
  const engineModes      = useIntentStore((s) => s.engineModes);
  const engineTarget     = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineResolver   = useIntentStore((s) => s.engineResolver);
  const highContrast     = useIntentStore((s) => s.highContrast);
  const setHighContrast  = useIntentStore((s) => s.setHighContrast);
  const engineCvd        = useIntentStore((s) => s.engineCvd);
  const setEngineCvd     = useIntentStore((s) => s.setEngineCvd);
  const effectiveMode    = useEffectiveMode();

  const cvdFilter = cvdFilterCss(engineCvd);

  const vocabEntries       = useVocabStore((s) => s.entries);
  const vocabRaw           = useVocabStore((s) => s.raw);
  const vocabSurfacePaths  = useVocabStore((s) => s.surfacePaths);
  const vocabSurfaceSteps  = useVocabStore((s) => s.surfaceSteps);
  const vocabSemanticSteps = useVocabStore((s) => s.semanticSteps);

  const [phraseSeed] = useState(() => Date.now() & 0x7fffffff);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  const vocabCtx = useMemo(() => {
    if (!vocabEntries || !vocabRaw) return null;
    return {
      vocabulary: vocabEntries,
      tokenRamp: Object.fromEntries(
        Object.entries({
          ...vocabRaw.surfaces,
          ...vocabRaw.foreground,
          ...vocabRaw.nonText,
          ...(vocabRaw.decorative ?? {}),
        }).map(([n, e]) => [n, (e as { ramp: string }).ramp]),
      ),
      surfacePaths: vocabSurfacePaths ?? undefined,
      surfaceSteps: vocabSurfaceSteps ?? undefined,
      semanticSteps: vocabSemanticSteps ?? undefined,
    };
  }, [vocabEntries, vocabRaw, vocabSurfacePaths, vocabSurfaceSteps, vocabSemanticSteps]);

  const resolution = useMemo(
    () => runResolve(scales, engineModes, engineTarget, engineCompliance, vocabCtx, engineResolver),
    [scales, engineModes, engineTarget, engineCompliance, vocabCtx, engineResolver],
  );

  const cards = useMemo(() => {
    if (!vocabRaw || !resolution.ok) return [];
    const byPath = new Map<string, ResolvedToken>();
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode) continue;
      byPath.set(t.path, t);
    }

    type Card = {
      surface: string;
      bgHex: string;
      bgColor: string;
      surfaceFg: string;
      fgs: FgEntry[];
      nonTexts: NtEntry[];
    };

    const out: Card[] = [];
    for (const surfaceName of Object.keys(vocabRaw.surfaces)) {
      const bg = byPath.get(surfaceName);
      if (!bg) continue;

      const fgs: FgEntry[] = [];
      for (const [name, entry] of Object.entries(vocabRaw.foreground)) {
        if (!entry.surfaces.includes(surfaceName)) continue;
        const r = byPath.get(name);
        if (!r) continue;
        const a = r.oklch.alpha;
        const color = (a != null && a < 1)
          ? (formatCss({ mode: 'oklch', ...r.oklch }) ?? r.hex)
          : r.hex;
        fgs.push({ path: name, color });
      }
      if (fgs.length === 0) continue;

      const nonTexts: NtEntry[] = [];
      for (const [name, entry] of Object.entries(vocabRaw.nonText)) {
        if (!entry.surfaces.includes(surfaceName)) continue;
        const r = byPath.get(name);
        if (!r) continue;
        const a = r.oklch.alpha;
        const color = (a != null && a < 1)
          ? (formatCss({ mode: 'oklch', ...r.oklch }) ?? r.hex)
          : r.hex;
        nonTexts.push({ path: name, color });
      }

      const alpha = bg.oklch.alpha;
      const bgColor = (alpha != null && alpha < 1)
        ? (formatCss({ mode: 'oklch', ...bg.oklch }) ?? bg.hex)
        : bg.hex;
      const surfaceFg = getRelativeLuminance(bg.hex) > 0.5 ? '#000000' : '#ffffff';

      out.push({ surface: surfaceName, bgHex: bg.hex, bgColor, surfaceFg, fgs, nonTexts });
    }
    return out;
  }, [vocabRaw, resolution, effectiveMode]);

  if (!vocabRaw) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, color: 'var(--p-text-tertiary)', fontSize: 13, textAlign: 'center',
      }}>
        No tokens yet.
      </div>
    );
  }
  if (!resolution.ok) {
    return (
      <div style={{ flex: 1, padding: '24px', color: 'var(--p-text-secondary)', fontSize: 12 }}>
        {resolution.error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CvdFilterDefs />

      {/* Toolbar — mirrors TokensPreview. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderBottom: '1px solid var(--p-border)',
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--p-text-secondary)',
        flexWrap: 'wrap' as const,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ opacity: 0.7 }}>Simulate vision</span>
          <AppSelect
            variant="compact"
            value={engineCvd[0] ?? ''}
            onChange={(v) => setEngineCvd(v ? [v as CvdProfile] : [])}
            title="Simulate a color vision deficiency"
            options={[
              { value: '', label: 'None' },
              ...CVD_PROFILE_OPTIONS.map((profile) => ({
                value: profile,
                label: CVD_PROFILE_LABELS[profile],
              })),
            ]}
          />
        </label>

        <label style={{
          marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--p-accent)' }}
          />
          High contrast
        </label>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        filter: cvdFilter,
      }}>
        {cards.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
            No surfaces have foreground tokens declared yet.
          </span>
        ) : (
          cards.map((card) => {
            const rows = buildRows(card.fgs, card.nonTexts, phraseSeed, card.surface);
            return (
              <div
                key={card.surface}
                style={{
                  background: card.bgColor,
                  borderRadius: 10,
                  padding: '28px 32px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {rows.map((row, i) => {
                  if (row.kind === 'hr') {
                    return (
                      <button
                        key={`hr-${i}-${row.nt.path}`}
                        type="button"
                        onClick={() => setEditingPath(row.nt.path)}
                        className="swatch-focus"
                        title={`Edit ${row.nt.path}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          padding: '2px 0',
                          cursor: 'pointer',
                          textAlign: 'left',
                          font: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ height: 0, borderTop: `1px solid ${row.nt.color}` }} />
                      </button>
                    );
                  }

                  const isTitle = row.kind === 'title';
                  const fontSize = isTitle ? 32 : 16;
                  const fontWeight = isTitle ? 700 : 400;
                  const lineHeight = isTitle ? 1.15 : 1.4;
                  const letterSpacing = isTitle ? '-0.01em' : 'normal';
                  const marginTop = isTitle ? 0 : 0;
                  const marginBottom = isTitle ? 6 : 0;

                  return (
                    <button
                      key={`fg-${i}-${row.fg.path}`}
                      type="button"
                      onClick={() => setEditingPath(row.fg.path)}
                      className="swatch-focus"
                      title={`Edit ${row.fg.path}`}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        marginTop,
                        marginBottom,
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: row.fg.color,
                        fontSize,
                        fontWeight,
                        lineHeight,
                        letterSpacing,
                        textTransform: 'none',
                      }}
                    >
                      {row.phrase}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {editingPath && <EditTokenModal path={editingPath} onClose={() => setEditingPath(null)} />}
    </div>
  );
}
