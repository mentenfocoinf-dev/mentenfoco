import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar opciones...",
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== option));
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[44px] w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-2 text-sm focus:border-primary focus:outline-none shadow-sm flex items-center justify-between transition-all ${
          disabled ? "cursor-not-allowed opacity-60 bg-slate-100" : "cursor-pointer"
        }`}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            selected.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary border border-primary/20"
              >
                {item}
                {!disabled && (
                  <X
                    size={12}
                    className="cursor-pointer hover:text-primary/70 transition-colors"
                    onClick={(e) => removeOption(e, item)}
                  />
                )}
              </span>
            ))
          )}
        </div>
        <ChevronsUpDown size={16} className="text-slate-400 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1 animate-in fade-in slide-in-from-top-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={`relative cursor-pointer select-none py-2 pl-8 pr-4 text-sm outline-none rounded-md transition-colors hover:bg-slate-100 ${
                  isSelected ? "bg-slate-50 font-medium text-primary" : "text-slate-700"
                }`}
              >
                {isSelected && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-primary">
                    <Check size={14} />
                  </span>
                )}
                {option}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
