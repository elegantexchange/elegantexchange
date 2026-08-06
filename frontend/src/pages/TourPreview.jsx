import { useEffect } from "react";
import { useTour } from "@/context/TourContext";
import { ROLE_LABELS, roleOf } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

/** Launch the workspace guide anytime (admin included). */
export default function TourPreview() {
  const { user } = useAuth();
  const { startTour, tourOpen } = useTour();

  useEffect(() => {
    // Auto-start once when opening this page
    startTour(roleOf(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 md:px-10 py-10 max-w-xl">
      <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-neutral-500">
        Preview
      </p>
      <h1 className="ee-page-title text-2xl mt-1">Product guide</h1>
      <p className="text-sm text-neutral-500 font-light mt-2">
        {tourOpen
          ? "Guide is running — use Next in the spotlight card."
          : "Start the in-app walkthrough. Works for any role, including admin."}
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        {["admin", "manager", "retail"].map((r) => (
          <Button
            key={r}
            type="button"
            variant="outline"
            className="ee-btn-label"
            onClick={() => startTour(r)}
          >
            {ROLE_LABELS[r]} guide
          </Button>
        ))}
      </div>
    </div>
  );
}
