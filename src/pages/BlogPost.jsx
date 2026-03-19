import { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Tag, User, Calendar, ChevronRight, BookOpen, Share2, MessageCircle, Send } from 'lucide-react';
import { posts } from '../data/blogPosts';
import Footer from '../components/Footer';

/* Social share buttons */
const socials = [
  { label: 'Share', bg: 'bg-gray-600', icon: '🔗' },
  { label: 'Tweet', bg: 'bg-[#1DA1F2]', icon: '𝕏' },
  { label: 'Facebook', bg: 'bg-[#1877F2]', icon: 'f' },
  { label: 'WhatsApp', bg: 'bg-[#25D366]', icon: '📱' },
  { label: 'Pinterest', bg: 'bg-[#E60023]', icon: '📌' },
  { label: 'Telegram', bg: 'bg-[#0088cc]', icon: '✈' },
  { label: 'LinkedIn', bg: 'bg-[#0A66C2]', icon: 'in' },
];

export default function BlogPost() {
  const { slug } = useParams();
  const post = posts.find(p => p.slug === slug);
  const [comment, setComment] = useState('');
  usePageTitle(post ? post.title : 'Blog');

  if (!post) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-[#1e3a8a] mb-2">Bài viết không tồn tại</h1>
            <p className="text-gray-400 mb-6">Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <Link to="/blog" className="inline-flex items-center gap-2 text-[#f97316] font-bold hover:underline">
              <ArrowLeft size={16} /> Quay lại Blog
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const inlineFormat = (text) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-800">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-[#1e3a8a] px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  };

  const renderContent = (md) => {
    const lines = md.split('\n');
    const elements = [];
    let firstH2Found = false;
    let topicClusterInserted = false;
    let h2Count = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) { elements.push(<br key={i} />); continue; }

      // H2
      if (trimmed.startsWith('## ')) {
        h2Count++;
        const heading = trimmed.slice(3);
        elements.push(
          <h2 key={i} className="text-xl sm:text-2xl font-black text-[#1e3a8a] mt-10 mb-4 border-l-4 border-[#f97316] pl-4">
            {heading}
          </h2>
        );

        // Insert social share after first H2
        if (!firstH2Found) {
          firstH2Found = true;
          elements.push(
            <div key={`share-${i}`} className="mb-6">
              <p className="text-xs text-gray-400 mb-2">Chia sẻ mạng xã hội:</p>
              <div className="flex flex-wrap gap-2">
                {socials.map(s => (
                  <button
                    key={s.label}
                    className={`${s.bg} text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-80 transition flex items-center gap-1.5`}
                  >
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        // Insert topic cluster image after H2 #4 (or wherever relevant)
        if (h2Count === 4 && !topicClusterInserted) {
          topicClusterInserted = true;
          elements.push(
            <div key={`topic-${i}`} className="my-6 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <img src="/blog_topic_clusters.png" alt="Topic Clusters & Sơ Đồ Nội Dung" className="w-full" />
            </div>
          );
        }
        continue;
      }
      // H3
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-lg font-bold text-[#1e3a5f] mt-6 mb-3">{trimmed.slice(4)}</h3>
        );
        continue;
      }
      // Blockquote
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-[#f97316] bg-orange-50 px-5 py-3 my-4 rounded-r-xl">
            <p className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(2)) }} />
          </blockquote>
        );
        continue;
      }
      // Table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        continue;
      }
      // Unordered list
      if (trimmed.startsWith('- ')) {
        elements.push(
          <li key={i} className="flex items-start gap-2 text-gray-600 text-[15px] leading-relaxed ml-4 mb-1.5">
            <span className="text-[#f97316] mt-1.5 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(2)) }} />
          </li>
        );
        continue;
      }
      // Numbered list
      const numMatch = trimmed.match(/^(\d+)\.\s(.+)/);
      if (numMatch) {
        elements.push(
          <li key={i} className="flex items-start gap-2 text-gray-600 text-[15px] leading-relaxed ml-4 mb-1.5">
            <span className="text-[#1e3a8a] font-bold shrink-0">{numMatch[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: inlineFormat(numMatch[2]) }} />
          </li>
        );
        continue;
      }
      // Paragraph
      elements.push(
        <p key={i} className="text-gray-600 text-[15px] leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
      );
    }
    return elements;
  };

  const related = posts.filter(p => p.id !== post.id).slice(0, 4);
  const allTags = [...new Set(posts.map(p => p.tag))];

  return (
    <>
      <section className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Main Content (Left) ── */}
            <div className="lg:col-span-2">
              {/* Post meta above title */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${post.tagColor} flex items-center gap-1`}>
                  <Tag size={12} /> {post.tag}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} /> {post.readTime}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a5f] leading-tight mb-4">
                {post.title}
              </h1>

              {/* Author / Date / Tags */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-gray-400" /> Tác giả: <strong className="text-gray-700">{post.author}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" /> Ngày đăng: <strong className="text-gray-700">{post.date}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Tag:</span>
                  {allTags.slice(0, 3).map(t => {
                    const colors = { SEO: 'bg-blue-100 text-blue-700', Traffic: 'bg-orange-100 text-orange-700', CRO: 'bg-green-100 text-green-700' };
                    return (
                      <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[t] || 'bg-gray-100 text-gray-600'}`}>{t}</span>
                    );
                  })}
                </div>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" /> Thời gian đọc: <strong className="text-gray-700">{post.readTime}</strong>
                </span>
              </div>

              {/* Featured Image */}
              <div className="rounded-2xl overflow-hidden mb-8 border border-gray-100 shadow-sm">
                <img
                  src={post.id === 1 ? '/blog_featured_seo.png' : post.cover}
                  alt={post.title}
                  className="w-full object-cover"
                />
              </div>

              {/* Article content */}
              <article className="prose-custom">
                {renderContent(post.content)}
              </article>

              {/* Comment section */}
              <div className="mt-12 pt-8 border-t border-gray-100">
                <h3 className="text-lg font-black text-[#1e3a8a] mb-5 flex items-center gap-2">
                  <MessageCircle size={20} className="text-[#f97316]" /> Bình luận
                </h3>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Thân bình luận..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none bg-white"
                      />
                      <button className="mt-3 inline-flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all">
                        <Send size={14} /> Chia sẻ bình luận của bạn
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Back link */}
              <div className="mt-8">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 text-[#1e3a8a] font-bold hover:text-[#f97316] transition text-sm"
                >
                  <ArrowLeft size={16} /> Quay lại Blog
                </Link>
              </div>
            </div>

            {/* ── Sidebar (Right) ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-6">
                <h3 className="text-base font-black text-[#1e3a8a] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
                  <BookOpen size={16} className="text-[#f97316]" /> Bài viết liên quan
                </h3>

                {/* Related post cards */}
                <div className="space-y-4">
                  {related.map(p => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      className="group flex gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-all hover:-translate-y-0.5"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                        <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.tagColor}`}>{p.tag}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock size={9} /> {p.readTime}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#1e3a5f] leading-snug mb-1 line-clamp-2 group-hover:text-[#f97316] transition">
                          {p.title}
                        </h4>
                        <span className="text-[10px] text-[#f97316] font-bold">
                          Đọc thêm →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* CTA Sidebar */}
                <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-2xl p-6 text-center">
                  <p className="text-white font-black text-base mb-2 leading-snug">
                    Bắt đầu Chiến dịch SEO bền vững của bạn.
                  </p>
                  <p className="text-white/80 text-xs mb-4">
                    Liên hệ ngay để nhận tư vấn miễn phí!
                  </p>
                  <Link
                    to="/lien-he"
                    className="inline-block bg-white text-[#f97316] font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-orange-50 transition shadow-md"
                  >
                    Liên hệ ngay!
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
