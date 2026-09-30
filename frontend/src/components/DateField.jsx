import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  displayToIso,
  formatDateInput,
  isoToDisplay,
  isoToLocalDate,
  localDateToIso,
} from "@/lib/consignorForm";

export function retainDatePopover(event) {
  const node = event.target;
  if (node instanceof Element && node.closest("[data-ee-date-popover]")) {
    event.preventDefault();
  }
}

export default function DateField({
  value,
  onChange,
  testId = "consignor-date",
}) {
  const [text, setText] = useState(() => textFor(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(textFor(value));
  }, [value]);

  const selected = isoToLocalDate(value);

  const commitText = (next) => {
    setText(next);
    if (!next.trim()) {
      onChange("");
      return;
    }
    const iso = displayToIso(next);
    if (iso) onChange(iso);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative mt-1">
          <Input
            data-testid={testId}
            value={text}
            inputMode="numeric"
            placeholder="MM-DD-YYYY"
            onChange={(e) => {
              const raw = e.target.value;
              const next = /[a-z]/i.test(raw) ? raw : formatDateInput(raw);
              commitText(next);
            }}
            onBlur={() => {
              if (!text.trim()) {
                onChange("");
                return;
              }
              const iso = displayToIso(text);
              if (iso) {
                onChange(iso);
                setText(isoToDisplay(iso));
                return;
              }
              if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
                setText(isoToDisplay(value));
              }
            }}
            className="pr-9"
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`${testId}-picker`}
              aria-label="Open calendar"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-neutral-500 hover:bg-[var(--ee-magenta-soft)] hover:text-[var(--ee-magenta)]"
            >
              <CalendarDays size={15} />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        data-ee-date-popover=""
        data-testid={`${testId}-calendar`}
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="z-[80] w-[17.25rem] rounded-[12px] border border-[var(--ee-sidebar-border)] bg-white p-3 shadow-[0_16px_40px_rgba(26,26,26,0.12)]"
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected || new Date()}
          onSelect={(date) => {
            if (!date) return;
            const iso = localDateToIso(date);
            onChange(iso);
            setText(isoToDisplay(iso));
            setOpen(false);
          }}
          className="p-0"
          classNames={{
            months: "flex flex-col",
            month: "space-y-2 w-full",
            caption: "flex justify-center relative items-center h-8",
            caption_label: "text-[13px] font-semibold tracking-tight text-[var(--ee-ink)]",
            nav: "flex items-center",
            table: "w-full border-collapse",
            head_row: "grid grid-cols-7",
            head_cell:
              "h-8 flex items-center justify-center text-[11px] font-medium text-neutral-400",
            row: "grid grid-cols-7",
            cell: "relative p-0 h-8 flex items-center justify-center text-sm focus-within:relative focus-within:z-20",
            day: "inline-flex items-center justify-center h-8 w-8 p-0 font-normal rounded-full text-[var(--ee-ink)] hover:bg-[var(--ee-magenta-soft)] hover:text-[var(--ee-magenta)] aria-selected:opacity-100",
            day_selected:
              "bg-[var(--ee-magenta)] text-white hover:bg-[#6f1655] hover:text-white focus:bg-[var(--ee-magenta)] focus:text-white",
            day_today: "ring-1 ring-[var(--ee-magenta)]",
            day_outside: "day-outside text-neutral-300 aria-selected:text-white",
            nav_button:
              "h-7 w-7 bg-transparent p-0 rounded-full border-0 opacity-70 hover:opacity-100 hover:bg-black/[0.04]",
            nav_button_previous: "absolute left-0",
            nav_button_next: "absolute right-0",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function textFor(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return isoToDisplay(value);
  return value || "";
}
