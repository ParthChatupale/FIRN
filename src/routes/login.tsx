import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/firn/shell";
import { useFirn } from "@/lib/firn-context";
import type { OperatorProfile } from "@/lib/workspace-model";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Operator Workspace — FIRN" }] }),
  component: OperatorEntry,
});
function OperatorEntry() {
  const { operator, saveOperator, workflowLoaded, storageAvailable } = useFirn();
  const [name, setName] = useState(operator.name);
  const [role, setRole] = useState<OperatorProfile["role"]>(operator.role);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setName(operator.name);
    setRole(operator.role);
  }, [operator]);
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Operator"
        title="Operator access"
        description="Set the operator identity recorded with your plan decisions."
      />
      <form
        className="panel mx-auto max-w-xl p-6 md:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          saveOperator({ name, role });
          setSaved(true);
        }}
      >
        <UserRound size={28} className="mb-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Your operating workspace</h2>
        <label className="mt-6 block space-y-2 text-sm">
          <span>Operator name</span>
          <Input
            value={name}
            required
            maxLength={80}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="mt-5 block space-y-2 text-sm">
          <span>Operating role</span>
          <select
            className="h-11 w-full rounded border border-input bg-background px-3"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as OperatorProfile["role"]);
              setSaved(false);
            }}
          >
            <option>Station operator</option>
            <option>Mission coordinator</option>
          </select>
        </label>
        <Button className="mt-6" type="submit" disabled={!workflowLoaded || !name.trim()}>
          Save operator profile
        </Button>
        {saved && (
          <div role="status" className="mt-4 text-sm text-primary">
            Profile applied.
            {!storageAvailable && " Browser storage is unavailable; this profile is session-only."}
            <Button asChild className="mt-4 block w-fit">
              <Link to="/">
                Enter Operations <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
        )}
        <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Local presentation profile, not password authentication. Roles describe your work; they do
          not enforce access permissions. Existing decision records are not renamed.
        </p>
      </form>
    </>
  );
}
