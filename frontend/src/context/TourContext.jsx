import { createContext, useCallback, useContext, useMemo, useState } from "react";

const TourContext = createContext({
  tourOpen: false,
  tourRole: null,
  startTour: () => {},
  stopTour: () => {},
});

export function TourProvider({ children }) {
  const [tourOpen, setTourOpen] = useState(false);
  const [tourRole, setTourRole] = useState(null);

  const startTour = useCallback((role) => {
    setTourRole(role || null);
    setTourOpen(true);
  }, []);

  const stopTour = useCallback(() => {
    setTourOpen(false);
    setTourRole(null);
  }, []);

  const value = useMemo(
    () => ({ tourOpen, tourRole, startTour, stopTour }),
    [tourOpen, tourRole, startTour, stopTour]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  return useContext(TourContext);
}
