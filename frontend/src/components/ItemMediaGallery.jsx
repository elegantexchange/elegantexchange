import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { compressImagesToDataUrls } from "@/lib/image";
import { toast } from "sonner";

const MAX_MEDIA = 10;

/**
 * Photo gallery for an inventory item detail panel.
 * @param {{ media?: string[], onChange: (next: string[]) => Promise<void>|void, disabled?: boolean }} props
 */
export default function ItemMediaGallery({ media = [], onChange, disabled }) {
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef(null);
  const urls = Array.isArray(media) ? media.filter(Boolean) : [];

  useEffect(() => {
    setActive((i) => (urls.length ? Math.min(i, urls.length - 1) : 0));
  }, [urls.length]);

  const persist = async (next) => {
    setBusy(true);
    try {
      await onChange(next.slice(0, MAX_MEDIA));
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    const room = MAX_MEDIA - urls.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_MEDIA} photos per item`);
      return;
    }
    setBusy(true);
    try {
      const sliced = Array.from(files).slice(0, room);
      const added = await compressImagesToDataUrls(sliced);
      if (!added.length) {
        toast.error("No valid images selected");
        return;
      }
      const next = [...urls, ...added];
      await onChange(next.slice(0, MAX_MEDIA));
      setActive(urls.length);
      toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`);
    } catch (err) {
      toast.error(err.message || "Could not add photos");
    } finally {
      setBusy(false);
    }
  };

  const removeAt = async (index) => {
    const next = urls.filter((_, i) => i !== index);
    try {
      await persist(next);
      toast.success("Photo removed");
    } catch {
      /* parent surfaces the error */
    }
  };

  return (
    <div className="space-y-3" data-testid="item-media-gallery">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] tracking-[0.14em] uppercase text-neutral-500 font-semibold">
          Photos {urls.length ? `· ${urls.length}` : ""}
        </div>
        <button
          type="button"
          data-testid="item-media-add"
          disabled={disabled || busy || urls.length >= MAX_MEDIA}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ee-magenta)] hover:opacity-80 disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          Add
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      {urls.length === 0 ? (
        <button
          type="button"
          data-testid="item-media-empty"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="w-full aspect-[16/10] max-h-56 rounded-[11px] border border-dashed border-[var(--ee-sidebar-border)] bg-black/[0.015] flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-[var(--ee-magenta)]/40 hover:text-[var(--ee-magenta)] transition-colors disabled:opacity-50"
        >
          <ImagePlus size={22} strokeWidth={1.5} />
          <span className="text-xs font-medium tracking-wide">Add item photos</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            data-testid="item-media-hero"
            onClick={() => setLightbox(true)}
            className="relative w-full aspect-[16/10] max-h-64 rounded-[11px] overflow-hidden bg-neutral-100 border border-[var(--ee-sidebar-border)] group"
          >
            <img
              src={urls[active]}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <span className="absolute bottom-2 right-2 text-[10px] uppercase tracking-[0.12em] font-semibold bg-black/50 text-white px-2 py-1 rounded">
              View
            </span>
          </button>

          <div className="flex gap-2 overflow-x-auto ee-scroll-hide pb-0.5">
            {urls.map((src, index) => (
              <div key={`${index}-${src.slice(0, 24)}`} className="relative shrink-0">
                <button
                  type="button"
                  data-testid={`item-media-thumb-${index}`}
                  onClick={() => setActive(index)}
                  className={`w-14 h-14 rounded-[8px] overflow-hidden border-2 transition-colors ${
                    index === active
                      ? "border-[var(--ee-magenta)]"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
                <button
                  type="button"
                  data-testid={`item-media-remove-${index}`}
                  disabled={disabled || busy}
                  aria-label="Remove photo"
                  onClick={() => removeAt(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-[var(--ee-sidebar-border)] shadow-sm flex items-center justify-center text-neutral-500 hover:text-red-700 hover:border-red-200 disabled:opacity-40"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {urls.length < MAX_MEDIA ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => fileRef.current?.click()}
                className="w-14 h-14 shrink-0 rounded-[8px] border border-dashed border-[var(--ee-sidebar-border)] flex items-center justify-center text-neutral-400 hover:text-[var(--ee-magenta)] hover:border-[var(--ee-magenta)]/40 disabled:opacity-40"
                aria-label="Add photo"
              >
                <ImagePlus size={16} />
              </button>
            ) : null}
          </div>
        </>
      )}

      {lightbox && urls[active] ? (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          data-testid="item-media-lightbox"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(false)}
          >
            <X size={22} />
          </button>
          <img
            src={urls[active]}
            alt=""
            className="max-w-full max-h-full object-contain rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
          {urls.length > 1 ? (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {urls.map((src, index) => (
                <button
                  key={`lb-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`w-12 h-12 rounded-md overflow-hidden border-2 ${
                    index === active ? "border-white" : "border-transparent opacity-70"
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
