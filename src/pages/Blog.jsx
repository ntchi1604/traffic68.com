import { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { Clock, Tag, ArrowRight, BookOpen, TrendingUp, Search } from 'lucide-react';
import { posts } from '../data/blogPosts';
import Footer from '../components/Footer';


const tags = ['Tất cả', 'SEO', 'Traffic', 'CRO', 'Case Study', 'Hướng dẫn'];

export default function Blog() {
  usePageTitle('Blog');
  const [activeTag, setActiveTag] = useState('Tất cả');
  const [query, setQuery] = useState('');

  const filtered = posts.filter((p) => {
    const matchTag = activeTag === 'Tất cả' || p.tag === activeTag;
    const matchQ = p.title.toLowerCase().includes(query.toLowerCase()) || p.excerpt.toLowerCase().includes(query.toLowerCase());
    return matchTag && matchQ;
  });

  return (
    <>
      <div className="hero-bg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase">
            Blog <span className="text-[#f97316]">Traffic68</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Kiến thức chuyên sâu về SEO, traffic, CRO và tăng trưởng website từ đội ngũ chuyên gia.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-sm text-gray-700 border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${activeTag === tag ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a8a] hover:text-[#1e3a8a]'}`}
              >
                {tag}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Không tìm thấy bài viết phù hợp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map(({ id, slug, tag, tagColor, title, excerpt, author, date, readTime, cover }) => (
                <Link key={id} to={`/blog/${slug}`} className="card-hover bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col">
                  <div className="h-44 overflow-hidden">
                    <img src={cover} alt={title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tagColor}`}>
                        <Tag className="w-3 h-3 inline mr-1" />{tag}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{readTime}
                      </span>
                    </div>
                    <h2 className="font-black text-[#1e3a8a] text-base mb-2 leading-snug flex-1">{title}</h2>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{excerpt}</p>
                    <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-700">{author}</p>
                        <p className="text-xs text-gray-400">{date}</p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[#f97316] font-bold text-xs">
                        Đọc thêm <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-black text-[#1e3a8a] mb-2">Đăng Ký Nhận Bài Viết Mới</h3>
          <p className="text-gray-500 text-sm mb-6">Nhận kiến thức SEO & traffic mới nhất mỗi tuần vào inbox của bạn.</p>
          <div className="flex gap-3">
            <input type="email" placeholder="Email của bạn..." className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
            <button className="orange-btn text-white font-bold px-5 py-3 rounded-xl text-sm shadow-md">Đăng ký</button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
