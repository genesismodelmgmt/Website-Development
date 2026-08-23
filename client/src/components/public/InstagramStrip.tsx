import { useEffect, useState } from 'react';
import { INSTAGRAM_URL, workEntries } from '../../content/gallery';
import { EditorialImage } from './EditorialImage';
import { Reveal } from './Reveal';

interface InstagramPost {
  id: string;
  caption: string | null;
  mediaUrl: string;
  permalink: string;
}

/**
 * The Instagram band on the home page. Live posts from @genesismodelmgmt when
 * the server has a token; the curated wall stands in when it does not, so the
 * band never renders empty and never blocks the page on Meta.
 */
export function InstagramStrip() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  /**
   * If the CDN images themselves fail — a content policy blocking the host, an
   * expired media URL — the whole band reverts to the curated wall rather than
   * showing a row of broken tiles. Fetching successfully is not the same as
   * rendering successfully, and only the browser knows the difference.
   */
  const [imagesBroken, setImagesBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/instagram')
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data: { posts?: InstagramPost[] }) => {
        if (!cancelled && data.posts?.length) setPosts(data.posts.slice(0, 8));
      })
      .catch(() => {
        // fall through to the curated wall
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = workEntries.filter((w) => w.featured).slice(0, 4);
  const showLive = posts.length > 0 && !imagesBroken;

  return (
    <section className="border-y border-rule bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">From the feed</p>
              <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">@genesismodelmgmt</h2>
            </div>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn-ghost">
              Follow on Instagram
            </a>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {showLive
            ? posts.map((post, i) => (
                <Reveal key={post.id} delay={i * 60}>
                  <a href={post.permalink} target="_blank" rel="noreferrer" className="img-frame block aspect-square" title={post.caption ?? 'Open on Instagram'}>
                    <img
                      src={post.mediaUrl}
                      alt={post.caption ?? 'Genesis Model Management on Instagram'}
                      loading="lazy"
                      onError={() => setImagesBroken(true)}
                      className="h-full w-full object-cover"
                    />
                  </a>
                </Reveal>
              ))
            : fallback.map((entry, i) => (
                <Reveal key={entry.id} delay={i * 60}>
                  <a href={entry.instagram ?? INSTAGRAM_URL} target="_blank" rel="noreferrer" className="block">
                    <EditorialImage entry={{ ...entry, aspect: 'square' }} />
                  </a>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
