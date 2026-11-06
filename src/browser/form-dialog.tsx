import {useId, useRef, type ReactNode} from 'react'
import {Button} from './button'

export function FormDialog({label,title=label,children}: {
  label:string
  title?:string
  children:(close:()=>void)=>ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const close = () => dialog.current?.close()
  return <>
    <Button type="button" variant="outline" onClick={()=>dialog.current?.showModal()}>{label}</Button>
    <dialog ref={dialog} aria-labelledby={heading} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/45 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={heading}>{title}</h2>
        <Button type="button" variant="ghost" onClick={close}>Close</Button>
      </div>
      {children(close)}
    </dialog>
  </>
}
