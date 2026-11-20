// The mock, on its own route (/mock). It shows the seeded datasets as they are, so the mock can be checked
// without signing in. Loaded lazily from App.tsx, so none of this reaches the main bundle.

import { useState } from "react";
import { business, keywordIdeas, keywords, locations } from "./mock";
import { aiPrompts, aiVisibility } from "./ai";
import { citations } from "./authority";
import { seedContacts } from "./contacts";
import { opportunities } from "./scanner";
import { trends } from "./social";

const datasets: { id: string; label: string; data: () => unknown }[] = [
  { id: "business", label: "Business", data: () => business },
  { id: "locations", label: "Locations", data: () => locations },
  { id: "keywords", label: "Keywords", data: () => keywords },
  { id: "keyword-ideas", label: "Keyword ideas", data: () => keywordIdeas },
  { id: "ai-visibility", label: "AI visibility", data: () => aiVisibility() },
  { id: "ai-prompts", label: "AI prompts", data: () => aiPrompts },
  { id: "citations", label: "Citations", data: () => citations },
  { id: "contacts", label: "Contacts", data: () => seedContacts().contacts },
  { id: "opportunities", label: "Opportunities", data: () => opportunities },
  { id: "trends", label: "Trends", data: () => trends },
];

const countOf = (data: unknown) => (Array.isArray(data) ? `${data.length} items` : "object");

export default function MockPage() {
  const [selected, setSelected] = useState(datasets[0]!.id);
  const current = datasets.find((d) => d.id === selected) ?? datasets[0]!;
  const data = current.data();

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      <nav className="w-56 shrink-0 border-r border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Mock data</p>
        <ul className="space-y-1">
          {datasets.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelected(d.id)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm ${d.id === current.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1 p-6">
        <header className="mb-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">{current.label}</h1>
          <span className="text-sm text-slate-500">{countOf(data)}</span>
        </header>
        <pre className="overflow-auto rounded bg-slate-50 p-4 text-xs leading-relaxed">{JSON.stringify(data, null, 2)}</pre>
      </main>
    </div>
  );
}
