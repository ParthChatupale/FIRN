// Keep context identity independent of engine/provider hot replacement.
import { createContext, type Dispatch } from "react";
import type { WorkflowAction, WorkflowState } from "./recording-workflow";

export type PresentationContextValue = {
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
  enabled: boolean;
  ready: boolean;
  storageWarning: boolean;
  scenes: { id: string; name: string; snapshot: WorkflowState }[];
  saveScene: (name: string) => void;
  restoreScene: (id: string) => void;
  removeScene: (id: string) => void;
};
export const PresentationContext = createContext<PresentationContextValue | null>(null);
