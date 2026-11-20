// Admin → Knowledge: every knowledge base across Organizations, with counts, and a search to try.
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";

export default function KnowledgeAdmin() {
  const bases = useLoad(() => api.api.v1.admin.knowledge.get());
  const [baseId, setBaseId] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ chunkId: string; documentTitle: string; text: string; score: number }[] | null>(null);
  const fb = useFeedback();
  const search = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1.admin.knowledge.search.post({ baseId, query: q, k: 5 });
    if (r.error) return fb.fail(messageOf(r.error), "Could not search");
    setHits(r.data);
  };
  return (
    <div className="space-y-5">
      <Table
        head={["Knowledge base", "Organization", "Model", "Documents", "Chunks", "Made"]}
        empty="No knowledge bases yet."
        rows={(bases.data ?? []).map((b) => [
          <span key="n" className="font-medium">
            {b.name}
          </span>,
          b.organization,
          <code key="m" className="font-mono text-[12.5px]">
            {b.embeddingModel} ({b.dimensions})
          </code>,
          <span key="d">
            {b.documents}
            {b.failed > 0 && (
              <Badge tone="bad" className="ml-2">
                {b.failed} failed
              </Badge>
            )}
          </span>,
          b.chunks,
          <span key="c" className="text-muted">
            {fmtDate(b.createdAt as unknown as string)}
          </span>,
        ])}
      />
      <Card>
        <CardHeader title="Try a search" />
        <form onSubmit={search} className="flex flex-wrap items-end gap-2">
          <Field label="Knowledge base">
            <Select value={baseId} onChange={(e) => setBaseId(e.target.value)} required className="w-64">
              <option value="">Pick one</option>
              {(bases.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.organization} · {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Query" className="min-w-64 flex-1">
            <Input required value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">
            Search
          </Button>
          <Feedback {...fb.props} className="basis-full" />
        </form>
        {hits && (
          <ul className="mt-3 space-y-2">
            {hits.length === 0 && <li className="text-[13px] text-muted">Nothing matched.</li>}
            {hits.map((h, i) => (
              <li key={h.chunkId} className="rounded-lg bg-hover p-3 text-[13px]">
                <div className="mb-1 text-[12px] text-muted">
                  [{i + 1}] {h.documentTitle} · {h.score.toFixed(3)}
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap">{h.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
