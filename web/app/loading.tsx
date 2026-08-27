import VallectiveMark from "@/components/brand/VallectiveMark";

export default function Loading() {
  return (
    <main className="route-loading-shell" aria-busy="true" aria-live="polite">
      <div className="route-loading-content">
        <span className="route-loading-mark" aria-hidden="true">
          <VallectiveMark />
        </span>
        <div>
          <p>Vallective</p>
          <h1>Preparing your collector workspace</h1>
        </div>
        <span className="route-loading-progress" aria-hidden="true" />
      </div>
    </main>
  );
}
