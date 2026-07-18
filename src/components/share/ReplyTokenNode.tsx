import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { ReactNode } from 'react'
import { Link2, BriefcaseBusiness } from 'lucide-react'
import { SHARE_LINK_TOKEN, SHARE_POSITION_TOKEN, type ShareToken } from '../../lib/shareReply'

export type SerializedReplyTokenNode = Spread<{ token: ShareToken }, SerializedLexicalNode>

export class ReplyTokenNode extends DecoratorNode<ReactNode> {
  __token: ShareToken

  static getType(): string {
    return 'reply-token'
  }

  static clone(node: ReplyTokenNode): ReplyTokenNode {
    return new ReplyTokenNode(node.__token, node.__key)
  }

  static importJSON(serializedNode: SerializedReplyTokenNode): ReplyTokenNode {
    return $createReplyTokenNode(serializedNode.token)
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  constructor(token: ShareToken, key?: NodeKey) {
    super(key)
    this.__token = token
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('span')
    element.className = 'reply-token-node'
    return element
  }

  updateDOM(): false {
    return false
  }

  exportJSON(): SerializedReplyTokenNode {
    return { ...super.exportJSON(), token: this.__token, type: 'reply-token', version: 1 }
  }

  exportText(): string {
    return this.__token
  }

  getTextContent(): string {
    return this.__token
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  isKeyboardSelectable(): boolean {
    return true
  }

  decorate(): ReactNode {
    return <ReplyToken token={this.__token} />
  }
}

function ReplyToken({ token }: { token: ShareToken }) {
  const isLink = token === SHARE_LINK_TOKEN
  const Icon = isLink ? Link2 : BriefcaseBusiness
  const label = isLink ? 'Enlace al formulario' : 'Puesto'

  return (
    <span
      data-reply-token={token}
      draggable
      title={isLink ? 'Enlace obligatorio, arrástralo para moverlo' : 'Puesto dinámico, arrástralo para moverlo'}
      className="mx-0.5 inline-flex cursor-grab select-none items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 align-baseline text-[12px] font-medium text-slate-700 active:cursor-grabbing"
    >
      <Icon className="size-3 text-slate-500" aria-hidden />
      {label}
    </span>
  )
}

export function $createReplyTokenNode(token: ShareToken): ReplyTokenNode {
  return $applyNodeReplacement(new ReplyTokenNode(token))
}

export function $isReplyTokenNode(node: LexicalNode | null | undefined): node is ReplyTokenNode {
  return node instanceof ReplyTokenNode
}

export function isReplyToken(value: string): value is ShareToken {
  return value === SHARE_POSITION_TOKEN || value === SHARE_LINK_TOKEN
}
