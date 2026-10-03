// Keep context identity independent of engine/provider hot replacement.
import { createContext, type Dispatch } from "react";
import type { PresentationAction, PresentationState } from "./presentation-model";

export type PresentationContextValue = {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  enabled: boolean;
  ready: boolean;
  storageWarning: boolean;
};
export const PresentationContext = createContext<PresentationContextValue | null>(null);
