import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { CitationList } from './CitationList'
import { searchPdfMetadata } from '../../../services/storageService'

export const CitationExtension = Mention.configure({
  HTMLAttributes: {
    class: 'citation-mention bg-brand/10 text-brand px-1 rounded font-medium decoration-clone',
  },
  suggestion: {
    char: '@',
    items: async ({ query }) => {
      return await searchPdfMetadata(query)
    },
    render: () => {
      let component: any
      let popup: any

      return {
        onStart: (props) => {
          component = new ReactRenderer(CitationList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as any,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },
        onUpdate(props) {
          component.updateProps(props)

          if (!props.clientRect) {
            return
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          })
        },
        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0].hide()
            return true
          }
          return component.ref?.onKeyDown(props)
        },
        onExit() {
          popup[0].destroy()
          component.destroy()
        },
      }
    },
  },
})
