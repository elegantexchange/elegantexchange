import { createContext, useContext, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const DRAWER_QUERY = "(max-width: 767px)";

const ResponsiveModalContext = createContext(false);

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function useResponsiveModal() {
  return useContext(ResponsiveModalContext);
}

export function ResponsiveModal({ open, onOpenChange, children }) {
  const isDrawer = useMediaQuery(DRAWER_QUERY);

  return (
    <ResponsiveModalContext.Provider value={isDrawer}>
      {isDrawer ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({ className, children, ...props }) {
  const isDrawer = useResponsiveModal();

  if (isDrawer) {
    return (
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[92dvh] overflow-y-auto rounded-t-xl border-[var(--ee-border)] p-4 sm:p-6 gap-4 flex flex-col",
          className
        )}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }

  return (
    <DialogContent
      className={cn("w-[calc(100%-2rem)] max-h-[calc(100dvh-3rem)]", className)}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({ className, ...props }) {
  const isDrawer = useResponsiveModal();
  const Comp = isDrawer ? SheetHeader : DialogHeader;
  return <Comp className={cn(isDrawer && "text-left space-y-1.5", className)} {...props} />;
}

export function ResponsiveModalTitle({ className, ...props }) {
  const isDrawer = useResponsiveModal();
  const Comp = isDrawer ? SheetTitle : DialogTitle;
  return <Comp className={className} {...props} />;
}

export function ResponsiveModalDescription({ className, ...props }) {
  const isDrawer = useResponsiveModal();
  const Comp = isDrawer ? SheetDescription : DialogDescription;
  return <Comp className={className} {...props} />;
}

export function ResponsiveModalFooter({ className, ...props }) {
  const isDrawer = useResponsiveModal();

  if (isDrawer) {
    return (
      <SheetFooter
        className={cn(
          "shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 pt-2 [&_button]:w-full sm:[&_button]:w-auto",
          className
        )}
        {...props}
      />
    );
  }

  return <DialogFooter className={className} {...props} />;
}
