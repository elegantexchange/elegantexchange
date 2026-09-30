import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

export default function AddressField({
  value,
  onChange,
  testId = "consignor-address",
  placeholder = "Start typing an address",
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(0);
  // Treat the value already on the form as chosen, so opening Edit
  // doesn't pop suggestions until the address is actually edited.
  const skip = useRef(value || "");
  const boxRef = useRef(null);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 3 || q === skip.current) {
      if (q === skip.current) setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get("/consignors/address-suggest", { params: { q } })
        .then((r) => {
          if (cancelled) return;
          const rows = Array.isArray(r.data?.suggestions) ? r.data.suggestions : [];
          setSuggestions(rows);
          setActive(0);
          setOpen(rows.length > 0);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (text) => {
    skip.current = text;
    onChange(text);
    setSuggestions([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(suggestions[active] || suggestions[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        data-testid={testId}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          skip.current = "";
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          data-testid={`${testId}-suggestions`}
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-[11px] border border-[var(--ee-sidebar-border)] bg-white shadow-[0_12px_40px_rgba(26,26,26,0.08)]"
        >
          {suggestions.map((text, i) => (
            <li key={text} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(text)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] ${
                  i === active
                    ? "bg-[var(--ee-magenta-soft)] text-[var(--ee-ink)]"
                    : "text-neutral-700 hover:bg-black/[0.03]"
                }`}
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-[var(--ee-magenta)]" />
                <span>{text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
