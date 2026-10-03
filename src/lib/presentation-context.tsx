import {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PRESENTATION_KEY } from "./presentation-model";
import {
  initializeWorkflow,
  workflowReducer,
  restoreWorkflow,
  WORKFLOW_KEY,
  PREPARATION_MS,
  type WorkflowState,
  type WorkflowAction,
} from "./recording-workflow";

import { PresentationContext } from "./presentation-store";
export function PresentationProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);
  // Boot once, without hydration mismatch or access to the backend workflow's keys.
  const [restored, setRestored] = useState<WorkflowState | null>(null);
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("workspace");
    setEnabled(mode !== "backend");
    try {
      setRestored(
        restoreWorkflow(
          JSON.parse(
            localStorage.getItem(WORKFLOW_KEY) ?? localStorage.getItem(PRESENTATION_KEY) ?? "null",
          ),
        ),
      );
    } catch {
      setRestored(initializeWorkflow());
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
  initial: WorkflowState | null;
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
  initial: WorkflowState;
  enabled: boolean;
  warning: boolean;
  children: ReactNode;
}) {
  const [state, rawDispatch] = useReducer(workflowReducer, initial);
  const currentState = useRef(state);
  useEffect(() => {
    currentState.current = state;
  }, [state]);
  const dispatch = useCallback(
    (action: WorkflowAction) => rawDispatch({ ...action, receivedAt: new Date().toISOString() }),
    [],
  );
  const [storageWarning, setWarning] = useState(warning);
  useEffect(() => {
    const task = state.preparation;
    if (!task) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      const action: WorkflowAction = {
        type: "complete-task",
        token: task.token,
        elapsedMs: performance.now() - started,
      };
      try {
        workflowReducer(currentState.current, action);
        dispatch(action);
      } catch {
        dispatch({ type: "fail-task", token: task.token });
      }
    }, PREPARATION_MS[task.kind] + 20);
    return () => window.clearTimeout(timer);
  }, [state.preparation, dispatch]);
  useEffect(() => {
    try {
      localStorage.setItem(WORKFLOW_KEY, JSON.stringify(state));
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
