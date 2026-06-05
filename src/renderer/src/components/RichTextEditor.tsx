import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  QuoteIcon,
  CodeIcon,
  StrikethroughIcon,
  LinkIcon,
  Link2OffIcon,
  Undo2Icon,
  Redo2Icon,
  MinusIcon
} from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: Props): JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // We want history; nothing to disable.
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escribe una descripción…'
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-pastel-purple underline hover:text-ink-100'
        }
      })
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Treat the empty editor as empty string so we can null out the column.
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class:
          'prose-bloom min-h-[120px] max-h-[320px] overflow-y-auto px-3 py-2 focus:outline-none scrollbar-thin'
      }
    }
  })

  // Sync external value changes (e.g., when card prop changes).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const normalized = value || '<p></p>'
    if (current !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return <div className="input min-h-[120px]" />

  return (
    <div className="rounded-lg border border-pastel-purple/40 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-pastel-purple focus-within:border-transparent">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }): JSX.Element {
  const setLink = (): void => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url, target: '_blank' })
      .run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-pastel-purple/30 bg-gradient-to-r from-pastel-pink/10 via-pastel-purple/10 to-pastel-blue/10">
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Título 1"
      >
        <Heading1Icon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Título 2"
      >
        <Heading2Icon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Título 3"
      >
        <Heading3Icon size={14} />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Negrita (⌘B)"
      >
        <BoldIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Cursiva (⌘I)"
      >
        <ItalicIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Tachado"
      >
        <StrikethroughIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Código en línea"
      >
        <CodeIcon size={14} />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Lista"
      >
        <ListIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        <ListOrderedIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Cita"
      >
        <QuoteIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Separador"
      >
        <MinusIcon size={14} />
      </Btn>
      <Sep />
      <Btn
        onClick={setLink}
        active={editor.isActive('link')}
        title="Insertar/editar enlace"
      >
        <LinkIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        title="Quitar enlace"
      >
        <Link2OffIcon size={14} />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Deshacer (⌘Z)"
      >
        <Undo2Icon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rehacer (⌘⇧Z)"
      >
        <Redo2Icon size={14} />
      </Btn>
    </div>
  )
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-pastel-purple/30 text-ink-100'
          : 'text-ink-300 hover:bg-pastel-purple/15 hover:text-ink-100'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Sep(): JSX.Element {
  return <div className="w-px self-stretch bg-pastel-purple/30 mx-0.5" />
}
