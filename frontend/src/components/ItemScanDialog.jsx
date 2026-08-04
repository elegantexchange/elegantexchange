import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ResponsiveModal";
import { CATEGORIES, CONDITIONS } from "@/lib/brand";
import { toast } from "sonner";

const STEPS = ["item", "tag", "review"];

function confidenceClass(level) {
  if (level === "low") return "border-amber-400 bg-amber-50";
  if (level === "medium") return "border-amber-200";
  return "";
}

function CaptureStep({
  title,
  hint,
  previewUrl,
  videoRef,
  canvasRef,
  cameraReady,
  cameraError,
  onCapture,
  onFile,
  onRetake,
  onNext,
  onBack,
  nextLabel,
  showBack,
  nextDisabled,
}) {
  const fileRef = useRef(null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-neutral-500 font-light mt-1">{hint}</p>
      </div>

      <div className="relative aspect-[4/3] bg-neutral-900 rounded-md overflow-hidden border border-[var(--ee-border)]">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraReady ? "" : "hidden"}`}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-sm px-6 text-center">
                {cameraError || "Starting camera… You can also upload a photo."}
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {!previewUrl ? (
          <>
            <Button
              type="button"
              data-testid="scan-capture-btn"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white flex-1"
              onClick={onCapture}
              disabled={!cameraReady}
            >
              <Camera size={14} className="mr-1" /> Capture photo
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="scan-upload-btn"
              className="ee-btn-label flex-1"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={14} className="mr-1" /> Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              data-testid="scan-file-input"
              onChange={onFile}
            />
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              data-testid="scan-retake-btn"
              className="ee-btn-label flex-1"
              onClick={onRetake}
              disabled={nextDisabled}
            >
              <RefreshCw size={14} className="mr-1" /> Retake
            </Button>
            <Button
              type="button"
              data-testid="scan-next-btn"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white flex-1"
              onClick={onNext}
              disabled={nextDisabled}
            >
              {nextLabel}
            </Button>
          </>
        )}
      </div>

      {showBack && (
        <Button type="button" variant="ghost" className="ee-btn-label w-full" onClick={onBack}>
          Back
        </Button>
      )}
    </div>
  );
}

export default function ItemScanDialog({ open, onClose, onConfirm, confirmLabel = "Use these details" }) {
  const [step, setStep] = useState(0);
  const [itemBlob, setItemBlob] = useState(null);
  const [tagBlob, setTagBlob] = useState(null);
  const [itemPreview, setItemPreview] = useState("");
  const [tagPreview, setTagPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available in this browser. Upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraError("Could not open camera. Upload a photo instead.");
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setStep(0);
    setItemBlob(null);
    setTagBlob(null);
    setItemPreview("");
    setTagPreview("");
    setDraft(null);
    setAnalyzing(false);
    startCamera();
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    if (!open) return;
    if (step === 0 && !itemPreview) startCamera();
    if (step === 1 && !tagPreview) startCamera();
    if (step === 2) stopCamera();
  }, [step, open, itemPreview, tagPreview, startCamera, stopCamera]);

  const setPreviewForStep = (blob, which) => {
    const url = URL.createObjectURL(blob);
    if (which === "item") {
      if (itemPreview) URL.revokeObjectURL(itemPreview);
      setItemBlob(blob);
      setItemPreview(url);
    } else {
      if (tagPreview) URL.revokeObjectURL(tagPreview);
      setTagBlob(blob);
      setTagPreview(url);
    }
    stopCamera();
  };

  const onCapture = (which) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast.error("Could not capture photo");
        setPreviewForStep(blob, which);
      },
      "image/jpeg",
      0.92
    );
  };

  const onFile = (e, which) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreviewForStep(file, which);
  };

  const analyze = async () => {
    if (!itemBlob || !tagBlob) return;
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append("item_image", itemBlob, "item.jpg");
      form.append("tag_image", tagBlob, "tag.jpg");
      const res = await api.post("/inventory/scan-assist", form);
      const data = res.data || {};
      setDraft({
        consignor_id: data.consignor_id || "",
        text_id: data.text_id || "",
        description: data.description || "",
        category: data.category || "Other",
        size: data.size || "",
        condition: data.condition || "Excellent",
        color: data.color || "",
        rack: data.rack || "",
        asking_price:
          data.asking_price != null && data.asking_price !== ""
            ? String(data.asking_price)
            : "",
        date_in: data.date_in || "",
        confidence: data.confidence || {},
        notes: data.notes || "",
      });
      setStep(2);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleConfirm = () => {
    if (!draft) return;
    if (!draft.description.trim()) {
      return toast.error("Add a description before continuing");
    }
    onConfirm({
      consignor_id: (draft.consignor_id || "").trim(),
      text_id: (draft.text_id || "").trim(),
      description: draft.description.trim(),
      category: draft.category || "Other",
      size: draft.size || "",
      condition: draft.condition || "",
      color: draft.color || "",
      rack: draft.rack || "",
      asking_price: draft.asking_price,
      date_in: draft.date_in || "",
      notes: draft.notes || "",
    });
  };

  const stepKey = STEPS[step];

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent
        className="max-w-lg p-4 sm:p-6 gap-0 overflow-y-auto"
        data-testid="item-scan-dialog"
      >
        <ResponsiveModalHeader className="mb-4">
          <ResponsiveModalTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--ee-magenta)]" />
            Scan item
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Take a photo of the item, then its tag. AI drafts the details — you confirm before saving.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.14em] font-semibold">
          {["Item", "Tag", "Review"].map((label, i) => (
            <div
              key={label}
              className={`flex-1 text-center py-1.5 rounded border ${
                i === step
                  ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
                  : i < step
                    ? "border-[var(--ee-magenta)] text-[var(--ee-magenta)]"
                    : "border-[var(--ee-border)] text-neutral-400"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {stepKey === "item" && (
          <CaptureStep
            title="1. Photo of the item"
            hint="Fill the frame with the garment or accessory."
            previewUrl={itemPreview}
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraReady={cameraReady}
            cameraError={cameraError}
            onCapture={() => onCapture("item")}
            onFile={(e) => onFile(e, "item")}
            onRetake={() => {
              if (itemPreview) URL.revokeObjectURL(itemPreview);
              setItemBlob(null);
              setItemPreview("");
              startCamera();
            }}
            onNext={() => setStep(1)}
            nextLabel="Next: tag photo"
            showBack={false}
          />
        )}

        {stepKey === "tag" && (
          <CaptureStep
            title="2. Photo of the tag"
            hint="Capture ID, date, and any printed description clearly."
            previewUrl={tagPreview}
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraReady={cameraReady}
            cameraError={cameraError}
            onCapture={() => onCapture("tag")}
            onFile={(e) => onFile(e, "tag")}
            onRetake={() => {
              if (tagPreview) URL.revokeObjectURL(tagPreview);
              setTagBlob(null);
              setTagPreview("");
              startCamera();
            }}
            onNext={analyze}
            nextLabel={analyzing ? "Analyzing…" : "Analyze with AI"}
            nextDisabled={analyzing}
            onBack={() => setStep(0)}
            showBack
          />
        )}

        {analyzing && stepKey === "tag" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
            <Loader2 size={14} className="animate-spin" />
            Reading item and tag…
          </div>
        )}

        {stepKey === "review" && draft && (
          <div className="space-y-3">
            {draft.notes ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {draft.notes}
              </p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Consignor ID</Label>
                <Input
                  data-testid="scan-consignor-id"
                  className={confidenceClass(draft.confidence?.consignor_id)}
                  value={draft.consignor_id}
                  onChange={(e) => updateDraft({ consignor_id: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Text ID</Label>
                <Input
                  value={draft.text_id}
                  onChange={(e) => updateDraft({ text_id: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] tracking-[0.14em] uppercase">Description</Label>
                <Textarea
                  data-testid="scan-description"
                  className={confidenceClass(draft.confidence?.description)}
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => updateDraft({ category: v })}
                >
                  <SelectTrigger className={confidenceClass(draft.confidence?.category)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Condition</Label>
                <Select
                  value={draft.condition || "Excellent"}
                  onValueChange={(v) => updateDraft({ condition: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Color</Label>
                <Input
                  className={confidenceClass(draft.confidence?.color)}
                  value={draft.color}
                  onChange={(e) => updateDraft({ color: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Size</Label>
                <Input
                  value={draft.size}
                  onChange={(e) => updateDraft({ size: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Price</Label>
                <Input
                  data-testid="scan-price"
                  type="number"
                  className={confidenceClass(draft.confidence?.asking_price)}
                  value={draft.asking_price}
                  onChange={(e) => updateDraft({ asking_price: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Date in</Label>
                <Input
                  type="date"
                  className={confidenceClass(draft.confidence?.date_in)}
                  value={draft.date_in}
                  onChange={(e) => updateDraft({ date_in: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] tracking-[0.14em] uppercase">Rack</Label>
                <Input
                  value={draft.rack}
                  onChange={(e) => updateDraft({ rack: e.target.value })}
                  placeholder="e.g. gold rack (1)"
                />
              </div>
            </div>

            <ResponsiveModalFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="ee-btn-label"
                onClick={() => {
                  setStep(1);
                  setDraft(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                data-testid="scan-confirm-btn"
                className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            </ResponsiveModalFooter>
          </div>
        )}

        {stepKey !== "review" && (
          <div className="mt-4">
            <Button type="button" variant="ghost" className="ee-btn-label w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
