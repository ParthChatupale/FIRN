import { useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import {
  initialPresentation,
  presentationReducer,
  restorePresentation,
  PRESENTATION_KEY,
  type PresentationState,
} from "./presentation-model";

import { PresentationContext } from "./presentation-store";
export function PresentationProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);
  // Boot once, without hydration mismatch or access to the backend workflow's keys.
  const [restored, setRestored] = useState<PresentationState | null>(null);
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("workspace");
    setEnabled(mode !== "backend");
    try {
      setRestored(
        restorePresentation(JSON.parse(localStorage.getItem(PRESENTATION_KEY) ?? "null")),
      );
    } catch {
      setRestored(initialPresentation());
      setStorageWarning(true);
    }
    setReady(true);
  }, []);
  // Mount the reducer only once the browser-local state has been validated.
  return (
    <HydratedPresentation
      initial={restored}
      enabled={enabled}
      ready={ready}
      warning={storageWarning}
    >
      {children}
    </HydratedPresentation>
  );
}

function HydratedPresentation({
  initial,
  enabled,
  ready,
  warning,
  children,
}: {
  initial: PresentationState | null;
  enabled: boolean;
  ready: boolean;
  warning: boolean;
  children: ReactNode;
}) {
  if (!ready || !initial)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Preparing station workspace…
      </div>
    );
  return (
    <StateProvider initial={initial} enabled={enabled} warning={warning}>
      {children}
    </StateProvider>
  );
}
function StateProvider({
  initial,
  enabled,
  warning,
  children,
}: {
  initial: PresentationState;
  enabled: boolean;
  warning: boolean;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(presentationReducer, initial);
  const [storageWarning, setWarning] = useState(warning);
  useEffect(() => {
    try {
      localStorage.setItem(PRESENTATION_KEY, JSON.stringify(state));
    } catch {
      setWarning(true);
    }
  }, [state]);
  return (
    <PresentationContext.Provider value={{ state, dispatch, enabled, ready: true, storageWarning }}>
      {children}
    </PresentationContext.Provider>
  );
}
export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) throw new Error("PresentationProvider is required");
  return context;
}
