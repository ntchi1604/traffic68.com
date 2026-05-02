import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, Clock, Upload, X, FileText } from 'lucide-react';
import api from '../../lib/api';
import MarkdownEditor from '../../components/MarkdownEditor';

const initialFormData = {
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
  seo_title: '',
  seo_description: '',
  focus_keyword: '',
  cover_alt: '',
  category: 'SEO',
  content_assets: '[]',
  scheduled_at: '',
};

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [uploading, setUploading] = useState(false);

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
      setSelectedIds([]);
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

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    const status = bulkAction === 'publish' ? 'published' : 'draft';
    try {
      await Promise.all(selectedIds.map(id => api.put(`/admin/blog/${id}`, { status })));
      setBulkAction('');
      fetchPosts();
    } catch (error) {
      console.error('Error applying bulk action:', error);
      alert('Lỗi khi cập nhật hàng loạt');
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
        seo_title: post.seo_title || '',
        seo_description: post.seo_description || '',
        focus_keyword: post.focus_keyword || '',
        cover_alt: post.cover_alt || '',
        category: post.category || post.tag || 'SEO',
        content_assets: post.content_assets || '[]',
        scheduled_at: post.scheduled_at ? String(post.scheduled_at).slice(0, 16) : '',
      });
    } else {
      setEditingPost(null);
      setFormData(initialFormData);
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

  const uploadBlogImage = async (file, alt = '') => {
    if (!file) return null;
    if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn file ảnh');
    if (file.size > 8 * 1024 * 1024) throw new Error('Kích thước ảnh không được vượt quá 8MB');

    const formDataUpload = new FormData();
    formDataUpload.append('image', file);
    const response = await fetch('/api/admin/upload-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formDataUpload,
    });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || 'Lỗi khi upload ảnh');
    const asset = { ...(data.asset || {}), url: data.url, alt };
    const currentAssets = JSON.parse(formData.content_assets || '[]');
    setFormData(prev => ({ ...prev, content_assets: JSON.stringify([asset, ...currentAssets].slice(0, 40)) }));
    return asset;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadBlogImage(file, formData.cover_alt || formData.title || 'Ảnh bài viết');
      if (asset) setFormData(prev => ({ ...prev, cover: asset.url, cover_alt: prev.cover_alt || prev.title }));
    } catch (error) {
      alert(error.message || 'Lỗi khi upload ảnh');
    } finally {
      setUploading(false);
    }
  };

  const counts = {
    all: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status !== 'published').length,
  };

  const filtered = posts.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === 'all' || p.tag === filterTag;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'published' ? p.status === 'published' : p.status !== 'published');
    return matchSearch && matchTag && matchStatus;
  });

  const filteredIds = filtered.map(post => post.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    setSelectedIds(allFilteredSelected ? selectedIds.filter(id => !filteredIds.includes(id)) : Array.from(new Set([...selectedIds, ...filteredIds])));
  };

  const toggleSelected = (id) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : [...selectedIds, id]);
  };

  const statusTabs = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'published', label: 'Đã xuất bản', count: counts.published },
    { key: 'draft', label: 'Nháp', count: counts.draft },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-slate-900">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bài viết</h1>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-1 rounded border border-[#2271b1] bg-[#2271b1] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#135e96]"
            >
              <Plus size={15} /> Thêm bài viết mới
            </button>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          {selectedIds.length > 0 ? `${selectedIds.length} bài viết được chọn` : `${filtered.length} bài viết hiển thị`}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {statusTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`border-r border-slate-300 pr-3 last:border-r-0 ${filterStatus === tab.key ? 'font-semibold text-[#2271b1]' : 'text-[#2271b1] hover:text-[#135e96]'}`}
          >
            {tab.label} <span className="text-slate-500">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-3 rounded border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="h-9 rounded border border-slate-300 bg-white px-3 text-sm focus:border-[#2271b1] focus:outline-none"
          >
            <option value="">Tác vụ hàng loạt</option>
            <option value="publish">Đặt thành đã xuất bản</option>
            <option value="draft">Chuyển về nháp</option>
          </select>
          <button
            onClick={applyBulkAction}
            disabled={!bulkAction || selectedIds.length === 0}
            className="h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Áp dụng
          </button>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="h-9 rounded border border-slate-300 bg-white px-3 text-sm focus:border-[#2271b1] focus:outline-none"
          >
            <option value="all">Tất cả tag</option>
            {tags.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
          </select>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm bài viết..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded border border-slate-300 pl-9 pr-3 text-sm focus:border-[#2271b1] focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f6f7f7] text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="rounded border-slate-300" />
                </th>
                <th className="px-4 py-3">Tiêu đề</th>
                <th className="px-4 py-3">Tác giả</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-16 text-center text-slate-400">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    Không có bài viết nào
                  </td>
                </tr>
              ) : (
                filtered.map(post => (
                  <tr key={post.id} className="group hover:bg-[#f6f7f7]">
                    <td className="px-4 py-4 align-top">
                      <input type="checkbox" checked={selectedIds.includes(post.id)} onChange={() => toggleSelected(post.id)} className="rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex gap-3">
                        {post.cover ? (
                          <img src={post.cover} alt="" className="h-14 w-20 rounded border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-14 w-20 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-300">
                            <FileText size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <button onClick={() => openModal(post)} className="text-left text-[15px] font-semibold text-[#2271b1] hover:text-[#135e96] hover:underline">
                            {post.title}
                          </button>
                          <p className="mt-1 max-w-xl truncate text-xs text-slate-500">/{post.slug}</p>
                          <p className="mt-1 max-w-xl truncate text-xs text-slate-500">{post.excerpt}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <button onClick={() => openModal(post)} className="text-[#2271b1] hover:text-[#135e96]">Sửa</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => toggleStatus(post)} className="text-[#2271b1] hover:text-[#135e96]">
                              {post.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'}
                            </button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => handleDelete(post.id)} className="text-red-600 hover:text-red-700">Xóa</button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{post.author}</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${post.tag_color}`}>{post.tag}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {post.status === 'published' ? <Eye size={12} /> : <EyeOff size={12} />}
                        {post.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      <div>{new Date(post.created_at).toLocaleDateString('vi-VN')}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock size={12} /> {post.read_time}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm lg:p-6">
          <div className="w-full max-w-7xl rounded bg-[#f0f0f1] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-white px-4 py-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingPost ? 'Chỉnh sửa bài viết' : 'Thêm bài viết mới'}</h2>
                <p className="text-xs text-slate-500">Editor kiểu WordPress, dữ liệu giữ nguyên.</p>
              </div>
              <button onClick={closeModal} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="rounded border border-slate-300 bg-white p-4">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full border-0 border-b border-slate-200 px-0 pb-3 text-3xl font-semibold tracking-tight text-slate-900 focus:border-[#2271b1] focus:outline-none"
                    placeholder="Thêm tiêu đề"
                    required
                  />
                  <div className="mt-3 text-sm text-slate-500">
                    Đường dẫn: <span className="text-[#2271b1]">/blog/{formData.slug || 'duong-dan-bai-viet'}</span>
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Mô tả ngắn</label>
                  <textarea
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    rows={3}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                    required
                  />
                </div>

                <div className="rounded border border-slate-300 bg-white p-4">
                  <label className="mb-3 block text-sm font-semibold text-slate-700">Nội dung</label>
                  <MarkdownEditor
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Viết nội dung bài viết..."
                  />
                </div>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <div className="rounded border border-slate-300 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Xuất bản</div>
                  <div className="space-y-3 p-4">
                    <label className="block text-sm font-medium text-slate-700">Trạng thái</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                    >
                      <option value="draft">Nháp</option>
                      <option value="published">Xuất bản</option>
                    </select>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="flex-1 rounded bg-[#2271b1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#135e96]">
                        {editingPost ? 'Cập nhật' : 'Tạo bài viết'}
                      </button>
                      <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Thông tin bài viết</div>
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tác giả</label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tag</label>
                      <select
                        value={formData.tag}
                        onChange={(e) => handleTagChange(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                      >
                        {tags.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Thời gian đọc</label>
                      <input
                        type="text"
                        value={formData.read_time}
                        onChange={(e) => setFormData({ ...formData, read_time: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                        placeholder="5 phút đọc"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Ảnh đại diện</div>
                  <div className="space-y-3 p-4">
                    {formData.cover && (
                      <img src={formData.cover} alt="Preview" className="h-40 w-full rounded border border-slate-200 object-cover" />
                    )}
                    <input
                      type="text"
                      value={formData.cover}
                      onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#2271b1] focus:outline-none"
                      placeholder="/blog_1.png hoặc https://..."
                    />
                    <label className="block cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                      <div className="flex items-center justify-center gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Upload size={15} />}
                        {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
                      </div>
                    </label>
                  </div>
                </div>
              </aside>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
