// Whitelabel (Partners): the brand a Partner's Clients see. A section of Settings, shown when a Partner is open.
import { useState, type FormEvent } from "react";
import { Button, Card, CardHeader, Field, Input, PageHeader } from "../../components/ui";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession, type Partner } from "../../lib/session";
import { loadBrand } from "../../lib/brand";

export default function Whitelabel() {
  const { partner } = useSession();
  return partner ? (
    <PartnerWhitelabel partner={partner} />
  ) : (
    <>
      <PageHeader title="Whitelabel" />
      <Card>
        <CardHeader
          title="For partners"
          sub="Partners show their own brand to the organizations they manage. Switch to a Partner organization to edit it."
        />
      </Card>
    </>
  );
}

function PartnerWhitelabel({ partner }: { partner: Partner }) {
  const brand = useLoad(() => api.api.v1.organizations({ orgId: partner.id }).brand.get(), [partner.id]);
  const [draft, setDraft] = useState<{ name: string; assistant: string; accent: string; logo: string } | null>(null);
  const fb = useFeedback();
  const b = draft ?? (brand.data ? { ...brand.data, logo: brand.data.logo ?? "" } : null);

  const saveBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!b) return;
    const r = await api.api.v1.organizations({ orgId: partner.id }).brand.put({ ...b, logo: b.logo || null });
    if (r.error) return fb.fail(messageOf(r.error));
    fb.succeed();
    void brand.reload();
    void loadBrand(partner.id); // the app around this page changes with it
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Whitelabel" sub={`How ${partner.name} looks to its clients.`} />
      <Card>
        <CardHeader title="Brand" sub="What your clients see instead of the app's own name and colour." />
        {b && (
          <form onSubmit={saveBrand} className="max-w-md space-y-4">
            <Field label="Name">
              <Input value={b.name} onChange={(e) => (fb.clear(), setDraft({ ...b, name: e.target.value }))} />
            </Field>
            <Field label="Assistant's name">
              <Input value={b.assistant} onChange={(e) => (fb.clear(), setDraft({ ...b, assistant: e.target.value }))} />
            </Field>
            <Field label="Accent colour" hint="A hex colour, e.g. #1d4ed8.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={b.accent}
                  onChange={(e) => (fb.clear(), setDraft({ ...b, accent: e.target.value }))}
                  className="size-9 rounded border border-line bg-surface"
                  aria-label="Accent colour"
                />
                <Input value={b.accent} onChange={(e) => (fb.clear(), setDraft({ ...b, accent: e.target.value }))} className="w-32" />
              </div>
            </Field>
            <Field label="Logo URL" hint="A hosted image (optional).">
              <Input type="url" value={b.logo} onChange={(e) => (fb.clear(), setDraft({ ...b, logo: e.target.value }))} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary">
                Save brand
              </Button>
              <Feedback {...fb.props} />
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
