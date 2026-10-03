import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw, Save, Settings2 } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/firn/shell";
import { Button } from "@/components/ui/button";
import { useFirn } from "@/lib/firn-context";
import { getApiHealth, type ApiHealth } from "@/lib/firn-api";
import { defaultPreferences, formatRecordTime, type Preferences } from "@/lib/workspace-model";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — FIRN" }] }),
  component: Settings,
});
function Settings() {
  const { preferences, savePreferences, storageAvailable, workflowLoaded } = useFirn();
  const [draft, setDraft] = useState(preferences);
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(preferences), [preferences]);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setNotice("");
  };
  const check = async () => {
    setChecking(true);
    setError(null);
    setHealth(null);
    try {
      setHealth(await getApiHealth());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local service unavailable");
    } finally {
      setChecked(new Date().toISOString());
      setChecking(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Preferences"
        title="Settings"
        description="Display and playback preferences for this browser."
      />
      <form
        className="panel max-w-4xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          savePreferences(draft);
          setNotice("Preferences applied.");
        }}
      >
        <SectionTitle>Display & playback</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Preference label="Temperature unit">
            <select
              value={draft.temperatureUnit}
              onChange={(e) =>
                update("temperatureUnit", e.target.value as Preferences["temperatureUnit"])
              }
            >
              <option value="C">Celsius (°C)</option>
              <option value="F">Fahrenheit (°F)</option>
            </select>
          </Preference>
          <Preference label="Wind speed unit">
            <select
              value={draft.windUnit}
              onChange={(e) => update("windUnit", e.target.value as Preferences["windUnit"])}
            >
              <option value="km/h">Kilometres per hour</option>
              <option value="m/s">Metres per second</option>
            </select>
          </Preference>
          <Preference label="Display timezone">
            <select
              value={draft.timezone}
              onChange={(e) => update("timezone", e.target.value as Preferences["timezone"])}
            >
              <option value="UTC">UTC</option>
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
            </select>
          </Preference>
          <Preference label="Default advance step">
            <select
              value={draft.playbackStep}
              onChange={(e) => update("playbackStep", Number(e.target.value))}
            >
              {[1, 6, 12, 24].map((n) => (
                <option key={n} value={n}>
                  {n} hour{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Preference>
        </div>
        <label className="mt-6 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.reducedMotion}
            onChange={(e) => update("reducedMotion", e.target.checked)}
            className="size-4 accent-primary"
          />
          Reduce interface and chart motion
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Your system motion preference is also respected. Display units do not change model inputs.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!workflowLoaded}>
            <Save size={16} />
            Save preferences
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(defaultPreferences);
              setNotice("Defaults selected. Save to apply.");
            }}
          >
            Restore defaults
          </Button>
          <span role="status" className="text-sm text-primary">
            {notice}
          </span>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {storageAvailable
            ? "Preferences and selection are retained on this browser."
            : "Browser storage is unavailable. Changes apply only to this session."}
        </p>
      </form>
      <section className="panel mt-5 max-w-4xl p-6">
        <SectionTitle>Local service diagnostics</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Checks the configured API and its database connection. It does not test an external
          uplink.
        </p>
        <Button variant="outline" className="mt-4" onClick={check} disabled={checking}>
          <RefreshCw size={16} />
          {checking ? "Checking…" : "Check local service"}
        </Button>
        {health && (
          <p role="status" className="mt-3 text-sm">
            API: {health.status} · Database: {health.database}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {checked && (
          <p className="mt-2 text-xs text-muted-foreground">
            Wall-clock check: {formatRecordTime(checked, preferences.timezone)}
          </p>
        )}
      </section>
      <Link
        to="/about"
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
      >
        <Settings2 size={16} />
        Data sources & operating boundaries
      </Link>
    </>
  );
}
function Preference({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm text-muted-foreground [&_select]:h-11 [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:px-3 [&_select]:text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
