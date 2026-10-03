// Keep context identity independent of engine/provider hot replacement.
import { createContext, type Dispatch } from "react";
import type { WorkflowAction, WorkflowState } from "./recording-workflow";

export type PresentationContextValue = {
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
  enabled: boolean;
  ready: boolean;
  storageWarning: boolean;
};
export const PresentationContext = createContext<PresentationContextValue | null>(null);
