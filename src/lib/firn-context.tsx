import { createContext, useContext, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { scenarios, type ScenarioId } from './firn-data';

type FirnContextType = {
  scenarioId: ScenarioId; setScenario: (id: ScenarioId) => void;
  reasoningOpen: boolean; setReasoningOpen: (open: boolean) => void;
  planGenerated: boolean; setPlanGenerated: (value: boolean) => void;
};
const FirnContext = createContext<FirnContextType | null>(null);
export function FirnProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('normal');
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(false);
  const setScenario = (id: ScenarioId) => {
    setScenarioId(id);
    toast(id === 'normal' ? 'Normal operating plan restored' : `${scenarios[id].label}: operating plan adapted`, { description: 'Simulation data only' });
  };
  return <FirnContext.Provider value={{ scenarioId, setScenario, reasoningOpen, setReasoningOpen, planGenerated, setPlanGenerated }}>{children}</FirnContext.Provider>;
}
export function useFirn() {
  const context = useContext(FirnContext);
  if (!context) throw new Error('FIRN context missing');
  return { ...context, scenario: scenarios[context.scenarioId] };
}
