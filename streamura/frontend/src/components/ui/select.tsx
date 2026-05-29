import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

function useSelect() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select provider');
  }
  return context;
}

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

function Select({
  children,
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  disabled = false,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const value = controlledValue ?? uncontrolledValue;
  const handleValueChange = disabled ? () => {} : (onValueChange ?? setUncontrolledValue);
  const handleSetOpen = disabled ? () => {} : setOpen;

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen: handleSetOpen }}>
      <div className={cn("relative", disabled && "opacity-50 pointer-events-none")}>{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen } = useSelect();

  return (
    <button
      type="button"
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelect();
  return <span className={!value ? 'text-slate-400' : ''}>{value || placeholder}</span>;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

function SelectContent({ className, children, ...props }: SelectContentProps) {
  const { open, setOpen } = useSelect();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-md animate-in fade-in-80',
        className
      )}
      {...props}
    >
      <div className="max-h-[300px] overflow-y-auto p-1">{children}</div>
    </div>
  );
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function SelectItem({ className, value, children, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange, setOpen } = useSelect();
  const isSelected = selectedValue === value;

  return (
    <div
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-200 outline-none hover:bg-slate-700 focus:bg-slate-700',
        isSelected && 'bg-slate-700',
        className
      )}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
      {children}
    </div>
  );
}

interface SelectGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

function SelectGroup({ className, children, ...props }: SelectGroupProps) {
  return (
    <div className={cn('p-1', className)} {...props}>
      {children}
    </div>
  );
}

interface SelectLabelProps extends React.HTMLAttributes<HTMLDivElement> {}

function SelectLabel({ className, children, ...props }: SelectLabelProps) {
  return (
    <div
      className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold text-slate-400', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface SelectSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return <div className={cn('-mx-1 my-1 h-px bg-slate-700', className)} {...props} />;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
