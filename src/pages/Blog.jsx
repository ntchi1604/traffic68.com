import { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, Clock, Search, Sparkles, Target, TrendingUp } from 'lucide-react';
import Footer from '../components/Footer';
import api from '../lib/api';
import { posts as fallbackPosts } from '../data/blogPosts';
import { BLOG_SEO, buildBlogListJsonLd, getPublishedPosts } from '../lib/blog';

const tags = ['Tất cả', 'SEO', 'Traffic', 'CRO', 'Case Study', 'Hướng dẫn'];
const metrics = [
  { label: 'Traffic user thật', value: '100%', icon: Target },
  { label: 'Playbook SEO', value: 'Thực chiến', icon: BookOpen },
  { label: 'Tối ưu tăng trưởng', value: 'CRO', icon: TrendingUp },
];

function BlogCard({ post, featured = false }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`group blog-card bg-white border border-slate-200 overflow-hidden ${featured ? 'grid lg:grid-cols-[1.08fr_0.92fr] rounded-[2rem]' : 'rounded-3xl flex flex-col h-full'}`}
    >
      <div className={`relative overflow-hidden bg-slate-900 ${featured ? 'min-h-[320px]' : 'h-56'}`}>
        <img
          src={post.cover}
          alt={post.title}
          className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
          loading={featured ? 'eager' : 'lazy'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071633]/75 via-transparent to-transparent" />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black ${post.tagColor}`}>{post.tag}</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 text-slate-700 backdrop-blur">{post.readTime}</span>
        </div>
      </div>

      <div className={`p-6 sm:p-8 flex flex-col ${featured ? 'justify-center bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.10),transparent_34%)]' : 'flex-1'}`}>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mb-4">
          <span>{post.author}</span>
          <span className="w-1 h-1 rounded-full bg-[#f97316]" />
          <span>{post.dateLabel}</span>
        </div>
        <h2 className={`${featured ? 'text-2xl sm:text-4xl' : 'text-lg'} font-black text-[#10245c] leading-tight mb-4 group-hover:text-[#f97316] transition-colors`}>
          {post.title}
        </h2>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 line-clamp-3">{post.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-2 text-[#f97316] font-black text-sm">
          {featured ? 'Đọc chiến lược' : 'Đọc bài viết'} <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [activeTag, setActiveTag] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPosts = async () => {
      try {
        const data = await api.get('/blog');
        const source = data.posts && data.posts.length > 0 ? data.posts : fallbackPosts;
        if (mounted) setPosts(getPublishedPosts(source));
      } catch {
        if (mounted) setPosts(getPublishedPosts(fallbackPosts));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPosts();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchTag = activeTag === 'Tất cả' || post.tag === activeTag;
      const matchQuery = !needle || `${post.title} ${post.excerpt} ${post.tag}`.toLowerCase().includes(needle);
      return matchTag && matchQuery;
    });
  }, [posts, activeTag, query]);

  const featured = filtered[0];
  const rest = featured ? filtered.slice(1) : [];

  usePageTitle({
    title: BLOG_SEO.title,
    description: BLOG_SEO.description,
    keywords: BLOG_SEO.keywords,
    canonicalPath: '/blog',
    image: featured?.cover,
    jsonLd: buildBlogListJsonLd(posts),
  });

  return (
    <>
      <section className="blog-hero relative overflow-hidden bg-[#071633] py-20 sm:py-24">
        <div className="absolute inset-0 blog-grid opacity-70" />
        <div className="absolute -top-32 right-0 w-[520px] h-[520px] rounded-full bg-[#f97316]/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-orange-200 text-sm font-bold mb-6 backdrop-blur">
              <Sparkles className="w-4 h-4" /> Trung tâm kiến thức tăng trưởng website
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-[0.98] tracking-tight mb-6">
              Blog SEO & Traffic <span className="text-[#f97316]">user thật</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100/85 leading-relaxed max-w-3xl mb-8">
              Playbook thực chiến về tăng traffic website, SEO bền vững và tối ưu chuyển đổi cho doanh nghiệp cần user thật thay vì số liệu ảo.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-8 max-w-3xl">
              {metrics.map((metric) => {
                const MetricIcon = metric.icon;
                return (
                <div key={metric.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                  <MetricIcon className="w-5 h-5 text-[#f97316] mb-3" />
                  <p className="text-white font-black text-lg leading-none">{metric.value}</p>
                  <p className="text-blue-100/70 text-xs font-semibold mt-1">{metric.label}</p>
                </div>
                );
              })}
            </div>

            <div className="relative max-w-2xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm SEO, traffic user thật, CRO, case study..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-13 pr-5 py-4 rounded-2xl bg-white text-slate-800 border border-white/40 shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-400/35"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-[#f6f8fc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <p className="text-[#f97316] font-black uppercase tracking-[0.2em] text-xs mb-3">Traffic68 Knowledge Hub</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#10245c]">Bài viết nên đọc trước khi chạy traffic</h2>
              <p className="text-slate-500 mt-3">{loading ? 'Đang tải bài viết...' : `${filtered.length} bài viết phù hợp`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-black border transition-all focus:outline-none focus:ring-4 focus:ring-orange-300/40 ${activeTag === tag ? 'bg-[#10245c] text-white border-[#10245c] shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-[#f97316] hover:text-[#f97316]'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((item) => <div key={item} className="h-80 rounded-3xl bg-white border border-slate-200 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-200">
              <BookOpen className="w-14 h-14 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-black text-[#10245c] mb-2">Không tìm thấy bài viết phù hợp</h3>
              <p className="text-slate-500 mb-6">Thử tag khác hoặc xóa từ khóa tìm kiếm.</p>
              <button onClick={() => { setQuery(''); setActiveTag('Tất cả'); }} className="orange-btn text-white font-bold px-5 py-3 rounded-xl">Xem tất cả</button>
            </div>
          ) : (
            <>
              {featured && <div className="mb-8"><BlogCard post={featured} featured /></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {rest.map((post) => <BlogCard key={post.slug} post={post} />)}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#10245c] p-8 sm:p-10 text-white">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.28),transparent_60%)]" />
            <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-orange-200 font-bold text-sm mb-3"><BarChart3 className="w-4 h-4" /> Audit traffic miễn phí</div>
                <h2 className="text-2xl sm:text-4xl font-black mb-3">Muốn tăng traffic nhưng chưa biết bắt đầu từ đâu?</h2>
                <p className="text-blue-100/80 leading-relaxed">Gửi website, Traffic68 sẽ gợi ý hướng tăng user thật, giữ an toàn SEO và đo được bằng dữ liệu.</p>
              </div>
              <Link to="/lien-he" className="orange-btn inline-flex items-center justify-center gap-2 text-white font-black px-7 py-4 rounded-2xl shadow-xl">
                Nhận tư vấn <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
