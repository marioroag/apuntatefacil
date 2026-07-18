import { useEffect, useRef } from 'react'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import { ArrowLeftToLine, ArrowRightToLine, BriefcaseBusiness, Link2, Redo2, Undo2 } from 'lucide-react'
import {
  SHARE_LINK_TOKEN,
  SHARE_POSITION_TOKEN,
  normalizeReplyTemplate,
  tokenizeReplyTemplate,
  type ShareToken,
} from '../../lib/shareReply'
import { ReplyTokenNode, $createReplyTokenNode, $isReplyTokenNode } from './ReplyTokenNode'

type ReplyTemplateEditorProps = {
  template?: string | null
  disabled?: boolean
  autoFocus?: boolean
  onChange: (template: string) => void
}

function $templateFromEditor(): string {
  const lines = $getRoot().getChildren().map((block) => {
    if (!$isElementNode(block)) return block.getTextContent()
    return block
      .getChildren()
      .map((node) => ($isReplyTokenNode(node) ? node.__token : node.getTextContent()))
      .join('')
  })
  return normalizeReplyTemplate(lines.join('\n'))
}

function $replaceEditorTemplate(template: string) {
  const root = $getRoot()
  root.clear()
  for (const line of normalizeReplyTemplate(template).split('\n')) {
    const paragraph = $createParagraphNode()
    for (const segment of tokenizeReplyTemplate(line, false)) {
      paragraph.append(segment.type === 'token' ? $createReplyTokenNode(segment.value) : $createTextNode(segment.value))
    }
    root.append(paragraph)
  }
}

function templateWithTokenMoved(template: string, token: ShareToken, visiblePosition: number): string {
  const source = normalizeReplyTemplate(template)
  const tokenAt = source.indexOf(token)
  if (tokenAt === -1) return source
  const withoutToken = source.slice(0, tokenAt) + source.slice(tokenAt + token.length)
  let textSeen = 0
  let insertionAt = withoutToken.length
  for (let index = 0; index <= withoutToken.length; index += 1) {
    const remaining = withoutToken.slice(index)
    const tokenMatch = remaining.match(/^(\{\{puesto\}\}|\{\{enlace\}\})/)
    if (textSeen >= visiblePosition) {
      insertionAt = index
      break
    }
    if (tokenMatch) {
      index += tokenMatch[0].length - 1
      continue
    }
    textSeen += 1
  }
  return normalizeReplyTemplate(withoutToken.slice(0, insertionAt) + token + withoutToken.slice(insertionAt))
}

function textBeforeDrop(container: HTMLElement, clientX: number, clientY: number): number | null {
  const pointDocument = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  const range = pointDocument.caretRangeFromPoint?.(clientX, clientY)
    ?? (() => {
      const position = pointDocument.caretPositionFromPoint?.(clientX, clientY)
      if (!position) return null
      const next = document.createRange()
      next.setStart(position.offsetNode, position.offset)
      next.collapse(true)
      return next
    })()
  if (!range || !container.contains(range.startContainer)) return null

  const preceding = document.createRange()
  preceding.selectNodeContents(container)
  preceding.setEnd(range.startContainer, range.startOffset)
  const fragment = preceding.cloneContents()
  fragment.querySelectorAll('[data-reply-token]').forEach((element) => element.remove())
  return (fragment.textContent ?? '').length
}

function TemplateSyncPlugin({ template }: { template?: string | null }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const nextTemplate = normalizeReplyTemplate(template)
    const currentTemplate = editor.getEditorState().read($templateFromEditor)
    if (currentTemplate !== nextTemplate) editor.update(() => $replaceEditorTemplate(nextTemplate))
  }, [editor, template])

  return null
}

function ProtectedLinkPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          const selection = $getSelection()
          return $isNodeSelection(selection) && selection.getNodes().some(
            (node) => $isReplyTokenNode(node) && node.__token === SHARE_LINK_TOKEN,
          )
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  useEffect(
    () =>
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          const selection = $getSelection()
          return $isNodeSelection(selection) && selection.getNodes().some(
            (node) => $isReplyTokenNode(node) && node.__token === SHARE_LINK_TOKEN,
          )
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}

function EditorToolbar({ onTemplateChange }: { onTemplateChange: (template: string) => void }) {
  const [editor] = useLexicalComposerContext()

  const insertToken = (token: ShareToken) => {
    editor.update(() => {
      const template = $templateFromEditor()
      if (token === SHARE_LINK_TOKEN || template.includes(token)) return
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertNodes([$createReplyTokenNode(token)])
      } else {
        const lastLine = $getRoot().getLastChild()
        if ($isElementNode(lastLine)) lastLine.append($createReplyTokenNode(token))
      }
      onTemplateChange($templateFromEditor())
    })
  }

  const moveLink = (edge: 'start' | 'end') => {
    editor.update(() => {
      const template = $templateFromEditor()
      const next = templateWithTokenMoved(
        template,
        SHARE_LINK_TOKEN,
        edge === 'start' ? 0 : Number.MAX_SAFE_INTEGER,
      )
      $replaceEditorTemplate(next)
      onTemplateChange(next)
    })
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12px] font-medium text-slate-500">Variables</span>
      <button
        type="button"
        onClick={() => insertToken(SHARE_POSITION_TOKEN)}
        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <BriefcaseBusiness className="size-3.5 text-slate-500" aria-hidden /> Puesto
      </button>
      <span className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 text-[12px] font-medium text-slate-600">
        <Link2 className="size-3.5 text-slate-500" aria-hidden /> Enlace obligatorio
      </span>
      <span className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
        <button
          type="button"
          onClick={() => moveLink('start')}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Mover enlace al inicio"
          title="Mover enlace al inicio"
        >
          <ArrowLeftToLine className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => moveLink('end')}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Mover enlace al final"
          title="Mover enlace al final"
        >
          <ArrowRightToLine className="size-3.5" aria-hidden />
        </button>
      </span>
      <span className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Deshacer"
          title="Deshacer"
        >
          <Undo2 className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Rehacer"
          title="Rehacer"
        >
          <Redo2 className="size-3.5" aria-hidden />
        </button>
      </span>
    </div>
  )
}

function FocusPlugin({ autoFocus }: { autoFocus: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    if (autoFocus) editor.focus()
  }, [autoFocus, editor])
  return null
}

function createInitialConfig(template: string | null | undefined) {
  return {
    namespace: 'ApuntateFacilReplyTemplate',
    nodes: [ReplyTokenNode],
    editorState: () => $replaceEditorTemplate(normalizeReplyTemplate(template)),
    onError: (error: Error) => {
      throw error
    },
    theme: {
      paragraph: 'mb-0 min-h-6',
    },
  }
}

export function ReplyTemplateEditor({ template, disabled = false, autoFocus = false, onChange }: ReplyTemplateEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const templateRef = useRef(normalizeReplyTemplate(template))

  const publishTemplate = (next: string) => {
    const normalized = normalizeReplyTemplate(next)
    templateRef.current = normalized
    onChange(normalized)
  }

  return (
    <LexicalComposer initialConfig={createInitialConfig(template)}>
      <div
        ref={containerRef}
        onDragStart={(event) => {
          const token = (event.target as HTMLElement).closest<HTMLElement>('[data-reply-token]')?.dataset.replyToken
          if (token === SHARE_LINK_TOKEN || token === SHARE_POSITION_TOKEN) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('application/x-apuntate-reply-token', token)
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/x-apuntate-reply-token')) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }
        }}
        onDrop={(event) => {
          const token = event.dataTransfer.getData('application/x-apuntate-reply-token')
          if (token !== SHARE_LINK_TOKEN && token !== SHARE_POSITION_TOKEN) return
          const position = containerRef.current ? textBeforeDrop(containerRef.current, event.clientX, event.clientY) : null
          if (position === null) return
          event.preventDefault()
          publishTemplate(templateWithTokenMoved(templateRef.current, token, position))
        }}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Plantilla de respuesta"
              aria-placeholder="Escribe el mensaje que enviarás a los candidatos"
              placeholder={
                <span className="pointer-events-none absolute left-3.5 top-3 text-sm text-slate-500">
                  Escribe el mensaje que enviarás a los candidatos
                </span>
              }
              contentEditable={!disabled}
              className="relative min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 pointer-coarse:text-base"
            />
          }
          ErrorBoundary={({ children }) => <>{children}</>}
        />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState) => {
            editorState.read(() => publishTemplate($templateFromEditor()))
          }}
        />
        <TemplateSyncPlugin template={template} />
        <ProtectedLinkPlugin />
        <FocusPlugin autoFocus={autoFocus} />
        {!disabled && <EditorToolbar onTemplateChange={publishTemplate} />}
      </div>
    </LexicalComposer>
  )
}

