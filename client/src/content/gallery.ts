/**
 * The curated portfolio wall.
 *
 * Two sources feed the imagery on the public site, in order of preference:
 *
 *   1. The live Instagram feed (@genesismodelmgmt) — appears automatically on
 *      the home page strip once INSTAGRAM_ACCESS_TOKEN is set on the server.
 *   2. This file — the editorial wall on the Work page and the home mosaic.
 *
 * Each entry can carry a real photograph: drop the export from MediaSlide into
 * `client/public/work/` and set `image` to its path (e.g. '/work/ss26-01.jpg').
 * Until an entry has an image, the site renders a composed editorial frame in
 * the house palette — art-directed, never a broken placeholder — so the layout
 * is finished today and the photography slots in one line at a time.
 */

export type WorkCategory = 'campaign' | 'editorial' | 'runway' | 'ecommerce' | 'portrait';

export interface WorkEntry {
  id: string;
  title: string;
  category: WorkCategory;
  board: 'women' | 'men' | 'new-faces';
  season: string;
  /** Path under client/public — the real photograph, once supplied. */
  image: string | null;
  /** Link to the Instagram post for this work, when it has one. */
  instagram: string | null;
  /** Portrait tiles run tall, landscape run wide, square sit in between. */
  aspect: 'portrait' | 'landscape' | 'square';
  /** Which of the composed editorial frames to use while `image` is null. */
  frame: 1 | 2 | 3 | 4 | 5 | 6;
  featured?: boolean;
}

export const WORK_CATEGORIES: Array<{ key: WorkCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All work' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'runway', label: 'Runway' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'portrait', label: 'Portraits' },
];

export const INSTAGRAM_URL = 'https://www.instagram.com/genesismodelmgmt/';

export const workEntries: WorkEntry[] = [
  {
    id: 'ss26-campaign',
    title: 'SS26 Campaign — Womenswear',
    category: 'campaign',
    board: 'women',
    season: 'Spring/Summer 2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 1,
    featured: true,
  },
  {
    id: 'sportswear-drop',
    title: 'Sportswear Drop — Flagship',
    category: 'campaign',
    board: 'men',
    season: 'Summer 2026',
    image: null,
    instagram: null,
    aspect: 'landscape',
    frame: 2,
    featured: true,
  },
  {
    id: 'editorial-monochrome',
    title: 'Monochrome Study',
    category: 'editorial',
    board: 'women',
    season: 'Spring 2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 3,
    featured: true,
  },
  {
    id: 'lfw-aw26',
    title: 'London Fashion Week',
    category: 'runway',
    board: 'women',
    season: 'Autumn/Winter 2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 4,
    featured: true,
  },
  {
    id: 'menswear-tailoring',
    title: 'Tailoring Editorial',
    category: 'editorial',
    board: 'men',
    season: 'Autumn 2026',
    image: null,
    instagram: null,
    aspect: 'square',
    frame: 5,
    featured: true,
  },
  {
    id: 'new-faces-digitals',
    title: 'New Faces — First Digitals',
    category: 'portrait',
    board: 'new-faces',
    season: '2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 6,
    featured: true,
  },
  {
    id: 'ecomm-knitwear',
    title: 'Knitwear — E-commerce',
    category: 'ecommerce',
    board: 'women',
    season: 'Autumn 2026',
    image: null,
    instagram: null,
    aspect: 'square',
    frame: 2,
  },
  {
    id: 'fragrance-still',
    title: 'Fragrance Launch',
    category: 'campaign',
    board: 'women',
    season: 'Winter 2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 5,
  },
  {
    id: 'street-story',
    title: 'Street Story — East London',
    category: 'editorial',
    board: 'men',
    season: 'Summer 2026',
    image: null,
    instagram: null,
    aspect: 'landscape',
    frame: 1,
  },
  {
    id: 'beauty-close',
    title: 'Beauty, Close Up',
    category: 'editorial',
    board: 'women',
    season: 'Spring 2026',
    image: null,
    instagram: null,
    aspect: 'square',
    frame: 4,
  },
  {
    id: 'denim-ecomm',
    title: 'Denim — E-commerce',
    category: 'ecommerce',
    board: 'men',
    season: 'Spring 2026',
    image: null,
    instagram: null,
    aspect: 'portrait',
    frame: 3,
  },
  {
    id: 'show-backstage',
    title: 'Backstage, Before the Show',
    category: 'runway',
    board: 'new-faces',
    season: 'Autumn/Winter 2026',
    image: null,
    instagram: null,
    aspect: 'landscape',
    frame: 6,
  },
];
