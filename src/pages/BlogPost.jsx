import { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Check, Clock, Copy, Facebook, Linkedin, ListTree, Send, Share2, Tag, User } from 'lucide-react';
import Footer from '../components/Footer';
import api from '../lib/api';
import { posts as fallbackPosts } from '../data/blogPosts';
import { buildArticleJsonLd, getPublishedPosts, getRelatedPosts, normalizePost, stripMarkdown } from '../lib/blog';

function slugify(value = '') {
  return stripMarkdown(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatInline(text = '') {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith('**')) parts.push(<strong key={key} className="text-[#10245c] font-black">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={key} className="rounded-md bg-orange-50 px-1.5 py-0.5 text-sm font-mono text-[#c2410c]">{token.slice(1, -1)}</code>);
    else parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function extractToc(content = '') {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('## ') || line.startsWith('### '))
    .map((line) => {
      const depth = line.startsWith('### ') ? 3 : 2;
      const title = line.slice(depth + 1).trim();
      return { id: slugify(title), title, depth };
    });
}

function renderTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) break;
    if (!/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
      rows.push(trimmed.split('|').slice(1, -1).map((cell) => cell.trim()));
    }
    index++;
  }
  return { rows, nextIndex: index };
}

function renderContent(content = '') {
  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      const depth = trimmed.startsWith('### ') ? 3 : 2;
      const title = trimmed.slice(depth + 1).trim();
      const TagName = depth === 2 ? 'h2' : 'h3';
      elements.push(
        <TagName
          key={`h-${i}`}
          id={slugify(title)}
          className={depth === 2 ? 'scroll-mt-24 text-2xl sm:text-3xl font-black text-[#10245c] mt-12 mb-5 border-l-4 border-[#f97316] pl-5' : 'scroll-mt-24 text-xl font-black text-[#17346f] mt-8 mb-3'}
        >
          {title}
        </TagName>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`q-${i}`} className="my-6 rounded-2xl border-l-4 border-[#f97316] bg-orange-50 px-6 py-5 text-[#10245c] font-semibold leading-relaxed">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const { rows, nextIndex } = renderTable(lines, i);
      if (rows.length > 0) {
        const [head, ...body] = rows;
        elements.push(
          <div key={`table-${i}`} className="my-8 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-[#10245c] text-white">
                <tr>{head.map((cell) => <th key={cell} className="px-4 py-3 text-left font-black">{formatInline(cell)}</th>)}</tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100 odd:bg-slate-50/70">
                    {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-600">{formatInline(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      i = nextIndex;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-5 space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-3 text-slate-700 leading-relaxed">
              <span className="mt-2 h-2 w-2 rounded-full bg-[#f97316] shrink-0" />
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const numbered = trimmed.match(/^(\d+)\.\s(.+)/);
    if (numbered) {
      const items = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(/^(\d+)\.\s(.+)/);
        if (!match) break;
        items.push(match[2]);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-5 space-y-3 counter-reset-list">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-3 text-slate-700 leading-relaxed">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10245c] text-white text-xs font-black shrink-0">{idx + 1}</span>
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(<p key={`p-${i}`} className="text-[17px] leading-8 text-slate-700 mb-5">{formatInline(trimmed)}</p>);
    i++;
  }

  return elements;
}

function ShareButtons({ post }) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(post.url);
  const encodedTitle = encodeURIComponent(post.title);
  const links = [
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
  ];

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: post.title, text: post.description, url: post.url });
      return;
    }
    await navigator.clipboard.writeText(post.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(post.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={shareNative} className="inline-flex items-center gap-2 rounded-full bg-[#10245c] px-4 py-2 text-sm font-bold text-white hover:bg-[#f97316] transition">
        <Share2 className="w-4 h-4" /> Chia sẻ
      </button>
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
        <a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={`Chia sẻ lên ${link.label}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316] transition">
          <LinkIcon className="w-4 h-4" />
        </a>
        );
      })}
      <button onClick={copyLink} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316] transition" aria-label="Sao chép liên kết">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPost = async () => {
      setLoading(true);
      try {
        const [detail, list] = await Promise.allSettled([
          api.get(`/blog/${slug}`),
          api.get('/blog'),
        ]);

        const sourcePosts = list.status === 'fulfilled' && list.value.posts?.length ? list.value.posts : fallbackPosts;
        const normalizedPosts = getPublishedPosts(sourcePosts);
        const current = detail.status === 'fulfilled' && detail.value.post
          ? normalizePost(detail.value.post)
          : normalizedPosts.find((item) => item.slug === slug) || getPublishedPosts(fallbackPosts).find((item) => item.slug === slug);

        if (mounted) {
          setPost(current || null);
          setPosts(normalizedPosts.length ? normalizedPosts : getPublishedPosts(fallbackPosts));
        }
      } catch {
        const fallback = getPublishedPosts(fallbackPosts);
        if (mounted) {
          setPost(fallback.find((item) => item.slug === slug) || null);
          setPosts(fallback);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPost();
    return () => { mounted = false; };
  }, [slug]);

  const toc = useMemo(() => extractToc(post?.content || ''), [post]);
  const related = useMemo(() => getRelatedPosts(posts, post, 3), [posts, post]);

  usePageTitle(post ? {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    canonicalPath: `/blog/${post.slug}`,
    image: post.cover,
    type: 'article',
    publishedTime: post.publishedIso,
    modifiedTime: post.updatedIso,
    jsonLd: buildArticleJsonLd(post),
  } : {
    title: 'Blog',
    description: 'Bài viết Traffic68 về SEO, traffic user thật và tăng trưởng website.',
    canonicalPath: `/blog/${slug}`,
  });

  if (loading) {
    return (
      <>
        <div className="min-h-[70vh] bg-[#f6f8fc] px-4 py-16">
          <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
            <div className="h-12 w-2/3 rounded-2xl bg-white" />
            <div className="h-72 rounded-[2rem] bg-white" />
            <div className="grid lg:grid-cols-[1fr_280px] gap-8">
              <div className="h-96 rounded-3xl bg-white" />
              <div className="h-72 rounded-3xl bg-white" />
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <div className="min-h-[70vh] flex items-center justify-center bg-[#f6f8fc] px-4">
          <div className="text-center bg-white rounded-[2rem] border border-slate-200 p-10 max-w-lg">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-[#10245c] mb-2">Bài viết không tồn tại</h1>
            <p className="text-slate-500 mb-6">Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <Link to="/blog" className="inline-flex items-center gap-2 text-[#f97316] font-black hover:underline">
              <ArrowLeft size={16} /> Quay lại Blog
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <section className="blog-hero relative overflow-hidden bg-[#071633] py-14 sm:py-20">
        <div className="absolute inset-0 blog-grid opacity-70" />
        <div className="absolute -right-24 top-10 h-96 w-96 rounded-full bg-[#f97316]/20 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-blue-100/70">
            <Link to="/" className="hover:text-white">Trang chủ</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-white">Blog</Link>
            <span>/</span>
            <span className="text-orange-200">{post.tag}</span>
          </nav>

          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${post.tagColor}`}><Tag className="w-3 h-3" /> {post.tag}</span>
              <span className="inline-flex items-center gap-1.5 text-blue-100/80 text-sm"><Clock className="w-4 h-4" /> {post.readTime}</span>
              <span className="inline-flex items-center gap-1.5 text-blue-100/80 text-sm"><Calendar className="w-4 h-4" /> {post.dateLabel}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight mb-6">{post.title}</h1>
            <p className="text-lg sm:text-xl text-blue-100/85 leading-relaxed max-w-3xl mb-8">{post.description}</p>
            <div className="flex flex-wrap items-center gap-5 text-blue-100/80">
              <span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-[#f97316]" /> {post.author}</span>
              <ShareButtons post={post} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8fc] pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-10 relative rounded-[2rem] overflow-hidden border border-white shadow-2xl bg-slate-900 mb-12">
            <img src={post.cover} alt={post.title} className="w-full max-h-[520px] object-cover" loading="eager" />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-10 items-start">
            <main className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-10 shadow-sm">
              <article className="blog-prose">
                {post.content ? renderContent(post.content) : <p className="text-slate-500">Nội dung đang được cập nhật...</p>}
              </article>

              <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <Link to="/blog" className="inline-flex items-center gap-2 text-[#10245c] font-black hover:text-[#f97316] transition">
                  <ArrowLeft size={16} /> Quay lại Blog
                </Link>
                <ShareButtons post={post} />
              </div>
            </main>

            <aside className="lg:sticky lg:top-24 space-y-6">
              {toc.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-[#10245c] font-black mb-4"><ListTree className="w-5 h-5 text-[#f97316]" /> Mục lục</h2>
                  <div className="space-y-2">
                    {toc.map((item) => (
                      <a key={item.id} href={`#${item.id}`} className={`block text-sm leading-snug hover:text-[#f97316] transition ${item.depth === 3 ? 'pl-4 text-slate-500' : 'text-slate-700 font-bold'}`}>
                        {item.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-[#10245c] font-black mb-4"><BookOpen className="w-5 h-5 text-[#f97316]" /> Đọc tiếp</h2>
                <div className="space-y-4">
                  {related.map((item) => (
                    <Link key={item.slug} to={`/blog/${item.slug}`} className="group grid grid-cols-[84px_1fr] gap-3">
                      <img src={item.cover} alt={item.title} className="h-20 w-20 rounded-2xl object-cover" loading="lazy" />
                      <div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${item.tagColor}`}>{item.tag}</span>
                        <h3 className="mt-2 line-clamp-2 text-sm font-black text-[#10245c] group-hover:text-[#f97316] transition">{item.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl bg-[#10245c] p-6 text-white shadow-sm relative">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#f97316]/30 blur-2xl" />
                <div className="relative">
                  <p className="text-orange-200 font-black text-xs uppercase tracking-[0.2em] mb-3">Traffic audit</p>
                  <h2 className="text-2xl font-black leading-tight mb-3">Cần user thật cho website?</h2>
                  <p className="text-blue-100/80 text-sm leading-relaxed mb-5">Nhận tư vấn cách tăng traffic an toàn, giữ tín hiệu SEO sạch và đo được hiệu quả.</p>
                  <Link to="/lien-he" className="orange-btn inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white">
                    Liên hệ ngay <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
