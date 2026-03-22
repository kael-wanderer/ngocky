import React, { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
    Bold, Italic, List, Table as TableIcon, Palette, ChevronDown,
} from 'lucide-react';

const TEXT_COLORS = [
    { label: 'Default', value: 'inherit' },
    { label: 'Red', value: '#ef4444' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Yellow', value: '#f59e0b' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Teal', value: '#14b8a6' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'Gray', value: '#6b7280' },
];

const TEXT_SIZES = [
    { label: 'Normal', value: 'paragraph' },
    { label: 'Heading 1', value: 'h1' },
    { label: 'Heading 2', value: 'h2' },
    { label: 'Heading 3', value: 'h3' },
];

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Add a description...', minHeight = '120px' }: RichTextEditorProps) {
    const [colorOpen, setColorOpen] = useState(false);
    const [sizeOpen, setSizeOpen] = useState(false);
    const colorRef = useRef<HTMLDivElement>(null);
    const sizeRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            Color,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.isEmpty ? '' : editor.getHTML();
            onChange(html);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none',
                style: `min-height: ${minHeight}; padding: 0.5rem 0;`,
            },
        },
    });

    if (!editor) return null;

    const activeSizeLabel = editor.isActive('heading', { level: 1 }) ? 'Heading 1'
        : editor.isActive('heading', { level: 2 }) ? 'Heading 2'
        : editor.isActive('heading', { level: 3 }) ? 'Heading 3'
        : 'Normal';

    const btnBase = 'p-1.5 rounded transition-colors';
    const btnActive = 'bg-gray-200 text-gray-800';
    const btnInactive = 'hover:bg-gray-100';

    return (
        <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            {/* Toolbar */}
            <div
                className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
                style={{ borderColor: 'var(--color-border)' }}
            >
                {/* Text size dropdown */}
                <div className="relative" ref={sizeRef}>
                    <button
                        type="button"
                        onClick={() => { setSizeOpen(o => !o); setColorOpen(false); }}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded transition-colors hover:bg-gray-100`}
                        style={{ color: 'var(--color-text)', minWidth: '84px' }}
                    >
                        {activeSizeLabel} <ChevronDown className="w-3 h-3 ml-auto" />
                    </button>
                    {sizeOpen && (
                        <div
                            className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[120px]"
                            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                            onMouseLeave={() => setSizeOpen(false)}
                        >
                            {TEXT_SIZES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => {
                                        if (s.value === 'paragraph') editor.chain().focus().setParagraph().run();
                                        else editor.chain().focus().toggleHeading({ level: parseInt(s.value[1]) as 1|2|3 }).run();
                                        setSizeOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                                    style={{ color: 'var(--color-text)', fontWeight: s.value !== 'paragraph' ? 600 : 400 }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />

                {/* Bold */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`${btnBase} ${editor.isActive('bold') ? btnActive : btnInactive}`}
                    style={{ color: 'var(--color-text)' }}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>

                {/* Italic */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`${btnBase} ${editor.isActive('italic') ? btnActive : btnInactive}`}
                    style={{ color: 'var(--color-text)' }}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>

                {/* Bullet list */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : btnInactive}`}
                    style={{ color: 'var(--color-text)' }}
                    title="Bullet list"
                >
                    <List className="w-4 h-4" />
                </button>

                <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />

                {/* Text color */}
                <div className="relative" ref={colorRef}>
                    <button
                        type="button"
                        onClick={() => { setColorOpen(o => !o); setSizeOpen(false); }}
                        className={`${btnBase} ${btnInactive} flex items-center gap-1`}
                        style={{ color: 'var(--color-text)' }}
                        title="Text color"
                    >
                        <Palette className="w-4 h-4" />
                    </button>
                    {colorOpen && (
                        <div
                            className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg p-2"
                            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', width: '148px' }}
                            onMouseLeave={() => setColorOpen(false)}
                        >
                            <div className="grid grid-cols-5 gap-1.5">
                                {TEXT_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        title={c.label}
                                        onClick={() => {
                                            if (c.value === 'inherit') editor.chain().focus().unsetColor().run();
                                            else editor.chain().focus().setColor(c.value).run();
                                            setColorOpen(false);
                                        }}
                                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                                        style={{
                                            background: c.value === 'inherit' ? 'var(--color-text)' : c.value,
                                            borderColor: 'transparent',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Insert table */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    className={`${btnBase} ${btnInactive}`}
                    style={{ color: 'var(--color-text)' }}
                    title="Insert table"
                >
                    <TableIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Editor area */}
            <div
                className="px-3 cursor-text"
                onClick={() => editor.commands.focus()}
            >
                {editor.isEmpty && !editor.isFocused && (
                    <p className="absolute pointer-events-none text-sm" style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                        {placeholder}
                    </p>
                )}
                <EditorContent editor={editor} />
            </div>

            {/* Table controls — shown when cursor is inside a table */}
            {editor.isActive('table') && (
                <div
                    className="flex items-center gap-2 px-3 py-1.5 border-t text-xs"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                    <span className="font-medium">Table:</span>
                    <button type="button" className="hover:underline" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Col</button>
                    <button type="button" className="hover:underline" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button>
                    <button type="button" className="hover:underline text-red-500" onClick={() => editor.chain().focus().deleteColumn().run()}>- Col</button>
                    <button type="button" className="hover:underline text-red-500" onClick={() => editor.chain().focus().deleteRow().run()}>- Row</button>
                    <button type="button" className="hover:underline text-red-500" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
                </div>
            )}
        </div>
    );
}
