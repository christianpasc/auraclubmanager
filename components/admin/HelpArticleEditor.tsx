import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import {
    Bold, Italic, Heading2, Heading3, List, ListOrdered,
    Link as LinkIcon, ImagePlus, Film, Undo, Redo,
} from 'lucide-react';
import { adminHelpCenterService } from '../../services/adminHelpCenterService';
import { HELP_CONTENT_CLASS } from '../help/HelpPublicLayout';

// Renders as a responsive 16:9 iframe — declarative renderHTML/parseHTML spec
// (no React NodeView needed) so it serializes identically in the editor and
// in editor.getHTML(). Accepts YouTube/Vimeo only, never an arbitrary file upload.
const VideoEmbed = Node.create({
    name: 'videoEmbed',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element: HTMLElement) => element.querySelector('iframe')?.getAttribute('src') ?? null,
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-video-embed]' }];
    },

    renderHTML({ node }) {
        return ['div', mergeAttributes({ 'data-video-embed': 'true', style: 'position:relative;padding-top:56.25%;margin:1rem 0;' }),
            ['iframe', {
                src: node.attrs.src,
                style: 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:0.5rem;',
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                allowfullscreen: 'true',
                sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
            }],
        ];
    },
});

function toEmbedUrl(url: string): string | null {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
}

const ToolbarButton: React.FC<{ onClick: () => void; active?: boolean; title: string; children: React.ReactNode }> = ({ onClick, active, title, children }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`p-1.5 rounded transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100'}`}
    >
        {children}
    </button>
);

interface HelpArticleEditorProps {
    content: string;
    onChange: (html: string) => void;
}

const HelpArticleEditor: React.FC<HelpArticleEditorProps> = ({ content, onChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            TiptapImage,
            TiptapLink.configure({ openOnClick: false }),
            VideoEmbed,
        ],
        content: content || '',
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    // Re-syncs the editor's content only when the `content` prop itself changes
    // (e.g. switching language tabs in the parent form) — not on every keystroke,
    // which would fight the user's cursor.
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '', { emitUpdate: false });
        }
    }, [editor, content]);

    if (!editor) return null;

    const insertImage = async (file: File) => {
        try {
            const url = await adminHelpCenterService.uploadArticleImage(file);
            editor.chain().focus().setImage({ src: url }).run();
        } catch (e: any) {
            window.alert(e.message || 'Erro ao enviar imagem.');
        }
    };

    const insertVideo = () => {
        const url = window.prompt('Cole o link do YouTube ou Vimeo:');
        if (!url) return;
        const embedUrl = toEmbedUrl(url);
        if (!embedUrl) { window.alert('Link não reconhecido. Use uma URL do YouTube ou Vimeo.'); return; }
        editor.chain().focus().insertContent({ type: 'videoEmbed', attrs: { src: embedUrl } }).run();
    };

    const insertLink = () => {
        const url = window.prompt('URL do link:');
        if (!url) return;
        editor.chain().focus().setLink({ href: url }).run();
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border-b border-slate-200">
                <ToolbarButton title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Link" active={editor.isActive('link')} onClick={insertLink}><LinkIcon className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Inserir imagem" onClick={() => fileInputRef.current?.click()}><ImagePlus className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Inserir vídeo (YouTube/Vimeo)" onClick={insertVideo}><Film className="w-4 h-4" /></ToolbarButton>
                <div className="w-px bg-slate-200 mx-1" />
                <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></ToolbarButton>
            </div>
            <EditorContent editor={editor} className={HELP_CONTENT_CLASS + ' p-4 min-h-[240px] focus:outline-none [&_.ProseMirror]:outline-none'} />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) insertImage(file);
                    e.target.value = '';
                }}
            />
        </div>
    );
};

export default HelpArticleEditor;
