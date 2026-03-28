import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, useEffect } from "react";

import { Input } from "@/components/ui/forms/input";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const DEBOUNCE_MS = 300;

/**
 * Debounced search input with clear button. The internal (instant) value
 * updates on every keystroke for responsive feel; the external `onChange`
 * fires only after the debounce window elapses.
 *
 * The parent passes the *debounced* value back as `value` so URL-driven
 * state round-trips correctly (e.g. after a browser back-navigation the
 * input reflects whatever the URL had).
 */
export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const t = useTranslations("users.list.search");
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from external state (URL change, reset) → local.
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [onChange]);

  return (
    <div className="relative">
      <MagnifyingGlassIcon
        size={16}
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
      />
      <Input
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder ?? t("placeholder")}
        className="pr-8 pl-8"
        aria-label={t("ariaLabel")}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
          aria-label={t("clearAria")}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}
