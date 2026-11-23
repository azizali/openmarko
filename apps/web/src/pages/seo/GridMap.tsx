// The map grid on a real map: a dot at each spot Google Maps is searched from, on OpenFreeMap tiles drawn by
// MapLibre, zoomable and draggable. With ranks it shows the business's position at each spot (tap one for that
// spot's top 3); without, it's a preview of where a grid will search. MapLibre is loaded on first use, so it only
// weighs on the pages that show a map.
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibre, Marker } from "maplibre-gl";
import { LocateFixed, Maximize2, Minimize2 } from "lucide-react";
import { gridArea, miles, spacingM } from "./distance";

type Point = { lat: number; lng: number };

/** OpenFreeMap: free vector tiles from OpenStreetMap data, no key. A quiet style so the dots carry the colour. */
const styleUrl = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;
const isDark = () => document.documentElement.classList.contains("dark");

const fill = (r: number | null) => (r === null ? "var(--subtle)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)");

export function GridMap({
  size,
  spots,
  radiusM,
  ranks,
  selected,
  onSelect,
}: {
  size: number;
  /** Where each spot is, by index (row * size + col; row 0 is the north edge). */
  spots: Point[];
  /** How far the grid reaches from the door each way: shown under the map. */
  radiusM?: number;
  /** Position at each spot, by index; left out for a preview of where the grid will search. */
  ranks?: (number | null)[];
  selected?: number | null;
  onSelect?: (idx: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const markers = useRef<{ marker: Marker; el: HTMLButtonElement; dot: HTMLSpanElement }[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Shown over the whole window, for a closer look; Escape or the button puts it back. */
  const [expanded, setExpanded] = useState(false);
  const c = (size - 1) / 2;
  const door = c * size + c;
  const key = spots.map((s) => `${s.lat},${s.lng}`).join(";");

  // The map itself, once; its style follows the app's light or dark theme.
  useEffect(() => {
    let gone = false;
    let watch: MutationObserver | null = null;
    Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")])
      .then(([ml]) => {
        if (gone || !box.current) return;
        lib.current = ml;
        const m = new ml.Map({
          container: box.current,
          style: styleUrl(isDark()),
          center: [spots[door]?.lng ?? 0, spots[door]?.lat ?? 0],
          zoom: 12,
          // On a page that scrolls: ctrl/⌘ + scroll zooms, two fingers pan, so the page still scrolls past.
          cooperativeGestures: true,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.current = m;
        // Made while hidden (a closed drawer), it fitted the grid to nothing: fit again once it has a size.
        let wasHidden = !box.current.clientWidth;
        m.on("resize", () => {
          if (wasHidden && box.current?.clientWidth) {
            wasHidden = false;
            fitRef.current(false);
          }
        });
        let dark = isDark();
        watch = new MutationObserver(() => {
          if (isDark() !== dark) m.setStyle(styleUrl((dark = isDark())));
        });
        watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      gone = true;
      watch?.disconnect();
      map.current?.remove();
      map.current = null;
      markers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- made once; spots are followed below
  }, []);

  const fit = (animate: boolean) => {
    const ml = lib.current;
    if (!map.current || !ml || !spots.length) return;
    const bounds = new ml.LngLatBounds();
    for (const s of spots) bounds.extend([s.lng, s.lat]);
    // Room for the outer dots (28px) and the controls and credit along the edges.
    map.current.fitBounds(bounds, { padding: { top: 44, right: 52, bottom: 52, left: 44 }, animate, maxZoom: 17 });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // A dot per spot, remade when the grid moves or changes size; the view is fitted to it.
  useEffect(() => {
    const ml = lib.current;
    if (!ready || !map.current || !ml) return;
    for (const { marker } of markers.current) marker.remove();
    markers.current = spots.map((s, idx) => {
      // The marker MapLibre moves (with `transform`) never changes size; the dot inside it grows on hover. Scaling the
      // marker itself would scale its position too, and the dot would jump across the map.
      const el = document.createElement("button");
      el.type = "button";
      const dot = document.createElement("span");
      el.append(dot);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        select.current?.(idx);
      });
      return { el, dot, marker: new ml.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map.current!) };
    });
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `spots`
  }, [ready, key]);

  // What each dot shows: its position, colour, and whether it's picked.
  useEffect(() => {
    markers.current.forEach(({ el, dot }, idx) => {
      const row = Math.floor(idx / size);
      const col = idx % size;
      const r = ranks ? (ranks[idx] ?? null) : undefined;
      const isDoor = idx === door;
      el.disabled = !onSelect;
      el.setAttribute("aria-pressed", String(selected === idx));
      el.setAttribute(
        "aria-label",
        `Row ${row + 1}, column ${col + 1}${isDoor ? " (your business)" : ""}${r === undefined ? "" : `: ${r === null ? "not in the top 20" : `position ${r}`}`}`,
      );
      // MapLibre places a marker with its own classes and moves it with `transform`: keep those, and leave `transform`
      // alone (no transition, no scale), or the dots drift, lag or jump as the map moves.
      const own = [...el.classList].filter((c) => c.startsWith("maplibregl-"));
      el.className = [
        ...own,
        "group grid place-items-center rounded-full",
        r === undefined ? "size-3.5" : "size-7",
        onSelect ? "cursor-pointer" : "cursor-default",
      ].join(" ");
      dot.textContent = r === undefined ? "" : String(r ?? "20+");
      dot.className = [
        "num grid size-full place-items-center rounded-full font-semibold text-white shadow-sm transition-[scale] duration-150",
        r === undefined ? "border-2 border-white" : "text-[11px]",
        onSelect ? "group-hover:scale-115 group-focus-visible:scale-115" : "",
        selected === idx ? "ring-2 ring-ink ring-offset-2 ring-offset-white" : "",
        isDoor ? "outline-2 outline-offset-2 outline-ink" : "",
      ].join(" ");
      dot.style.background = r === undefined ? (isDoor ? "var(--ink)" : "var(--accent)") : fill(r);
    });
  }, [ranks, selected, onSelect, size, door, ready, key]);

  // Expanded or put back: the map takes its new size, then shows the whole grid again. Escape puts it back, and the
  // page behind doesn't scroll meanwhile.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const frame = requestAnimationFrame(() => {
      m.resize();
      fitRef.current(true);
    });
    if (!expanded) return () => cancelAnimationFrame(frame);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
    };
  }, [expanded]);

  const control = "grid size-[29px] place-items-center rounded bg-white text-zinc-800 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-zinc-100";
  return (
    <figure>
      {expanded && <div aria-hidden className="fixed inset-0 z-50 bg-black/40" onClick={() => setExpanded(false)} />}
      {/* Keeps the map's place on the page while it's shown over the window. */}
      {expanded && <div aria-hidden className="aspect-square w-full rounded-lg border border-dashed border-line" />}
      <div
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? "Map, full size" : undefined}
        className={
          expanded
            ? "fixed inset-3 z-50 overflow-hidden rounded-xl border border-line shadow-float sm:inset-8"
            : "relative aspect-square w-full overflow-hidden rounded-lg border border-line"
        }
        style={{ background: "var(--map-land)" }}
      >
        {/* MapLibre's stylesheet makes its container `position: relative`, so the container fills a wrapper that's
            absolutely placed, rather than being placed itself (it would collapse to no height). */}
        <div className="absolute inset-0">
          <div ref={box} className="h-full w-full" />
        </div>
        {failed && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-muted">The map couldn't load.</p>
        )}
        {ready && (
          <div className="absolute bottom-2 left-2 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Back to the page" : "Expand the map"}
              title={expanded ? "Back to the page (Esc)" : "Expand the map"}
              className={control}
            >
              {expanded ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => fit(true)}
              aria-label="Show the whole grid"
              title="Show the whole grid"
              className={control}
            >
              <LocateFixed size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>
      {radiusM !== undefined && (
        <figcaption className="num mt-2 text-[12.5px] text-muted">
          {size} × {size} spots {miles(spacingM(radiusM, size))} apart, covering {gridArea(radiusM)}: {miles(radiusM)} from your business
          each way.
        </figcaption>
      )}
    </figure>
  );
}

const M_PER_DEG_LAT = 111_320;

/**
 * Where a grid's spots will be, for a preview before it has searched. The same layout as the API's `spotsOf`
 * (modules/seo/src/lib/grid.ts): odd size, the middle spot on the door, the outer ring `radiusM` away along each axis.
 */
export function spotsOf(center: Point, size: number, radiusM: number): Point[] {
  const c = (size - 1) / 2;
  const step = c === 0 ? 0 : radiusM / c;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
  const out: Point[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      out.push({ lat: center.lat + ((c - row) * step) / M_PER_DEG_LAT, lng: center.lng + ((col - c) * step) / mPerDegLng });
  return out;
}
