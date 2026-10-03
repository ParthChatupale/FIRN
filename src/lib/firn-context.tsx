import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Context,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { scenarios, type ScenarioId } from "./firn-data";
import {
  defaultPreferences,
  defaultOperator,
  readPreferences,
  readOperator,
  readSelection,
  selectRun,
  selectDependent,
  type Preferences,
  type OperatorProfile,
  type WorkspaceSelection,
} from "./workspace-model";

type FirnContextType = {
  scenarioId: ScenarioId;
  setScenario: (id: ScenarioId) => void;
  reasoningOpen: boolean;
  setReasoningOpen: (open: boolean) => void;
  planGenerated: boolean;
  setPlanGenerated: (value: boolean) => void;
  runId: string | null;
  setRunId: (id: string | null) => void;
  planId: string | null;
  setPlanId: (id: string | null) => void;
  monitoringId: string | null;
  workflowLoaded: boolean;
  workflowRevision: number;
  refreshWorkflow: () => void;
  setMonitoringId: (id: string | null) => void;
  preferences: Preferences;
  motionReduced: boolean;
  operator: OperatorProfile;
  savePreferences: (value: Preferences) => void;
  saveOperator: (value: OperatorProfile) => void;
  storageAvailable: boolean;
};
// Dev-only cache preserves the context across Vite updates: an old provider and an updated
// consumer must not temporarily refer to different context instances.
const FirnContext =
  (import.meta.hot?.data["firnContext"] as Context<FirnContextType | null> | undefined) ??
  createContext<FirnContextType | null>(null);
if (import.meta.hot) import.meta.hot.data["firnContext"] = FirnContext;
export function FirnProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("normal");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [selection, setSelection] = useState<WorkspaceSelection>({
    runId: null,
    planId: null,
    monitoringId: null,
  });
  const { runId, planId, monitoringId } = selection;
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [operator, setOperator] = useState(defaultOperator);
  const [systemMotionReduced, setSystemMotionReduced] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [workflowRevision, setWorkflowRevision] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemMotionReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      const read = (key: string) => {
        try {
          return JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
        } catch {
          return null;
        }
      };
      setSelection(
        readSelection(
          read("firn:workspace") ?? {
            runId: window.localStorage.getItem("firn:run"),
            planId: window.localStorage.getItem("firn:plan"),
            monitoringId: window.localStorage.getItem("firn:monitoring"),
          },
        ),
      );
      setPreferences(readPreferences(read("firn:preferences")));
      setOperator(readOperator(read("firn:operator")));
    } catch {
      setStorageAvailable(false);
    }
    setWorkflowLoaded(true);
  }, []);
  useEffect(() => {
    if (!workflowLoaded) return;
    const values = [
      ["run", runId],
      ["plan", planId],
      ["monitoring", monitoringId],
    ] as const;
    try {
      window.localStorage.setItem("firn:workspace", JSON.stringify(selection));
      window.localStorage.setItem("firn:preferences", JSON.stringify(preferences));
      window.localStorage.setItem("firn:operator", JSON.stringify(operator));
      for (const [key, value] of values) {
        if (value) window.localStorage.setItem(`firn:${key}`, value);
        else window.localStorage.removeItem(`firn:${key}`);
      }
    } catch {
      setStorageAvailable(false);
    }
  }, [selection, preferences, operator, runId, planId, monitoringId, workflowLoaded]);
  useEffect(() => {
    document.documentElement.dataset["motion"] = preferences.reducedMotion ? "reduce" : "system";
    return () => {
      delete document.documentElement.dataset["motion"];
    };
  }, [preferences.reducedMotion]);
  const refreshWorkflow = () => setWorkflowRevision((value) => value + 1);
  const setRunId = (id: string | null) => {
    setSelection((previous) => selectRun(previous, id));
    setPlanGenerated(false);
    refreshWorkflow();
  };
  const setPlanId = (id: string | null) => {
    setSelection((previous) => selectDependent(previous, "planId", id, runId));
    refreshWorkflow();
  };
  const setMonitoringId = (id: string | null) => {
    setSelection((previous) => selectDependent(previous, "monitoringId", id, runId));
    refreshWorkflow();
  };
  const setScenario = (id: ScenarioId) => {
    setScenarioId(id);
    toast(id === "normal" ? "Normal scenario selected" : `${scenarios[id].label} selected`, {
      description: "Run the simulation to save calculated results.",
    });
  };
  return (
    <FirnContext.Provider
      value={{
        scenarioId,
        setScenario,
        reasoningOpen,
        setReasoningOpen,
        planGenerated,
        setPlanGenerated,
        runId,
        setRunId,
        planId,
        setPlanId,
        monitoringId,
        workflowLoaded,
        workflowRevision,
        refreshWorkflow,
        setMonitoringId,
        preferences,
        motionReduced: preferences.reducedMotion || systemMotionReduced,
        operator,
        storageAvailable,
        savePreferences: (value) => setPreferences(readPreferences(value)),
        saveOperator: (value) => setOperator(readOperator(value)),
      }}
    >
      {children}
    </FirnContext.Provider>
  );
}
export function useFirn() {
  const context = useContext(FirnContext);
  if (!context) throw new Error("FIRN context missing");
  return { ...context, scenario: scenarios[context.scenarioId] };
}
