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
  validSceneSnapshot,
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
  const [scenes, setScenes] = useState<{ id: string; name: string; snapshot: WorkflowState }[]>([]);
  const [scenesReady, setScenesReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("firn:rehearsal:scenes:v1") ?? "[]");
      if (Array.isArray(saved))
        setScenes(
          saved
            .filter(
              (item) =>
                typeof item?.id === "string" &&
                typeof item?.name === "string" &&
                validSceneSnapshot(item.snapshot),
            )
            .slice(-24),
        );
    } catch {
      setWarning(true);
    }
    setScenesReady(true);
  }, []);
  useEffect(() => {
    if (!scenesReady) return;
    try {
      localStorage.setItem("firn:rehearsal:scenes:v1", JSON.stringify(scenes));
    } catch {
      setWarning(true);
    }
  }, [scenes, scenesReady]);
  const saveScene = useCallback((name: string) => {
    const snapshot = currentState.current;
    if (snapshot.preparation || snapshot.failedPreparation || !name.trim()) return;
    const copy = JSON.parse(
      JSON.stringify({ ...snapshot, playback: { ...snapshot.playback, running: false } }),
    ) as WorkflowState;
    setScenes((items) =>
      [
        ...items.filter((item) => item.name !== name.trim()),
        {
          id: `scene-${Date.now()}-${snapshot.sequence}`,
          name: name.trim().slice(0, 80),
          snapshot: copy,
        },
      ].slice(-24),
    );
  }, []);
  const restoreScene = useCallback(
    (id: string) => {
      const item = scenes.find((scene) => scene.id === id);
      if (item)
        dispatch({ type: "restore-scene", snapshot: JSON.parse(JSON.stringify(item.snapshot)) });
    },
    [scenes, dispatch],
  );
  const removeScene = useCallback(
    (id: string) => setScenes((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const lastCheckpoint = useRef("");
  useEffect(() => {
    if (!scenesReady || state.playback.running || state.preparation || state.failedPreparation)
      return;
    const name = state.playback.reason;
    if (
      ![
        "Baseline / planning",
        "forecast ready",
        "plan ready",
        "assessment ready",
        "Weather checkpoint",
        "Weather observed",
        "Asset checkpoint",
        "Outcome checkpoint H48",
      ].includes(name) &&
      !name.startsWith("Plan V")
    )
      return;
    const key = `${name}-${state.activeVersion}-${state.assumptionVersion}-${state.proposal?.version ?? 0}-${state.hour}`;
    if (lastCheckpoint.current === key) return;
    lastCheckpoint.current = key;
    saveScene(`${name} · V${state.proposal?.version ?? state.activeVersion} · H${state.hour}`);
  }, [state, scenesReady, saveScene]);
  useEffect(() => {
    if (!enabled || !state.playback.running) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        dispatch({ type: "toggle-playback" });
        return;
      }
      dispatch({ type: "tick", minutes: currentState.current.playback.rate });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enabled, state.playback.running, dispatch]);
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
    <PresentationContext.Provider
      value={{
        state,
        dispatch,
        enabled,
        ready: true,
        storageWarning,
        scenes,
        saveScene,
        restoreScene,
        removeScene,
      }}
    >
      {children}
    </PresentationContext.Provider>
  );
}
export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) throw new Error("PresentationProvider is required");
  return context;
}
