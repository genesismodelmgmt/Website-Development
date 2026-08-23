import { useEffect } from 'react';

/**
 * Per-route title, description and canonical/og:url.
 *
 * index.html can only carry the home page's metadata, so without this every
 * Journal article and the Work page would preview and index as the home page
 * when shared or crawled.
 */

const SITE = 'Genesis Model Management';
const ORIGIN = 'https://genesismodelmgmt.co.uk';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function useDocumentMeta({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    const full = title === SITE ? title : `${title} — ${SITE}`;
    const url = `${ORIGIN}${path}`;

    document.title = full;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [title, description, path]);
}
