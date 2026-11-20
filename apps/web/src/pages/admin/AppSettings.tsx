// The app's settings: each namespace the enabled modules declare in their manifests, as a form from its schema.
import { Callout, Card, CardHeader } from "../../components/ui";
import { SchemaForm, type JsonSchema } from "../../components/SchemaForm";
import { LoadError } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";

export default function AppSettings() {
  const settings = useLoad(() => api.api.v1.admin.settings.get());
  if (settings.error) return <LoadError>{settings.error}</LoadError>;
  return (
    <div className="space-y-5">
      {(settings.data ?? []).map((s) => (
        <Card key={s.id}>
          <CardHeader
            title={s.label}
            sub={
              <>
                Declared by the <code className="font-mono text-[12px]">{s.module}</code> module as{" "}
                <code className="font-mono text-[12px]">{s.id}</code>.
              </>
            }
          />
          <SchemaForm
            key={s.id}
            schema={s.schema as JsonSchema}
            value={s.value as Record<string, unknown> | null}
            onSave={async (value) => {
              const r = await api.api.v1.admin.settings({ namespace: s.id }).put({ value, version: s.version });
              if (r.error) return messageOf(r.error);
              void settings.reload();
              return null;
            }}
          />
        </Card>
      ))}
      {settings.data && settings.data.length === 0 && <Callout>No module declares app-wide settings.</Callout>}
    </div>
  );
}
