export const SITE_URL = 'https://traffic68.com';
export const SITE_NAME = 'Traffic68';
export const DEFAULT_BLOG_COVER = '/blog_featured_seo.png';

export const BLOG_SEO = {
  title: 'Blog SEO & Traffic Website',
  description: 'Kiến thức thực chiến về SEO, traffic user thật, CRO và tăng trưởng website bền vững cho doanh nghiệp Việt Nam.',
  keywords: 'blog seo, traffic website, traffic user thật, tăng traffic, SEO bền vững, CRO',
};

export function absoluteUrl(path = '') {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function stripMarkdown(value = '') {
  return String(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(content = '') {
  return String(content)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('- ')) || '';
}

function truncate(value = '', max = 160) {
  const text = stripMarkdown(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isoDate(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function estimateReadTime(content = '', fallback = '') {
  if (fallback) return fallback;
  const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} phút đọc`;
}

export function normalizePost(raw = {}) {
  const publishedAt = raw.published_at || raw.publishedAt || raw.date || raw.created_at || raw.createdAt;
  const updatedAt = raw.updated_at || raw.updatedAt || publishedAt;
  const excerpt = raw.excerpt || truncate(firstParagraph(raw.content), 150);
  const description = raw.seo_description || raw.description || excerpt || BLOG_SEO.description;
  const cover = raw.cover || raw.image || DEFAULT_BLOG_COVER;

  return {
    ...raw,
    id: raw.id || raw.slug,
    slug: raw.slug || '',
    title: raw.seo_title || raw.title || 'Bài viết Traffic68',
    displayTitle: raw.title || raw.seo_title || 'Bài viết Traffic68',
    description: truncate(description, 165),
    excerpt: truncate(excerpt, 170),
    content: raw.content || '',
    tag: raw.category || raw.tag || 'Traffic',
    category: raw.category || raw.tag || 'Traffic',
    tagColor: raw.tagColor || raw.tag_color || 'bg-orange-100 text-orange-700',
    author: raw.author || 'Traffic68 Team',
    publishedAt,
    updatedAt,
    publishedIso: isoDate(publishedAt),
    updatedIso: isoDate(updatedAt),
    dateLabel: raw.date || formatDate(publishedAt),
    readTime: estimateReadTime(raw.content, raw.readTime || raw.read_time),
    cover,
    coverUrl: absoluteUrl(cover),
    status: raw.status || 'published',
    keywords: raw.keywords || `${raw.tag || 'traffic'}, SEO, Traffic68`,
    url: absoluteUrl(`/blog/${raw.slug || ''}`),
    views: raw.views || 0,
  };
}

export function normalizePosts(posts = []) {
  return posts.map(normalizePost).filter((post) => post.slug && post.title);
}

export function getPublishedPosts(posts = []) {
  return normalizePosts(posts).filter((post) => post.status === 'published' || !post.status);
}

export function getRelatedPosts(posts = [], post, limit = 3) {
  if (!post) return [];
  const normalized = getPublishedPosts(posts).filter((item) => item.slug !== post.slug);
  return normalized
    .sort((a, b) => {
      if (a.tag === post.tag && b.tag !== post.tag) return -1;
      if (a.tag !== post.tag && b.tag === post.tag) return 1;
      return 0;
    })
    .slice(0, limit);
}

export function buildBlogListJsonLd(posts = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: BLOG_SEO.title,
    description: BLOG_SEO.description,
    url: absoluteUrl('/blog'),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.slice(0, 12).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: post.url,
        name: post.title,
      })),
    },
  };
}

export function buildArticleJsonLd(post) {
  if (!post) return null;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      image: post.coverUrl,
      datePublished: post.publishedIso,
      dateModified: post.updatedIso || post.publishedIso,
      author: { '@type': 'Person', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: absoluteUrl('/traffic68_com.gif') },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': post.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: absoluteUrl('/blog') },
        { '@type': 'ListItem', position: 3, name: post.title, item: post.url },
      ],
    },
  ];
}
