"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // max-h + overflow-y-auto so a dialog taller than the viewport (a
          // multi-step form, a long attendee list, ...) scrolls internally
          // instead of getting clipped above/below the screen with no way
          // to reach it - position:fixed content can't be reached by
          // scrolling the page behind it.
          "fixed top-1/2 left-1/2 z-50 grid max-h-[85vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none scrollbar-thin sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const footerClassName = cn(
    // sticky to the bottom of DialogContent's own scrollport (see its
    // overflow-y-auto above) so Save/Cancel stay reachable while a tall
    // form scrolls, instead of sitting below the fold. Solid background
    // (not a translucent/blurred one) - scrolled-away fields peeking
    // through a see-through footer reads as a rendering bug, not a
    // deliberate frosted-glass effect, on a form this dense.
    "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-popover p-4 sm:flex-row sm:justify-end",
    className
  )

  const closeButton = showCloseButton && (
    <DialogPrimitive.Close render={<Button variant="outline" />}>
      Close
    </DialogPrimitive.Close>
  )

  return (
    <>
      {/* Invisible clone, same content so it takes identical height, laid
       * out normally (not sticky) right where the footer's content ends.
       * Reserves that much scroll room so the real sticky footer below can
       * only ever come to rest over this blank space, never over a real
       * field - without it, a form taller than the dialog's viewport gets
       * its last row or two visually cut off by the footer while scrolling,
       * since a sticky element doesn't reserve its own space by default. */}
      <div aria-hidden="true" className={cn(footerClassName, "invisible")}>
        {children}
        {closeButton}
      </div>
      <div data-slot="dialog-footer" className={cn(footerClassName, "sticky bottom-0")} {...props}>
        {children}
        {closeButton}
      </div>
    </>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
