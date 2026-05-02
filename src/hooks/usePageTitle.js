import { useEffect } from 'react';
import { absoluteUrl } from '../lib/blog';

const SITE_NAME = 'Traffic68.com';
const DEFAULT_TITLE = 'Traffic68 - Traffic User Thật 100% | Tăng Traffic Website Uy Tín';
const DEFAULT_DESCRIPTION = 'Traffic68 cung cấp giải pháp tăng traffic website từ user thật, hỗ trợ SEO bền vững, an toàn và minh bạch cho doanh nghiệp Việt Nam.';
const DEFAULT_IMAGE = absoluteUrl('/traffic68_com.gif');

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    if (attrs.name) el.setAttribute('name', attrs.name);
    if (attrs.property) el.setAttribute('property', attrs.property);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    el.setAttribute(key, String(value));
  });
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setJsonLd(jsonLd) {
  const id = 'page-jsonld';
  const existing = document.getElementById(id);
  if (!jsonLd) {
    if (existing) existing.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);
  if (!existing) document.head.appendChild(script);
}

export default function usePageTitle(titleOrOptions, noSuffix = false) {
  useEffect(() => {
    const options = typeof titleOrOptions === 'object'
      ? titleOrOptions
      : { title: titleOrOptions, noSuffix };

    const rawTitle = options.title || SITE_NAME;
    const title = options.noSuffix || noSuffix ? rawTitle : `${rawTitle} — ${SITE_NAME}`;
    const description = options.description || DEFAULT_DESCRIPTION;
    const canonical = absoluteUrl(options.canonicalPath || window.location.pathname || '/');
    const image = options.image ? absoluteUrl(options.image) : DEFAULT_IMAGE;
    const type = options.type || 'website';
    const robots = options.noindex ? 'noindex, nofollow' : (options.robots || 'index, follow');

    document.title = title;
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: robots });
    if (options.keywords) setMeta('meta[name="keywords"]', { name: 'keywords', content: options.keywords });
    setCanonical(canonical);

    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'vi_VN' });

    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

    if (options.publishedTime) setMeta('meta[property="article:published_time"]', { property: 'article:published_time', content: options.publishedTime });
    if (options.modifiedTime) setMeta('meta[property="article:modified_time"]', { property: 'article:modified_time', content: options.modifiedTime });

    setJsonLd(options.jsonLd);

    return () => {
      document.title = DEFAULT_TITLE;
      setJsonLd(null);
    };
  }, [titleOrOptions, noSuffix]);
}
