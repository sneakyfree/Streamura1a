import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content container */}
      {children}
    </div>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
        'w-full max-w-lg',
        'bg-slate-800 border border-slate-700 rounded-lg shadow-lg',
        'p-6',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogHeader({
  className,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function DialogTitle({
  className,
  children,
  ...props
}: DialogTitleProps) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-white',
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function DialogDescription({
  className,
  children,
  ...props
}: DialogDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-slate-400', className)}
      {...props}
    >
      {children}
    </p>
  );
}

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogFooter({
  className,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DialogClose({
  className,
  children,
  ...props
}: DialogCloseProps) {
  return (
    <button
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100',
        'text-slate-400 hover:text-white',
        'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
        'disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      {children || <X className="h-4 w-4" />}
      <span className="sr-only">Close</span>
    </button>
  );
}

// DialogTrigger - a simple button that can be used to open dialogs
// (Note: this is a placeholder since our Dialog is controlled)
interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DialogTrigger({
  className,
  children,
  asChild,
  ...props
}: DialogTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<unknown>, props);
  }
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}
