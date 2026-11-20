import { useState } from "react";
import { Badge, Button, Card, CardHeader, SearchInput } from "../../components/ui";
import { Row, Table } from "../../components/Table";
import { useToast } from "../../components/Feedback";
import { api, fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";

export default function Users() {
  const { me } = useSession();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const users = useLoad(() => api.api.v1.admin.users.get({ query: term ? { q: term } : {} }), [term]);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useLoad(
    () => (open ? api.api.v1.admin.users({ userId: open }).get() : Promise.resolve({ data: null, error: null })),
    [open],
  );
  const toast = useToast();

  const patch = async (userId: string, body: { role?: "admin" | "user"; banned?: boolean }) => {
    const r = await api.api.v1.admin.users({ userId }).patch(body);
    if (r.error) return toast.error(messageOf(r.error), "Could not update the user");
    void users.reload();
    void detail.reload();
  };
  const signOutEverywhere = async (userId: string) => {
    const r = await api.api.v1.admin.users({ userId })["sign-out"].post();
    if (r.error) return toast.error(messageOf(r.error), "Could not sign them out");
    toast.success("Signed out everywhere");
    void users.reload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => (e.preventDefault(), setTerm(q))} className="max-w-sm">
        <SearchInput placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <Table
        head={["User", "Role", "Organizations", "Sessions", "Joined", ""]}
        rows={(users.data ?? []).map((u) => [
          <button key="u" onClick={() => setOpen(u.id)} className="text-left hover:underline">
            <span className="block font-medium">
              {u.name}
              {u.id === me?.id && <span className="ml-1.5 text-[12px] text-subtle">you</span>}
            </span>
            <span className="block text-[12.5px] text-muted">{u.email}</span>
          </button>,
          <span key="r" className="flex gap-1">
            {u.role === "admin" && <Badge tone="accent">Admin</Badge>}
            {u.banned && <Badge tone="bad">Banned</Badge>}
            {!u.emailVerified && <Badge>unverified</Badge>}
          </span>,
          u.organizations,
          u.sessions,
          <span key="j" className="text-muted">
            {fmtDate(u.createdAt as unknown as string)}
          </span>,
          u.id !== me?.id ? (
            <span key="a" className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => void patch(u.id, { role: u.role === "admin" ? "user" : "admin" })}>
                {u.role === "admin" ? "Remove admin" : "Make admin"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void patch(u.id, { banned: !u.banned })}>
                {u.banned ? "Unban" : "Ban"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void signOutEverywhere(u.id)}>
                Sign out
              </Button>
            </span>
          ) : null,
        ])}
      />
      {open && detail.data && (
        <Card>
          <CardHeader
            title={detail.data.name}
            sub={detail.data.email}
            right={
              <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
            }
          />
          <Row label="Role">{detail.data.role}</Row>
          <Row label="Email verified">{detail.data.emailVerified ? "yes" : "no"}</Row>
          <Row label="Joined">{fmtDate(detail.data.createdAt as unknown as string)}</Row>
          <Row label="Organizations">
            {detail.data.organizations.length ? detail.data.organizations.map((o) => `${o.name} (${o.role})`).join(", ") : "none"}
          </Row>
        </Card>
      )}
    </div>
  );
}
