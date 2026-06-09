import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";

/**
 * Lightweight signature pad. Renders a canvas the user can draw on with mouse or touch.
 * Exposes: clear() and toDataURL() via ref. Calls onChange(isEmpty) when drawing state changes.
 */
const SignaturePad = forwardRef(function SignaturePad(
  { onChange, height = 180, className = "" },
  ref
) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const [isEmpty, setIsEmpty] = useState(true);

  // Resize canvas to its container while preserving DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#1A1A1A";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pos = (evt) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const e = evt.touches ? evt.touches[0] : evt;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (evt) => {
    evt.preventDefault();
    drawingRef.current = true;
    lastRef.current = pos(evt);
  };
  const move = (evt) => {
    if (!drawingRef.current) return;
    evt.preventDefault();
    const p = pos(evt);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (isEmpty) {
      setIsEmpty(false);
      onChange?.(false);
    }
  };
  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange?.(true);
  };

  const toDataURL = () => canvasRef.current?.toDataURL("image/png");

  useImperativeHandle(ref, () => ({ clear, toDataURL, isEmpty: () => isEmpty }), [isEmpty]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <canvas
        ref={canvasRef}
        data-testid="signature-canvas"
        className="w-full h-full bg-white border border-dashed border-neutral-400 rounded-md cursor-crosshair touch-none"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm font-light pointer-events-none">
          Sign here with your finger or mouse
        </div>
      )}
    </div>
  );
});

export default SignaturePad;
