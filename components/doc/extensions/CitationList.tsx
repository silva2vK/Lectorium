import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { PdfMetadata } from '../../../services/storageService'

export const CitationList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command({ id: item.fileId, label: `(${item.author.toUpperCase()}, ${item.year})` })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }
      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }
      if (event.key === 'Enter') {
        enterHandler()
        return true
      }
      return false
    },
  }))

  return (
    <div className="bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto z-50">
      {props.items.length ? (
        props.items.map((item: PdfMetadata, index: number) => (
          <button
            className={`w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 ${index === selectedIndex ? 'bg-brand/20 text-white' : 'text-gray-300 hover:bg-white/5'}`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <span className="font-bold text-white">{item.author.toUpperCase()}, {item.year}</span>
            <span className="text-xs text-gray-400 truncate">{item.title}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-gray-500">Nenhuma referência encontrada</div>
      )}
    </div>
  )
})
