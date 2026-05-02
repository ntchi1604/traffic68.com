import { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Image, Code, Quote, Heading1, Heading2, Eye, EyeOff, Upload } from 'lucide-react';

export default function MarkdownEditor({ value, onChange, placeholder = 'Nhập nội dung...', onUploadImage }) {
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);

  const insertMarkdown = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newText = value.substring(0, start) + before + textToInsert + after + value.substring(end);
    onChange({ target: { value: newText } });

    setTimeout(() => {
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertHeading = (level) => {
    const prefix = '#'.repeat(level) + ' ';
    insertMarkdown(prefix, '', 'Tiêu đề');
  };

  const insertBold = () => insertMarkdown('**', '**', 'text in đậm');
  const insertItalic = () => insertMarkdown('*', '*', 'text in nghiêng');
  const insertLink = () => insertMarkdown('[', '](https://example.com)', 'text link');
  const insertImage = () => insertMarkdown('![', '](/path/to/image.png)', 'alt text');
  const insertCode = () => insertMarkdown('`', '`', 'code');
  const insertQuote = () => insertMarkdown('> ', '', 'trích dẫn');
  const insertList = () => insertMarkdown('- ', '', 'mục danh sách');
  const insertOrderedList = () => insertMarkdown('1. ', '', 'mục danh sách');

  const handleUploadImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      const asset = await onUploadImage(file);
      if (asset && asset.url) insertMarkdown('![', `](${asset.url})`, asset.alt || 'alt text');
    } finally {
      setUploading(false);
    }
  };

  const renderPreview = (md) => {
    return md
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<figure class="my-4"><img src="$2" alt="$1" class="max-w-full rounded-lg shadow-sm" /><figcaption class="text-xs text-slate-500 mt-2">$1</figcaption></figure>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-slate-800 mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-slate-800 mt-6 mb-3">$1</h1>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-indigo-500 bg-indigo-50 px-4 py-2 my-3 text-slate-700">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">• $1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-indigo-600 underline">$1</a>')
      .replace(/\n\n/g, '<br/><br/>');
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => insertHeading(1)}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          onClick={() => insertHeading(2)}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <div className="w-px bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={insertBold}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={insertItalic}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <div className="w-px bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={insertList}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={insertOrderedList}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={insertLink}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Insert Link"
        >
          <Link2 size={16} />
        </button>
        <button
          type="button"
          onClick={insertImage}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Insert Image"
        >
          <Image size={16} />
        </button>
        <label className="p-2 hover:bg-slate-200 rounded-lg transition cursor-pointer" title="Upload Image">
          <Upload size={16} />
          <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" disabled={uploading} />
        </label>
        <button
          type="button"
          onClick={insertCode}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Inline Code"
        >
          <Code size={16} />
        </button>
        <button
          type="button"
          onClick={insertQuote}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title="Quote"
        >
          <Quote size={16} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="p-2 hover:bg-slate-200 rounded-lg transition"
          title={showPreview ? 'Hide Preview' : 'Show Preview'}
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Editor / Preview */}
      <div className="grid" style={{ gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={15}
          className="w-full px-4 py-3 focus:outline-none font-mono text-sm resize-none"
        />
        {showPreview && (
          <div className="border-l border-slate-200 px-4 py-3 bg-slate-50 overflow-y-auto max-h-[400px]">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        {value.length} ký tự • Hỗ trợ Markdown {uploading ? '• Đang upload ảnh...' : ''}
      </div>
    </div>
  );
}
