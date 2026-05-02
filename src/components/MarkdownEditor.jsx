import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Image, Code, Quote, Heading1, Heading2, Upload } from 'lucide-react';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(markdown = '') {
  const lines = String(markdown).split('\n');
  const html = [];
  let listType = null;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  const inline = (text = '') => escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure><img src="$2" alt="$1"><figcaption>$1</figcaption></figure>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) { closeList(); html.push('<p><br></p>'); return; }
    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) { closeList(); html.push(`<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`); return; }
    if (trimmed.startsWith('## ')) { closeList(); html.push(`<h2>${inline(trimmed.slice(3))}</h2>`); return; }
    if (trimmed.startsWith('# ')) { closeList(); html.push(`<h1>${inline(trimmed.slice(2))}</h1>`); return; }
    if (trimmed.startsWith('> ')) { closeList(); html.push(`<blockquote>${inline(trimmed.slice(2))}</blockquote>`); return; }
    if (trimmed.startsWith('- ')) {
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${inline(trimmed.slice(2))}</li>`);
      return;
    }
    const ordered = trimmed.match(/^\d+\.\s(.+)/);
    if (ordered) {
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${inline(ordered[1])}</li>`);
      return;
    }
    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  });
  closeList();
  return html.join('');
}

function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const children = () => Array.from(node.childNodes).map(nodeToMarkdown).join('');

  if (tag === 'strong' || tag === 'b') return `**${children()}**`;
  if (tag === 'em' || tag === 'i') return `*${children()}*`;
  if (tag === 'code') return `\`${children()}\``;
  if (tag === 'a') return `[${children()}](${node.getAttribute('href') || ''})`;
  if (tag === 'img') return `![${node.getAttribute('alt') || 'ảnh'}](${node.getAttribute('src') || ''})`;
  if (tag === 'h1') return `# ${children()}\n\n`;
  if (tag === 'h2') return `## ${children()}\n\n`;
  if (tag === 'blockquote') return `> ${children()}\n\n`;
  if (tag === 'li') return `${children()}`;
  if (tag === 'ul') return Array.from(node.children).map(li => `- ${nodeToMarkdown(li)}\n`).join('') + '\n';
  if (tag === 'ol') return Array.from(node.children).map((li, idx) => `${idx + 1}. ${nodeToMarkdown(li)}\n`).join('') + '\n';
  if (tag === 'figure') {
    const img = node.querySelector('img');
    if (!img) return '';
    return `![${img.getAttribute('alt') || 'ảnh'}](${img.getAttribute('src') || ''})\n\n`;
  }
  if (tag === 'div' || tag === 'p') return `${children()}\n\n`;
  if (tag === 'br') return '\n';
  return children();
}

function htmlToMarkdown(root) {
  return Array.from(root.childNodes).map(nodeToMarkdown).join('').replace(/\n{3,}/g, '\n\n').trim();
}

export default function MarkdownEditor({ value, onChange, placeholder = 'Nhập nội dung...', onUploadImage }) {
  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const focusedRef = useRef(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editorRef.current || focusedRef.current) return;
    editorRef.current.innerHTML = markdownToHtml(value || '');
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    onChange({ target: { value: htmlToMarkdown(editorRef.current) } });
  };

  const command = (cmd, arg = null) => {
    document.execCommand(cmd, false, arg);
    emitChange();
    editorRef.current?.focus();
  };

  const block = (tag) => command('formatBlock', tag);

  const insertImageNode = (asset) => {
    if (!asset?.url) return;
    const alt = asset.alt || 'ảnh';
    document.execCommand('insertHTML', false, `<figure><img src="${asset.url}" alt="${alt}"><figcaption>${alt}</figcaption></figure><p><br></p>`);
    emitChange();
  };

  const uploadAndInsert = async (file) => {
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      const asset = await onUploadImage(file);
      insertImageNode(asset);
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await uploadAndInsert(file);
  };

  const handlePaste = async (e) => {
    const file = Array.from(e.clipboardData?.items || [])
      .find(item => item.type.startsWith('image/'))
      ?.getAsFile();
    if (!file) return;
    e.preventDefault();
    await uploadAndInsert(file);
  };

  const insertLink = () => {
    const url = window.prompt('Nhập URL');
    if (url) command('createLink', url);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1">
        <button type="button" onClick={() => block('h1')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Heading 1"><Heading1 size={16} /></button>
        <button type="button" onClick={() => block('h2')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Heading 2"><Heading2 size={16} /></button>
        <div className="w-px bg-slate-300 mx-1" />
        <button type="button" onClick={() => command('bold')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => command('italic')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Italic"><Italic size={16} /></button>
        <button type="button" onClick={() => command('insertUnorderedList')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Bullet List"><List size={16} /></button>
        <button type="button" onClick={() => command('insertOrderedList')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Numbered List"><ListOrdered size={16} /></button>
        <button type="button" onClick={insertLink} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Insert Link"><Link2 size={16} /></button>
        <button type="button" onClick={() => fileRef.current?.click()} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Upload Image"><Image size={16} /></button>
        <button type="button" onClick={() => command('formatBlock', 'blockquote')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Quote"><Quote size={16} /></button>
        <button type="button" onClick={() => command('formatBlock', 'pre')} className="p-2 hover:bg-slate-200 rounded-lg transition" title="Code"><Code size={16} /></button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        <div className="ml-auto text-xs text-slate-500 px-2 py-2">{uploading ? 'Đang upload ảnh...' : 'Dán ảnh Ctrl+V hoặc kéo file vào nội dung'}</div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onPaste={handlePaste}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; emitChange(); }}
        data-placeholder={placeholder}
        className="wysiwyg-editor min-h-[420px] px-5 py-4 focus:outline-none text-slate-800 leading-relaxed"
      />
    </div>
  );
}
