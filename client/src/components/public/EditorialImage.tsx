import type { WorkEntry } from '../../content/gallery';

/**
 * The image slot for a piece of work. With a real photograph supplied it
 * renders it; until then it composes an editorial frame in the house palette —
 * an intentional piece of art direction, not a grey box — so the wall reads as
 * finished while the photography is dropped in entry by entry.
 */

const ASPECT_CLASS: Record<WorkEntry['aspect'], string> = {
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
};

interface Palette {
  bg: string;
  block: string;
  line: string;
  glyph: string;
  text: string;
}

// Six rotations of bone, ink and brass. Dark frames alternate with pale ones so
// a mosaic of them has rhythm rather than stripes.
const PALETTES: Record<WorkEntry['frame'], Palette> = {
  1: { bg: '#16150f', block: '#26241b', line: '#8a6f3c', glyph: '#f7f5f1', text: '#f7f5f1' },
  2: { bg: '#f0e9dc', block: '#e2ddd3', line: '#8a6f3c', glyph: '#16150f', text: '#16150f' },
  3: { bg: '#26241b', block: '#16150f', line: '#e2ddd3', glyph: '#8a6f3c', text: '#f7f5f1' },
  4: { bg: '#fffefb', block: '#f0e9dc', line: '#16150f', glyph: '#8a6f3c', text: '#16150f' },
  5: { bg: '#8a6f3c', block: '#7a6234', line: '#f7f5f1', glyph: '#f7f5f1', text: '#f7f5f1' },
  6: { bg: '#e2ddd3', block: '#f7f5f1', line: '#8a6f3c', glyph: '#16150f', text: '#16150f' },
};

function ComposedFrame({ entry }: { entry: WorkEntry }) {
  const p = PALETTES[entry.frame];
  const seq = String(entry.frame).padStart(2, '0');

  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={entry.title}>
      <rect width="300" height="400" fill={p.bg} />
      {/* an off-centre block and a circle: the "photograph" the frame is waiting for */}
      <rect x="150" y="0" width="150" height="400" fill={p.block} />
      <circle cx="150" cy="168" r="86" fill="none" stroke={p.line} strokeWidth="1" />
      <circle cx="150" cy="168" r="60" fill="none" stroke={p.line} strokeWidth="0.5" opacity="0.6" />
      <line x1="24" y1="330" x2="276" y2="330" stroke={p.line} strokeWidth="1" />
      <text x="24" y="120" fontFamily="Georgia, serif" fontSize="120" fill={p.glyph} opacity="0.16">
        G
      </text>
      <text x="24" y="356" fontFamily="Georgia, serif" fontSize="15" fill={p.text}>
        {entry.title}
      </text>
      <text x="24" y="374" fontFamily="ui-sans-serif, system-ui" fontSize="8.5" letterSpacing="2" fill={p.text} opacity="0.65">
        {`GENESIS · ${entry.season.toUpperCase()}`}
      </text>
      <text x="276" y="40" textAnchor="end" fontFamily="ui-sans-serif, system-ui" fontSize="9" letterSpacing="2" fill={p.text} opacity="0.5">
        {`№ ${seq}`}
      </text>
    </svg>
  );
}

export function EditorialImage({ entry, className = '' }: { entry: WorkEntry; className?: string }) {
  return (
    <div className={`img-frame ${ASPECT_CLASS[entry.aspect]} ${className}`}>
      {entry.image ? (
        <img src={entry.image} alt={entry.title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ComposedFrame entry={entry} />
      )}
    </div>
  );
}
