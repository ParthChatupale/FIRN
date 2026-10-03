import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Selection = {
  runId: string | null;
  planId: string | null;
  monitoringId: string | null;
};
const empty: Selection = { runId: null, planId: null, monitoringId: null };
const storageKey = "firn:operator-workspace:v1";

export function parseSelection(raw: string | null): Selection {
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return empty;
    const record = value as Record<string, unknown>;
    const validId = (id: unknown) =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : null;
    const runId = validId(record.runId);
    return runId
      ? { runId, planId: validId(record.planId), monitoringId: validId(record.monitoringId) }
      : empty;
  } catch {
    return empty;
  }
}

type FirnContextType = Selection & {
  workflowLoaded: boolean;
  workflowRevision: number;
  reviewHour: number;
  setReviewHour: (hour: number) => void;
  selectWorkflow: (selection: Selection) => void;
  setPlanId: (id: string | null) => void;
  refreshWorkflow: () => void;
  caseLibraryOpen: boolean;
  setCaseLibraryOpen: (value: boolean) => void;
};
const Context = createContext<FirnContextType | null>(null);

export function FirnProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(empty);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [workflowRevision, setRevision] = useState(0);
  const [reviewHour, setReviewHour] = useState(0);
  const [caseLibraryOpen, setCaseLibraryOpen] = useState(false);
  useEffect(() => {
    try {
      setSelection(parseSelection(localStorage.getItem(storageKey)));
    } catch {
      /* Storage is optional. */
    }
    setWorkflowLoaded(true);
  }, []);
  useEffect(() => {
    if (workflowLoaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(selection));
      } catch {
        /* Keep the in-memory workspace usable. */
      }
    }
  }, [selection, workflowLoaded]);
  const selectWorkflow = (value: Selection) => {
    setSelection(value);
    setReviewHour(0);
  };
  return (
    <Context.Provider
      value={{
        ...selection,
        workflowLoaded,
        workflowRevision,
        reviewHour,
        setReviewHour,
        selectWorkflow,
        setPlanId: (planId) => setSelection((previous) => ({ ...previous, planId })),
        refreshWorkflow: () => setRevision((previous) => previous + 1),
        caseLibraryOpen,
        setCaseLibraryOpen,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useFirn() {
  const context = useContext(Context);
  if (!context) throw new Error("The operator workspace provider is missing.");
  return context;
}
