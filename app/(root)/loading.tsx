/**
 * Shown instantly while a signed-in page fetches its data, so navigation never
 * feels frozen. Mirrors the dashboard's layout to avoid a jarring jump.
 */
const Loading = () => (
  <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-10">
    <span className="sr-only">Loading…</span>
    <div className="skeleton h-72 rounded-3xl" />
    <div className="flex flex-col gap-6">
      <div className="skeleton h-9 w-56 rounded-lg" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-96 rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

export default Loading;
