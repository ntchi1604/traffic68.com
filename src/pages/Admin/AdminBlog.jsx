import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, Tag, Calendar, Clock } from 'lucide-react';
import api from '../../lib/api';

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover: '',
    tag: 'SEO',
    tag_color: 'bg-blue-100 text-blue-700',
    author: 'Admin',
    read_time: '5 phút đọc',
    gradient: 'from-blue-500 to-blue-700',
    status: 'draft',
  });

  const tags = [
    { value: 'SEO', color: 'bg-blue-100 text-blue-700', gradient: 'from-blue-500 to-blue-700' },
    { value: 'Traffic', color: 'bg-orange-100 text-orange-700', gradient: 'from-orange-400 to-orange-600' },
    { value: 'CRO', color: 'bg-green-100 text-green-700', gradient: 'from-emerald-500 to-emerald-700' },
    { value: 'Case Study', color: 'bg-purple-100 text-purple-700', gradient: 'from-purple-500 to-purple-700' },
    { value: 'Hướng dẫn', color: 'bg-pink-100 text-pink-700', gradient: 'from-pink-500 to-rose-600' },
  ];

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const data = await api.get('/admin/blog');
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPost) {
        await api.put(`/admin/blog/${editingPost.id}`, formData);
      } else {
        await api.post('/admin/blog', formData);
      }
      fetchPosts();
      closeModal();
    } catch (error) {
      console.error('Error saving post:', error);
      alert('Lỗi khi lưu bài viết');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    try {
      await api.delete(`/admin/blog/${id}`);
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Lỗi khi xóa bài viết');
    }
  };

  const toggleStatus = async (post) => {
    try {
      const newStatus = post.status === 'published' ? 'draft' : 'published';
      await api.put(`/admin/blog/${post.id}`, { status: newStatus });
      fetchPosts();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const openModal = (post = null) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        cover: post.cover || '',
        tag: post.tag,
        tag_color: post.tag_color,
        author: post.author,
        read_time: post.read_time,
        gradient: post.gradient,
        status: post.status,
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        cover: '',
        tag: 'SEO',
        tag_color: 'bg-blue-100 text-blue-700',
        author: 'Admin',
        read_time: '5 phút đọc',
        gradient: 'from-blue-500 to-blue-700',
        status: 'draft',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title) => {
    setFormData({ ...formData, title, slug: generateSlug(title) });
  };

  const handleTagChange = (tagValue) => {
    const selectedTag = tags.find(t => t.value === tagValue);
    setFormData({
      ...formData,
      tag: tagValue,
      tag_color: selectedTag.color,
      gradient: selectedTag.gradient,
    });
  };

  const filtered = posts.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === 'all' || p.tag === filterTag;
    return matchSearch && matchTag;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Quản lý Blog</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý bài viết blog của website</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition"
        >
          <Plus size={16} /> Tạo bài viết
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả tags</option>
            {tags.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Bài viết</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Tag</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Tác giả</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Ngày tạo</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    Không có bài viết nào
                  </td>
                </tr>
              ) : (
                filtered.map(post => (
                  <tr key={post.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.cover && (
                          <img src={post.cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{post.title}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Clock size={10} /> {post.read_time}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${post.tag_color}`}>
                        {post.tag}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{post.author}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {post.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(post)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition"
                          title={post.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'}
                        >
                          {post.status === 'published' ? (
                            <EyeOff size={16} className="text-slate-600" />
                          ) : (
                            <Eye size={16} className="text-green-600" />
                          )}
                        </button>
                        <button
                          onClick={() => openModal(post)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit2 size={16} className="text-indigo-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">
                {editingPost ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <Plus size={20} className="rotate-45 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Slug (URL)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tag</label>
                  <select
                    value={formData.tag}
                    onChange={(e) => handleTagChange(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {tags.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian đọc</label>
                  <input
                    type="text"
                    value={formData.read_time}
                    onChange={(e) => setFormData({ ...formData, read_time: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="5 phút đọc"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tác giả</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="draft">Nháp</option>
                    <option value="published">Xuất bản</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ảnh bìa (URL)</label>
                <input
                  type="text"
                  value={formData.cover}
                  onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="/blog_1.png"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mô tả ngắn</label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nội dung (Markdown)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition"
                >
                  {editingPost ? 'Cập nhật' : 'Tạo bài viết'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-semibold transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
