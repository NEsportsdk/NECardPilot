"use client";

import type {
  RapidIntakeEvent,
  RapidIntakePricingMode,
  RapidIntakeSettings,
} from "@/lib/scan/rapidIntake";

type RapidIntakePanelProps = {
  enabled: boolean;
  events: RapidIntakeEvent[];
  selectedEventId: string;
  selectedEvent: RapidIntakeEvent | null;
  settings: RapidIntakeSettings;
  collectionType: "pc" | "inventory" | null;
  collectionCurrency: string | null;
  destinationLocked: boolean;
  loading: boolean;
  readinessError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onEventChange: (eventId: string) => void;
  onSettingsChange: (settings: RapidIntakeSettings) => void;
};

const PRICING_OPTIONS: Array<{
  value: RapidIntakePricingMode;
  label: string;
  description: string;
}> = [
  {
    value: "estimate",
    label: "From card value",
    description: "Use the reviewed estimate and your percentages.",
  },
  {
    value: "fixed",
    label: "Fixed price",
    description: "Apply the same asking and floor to every scan.",
  },
  {
    value: "unpriced",
    label: "Price later",
    description: "Add the card now and flag it for pricing.",
  },
];

function formatEventDate(value: string | null) {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function RapidIntakePanel({
  enabled,
  events,
  selectedEventId,
  selectedEvent,
  settings,
  collectionType,
  collectionCurrency,
  destinationLocked,
  loading,
  readinessError,
  onEnabledChange,
  onEventChange,
  onSettingsChange,
}: RapidIntakePanelProps) {
  const controlsDisabled = destinationLocked;

  function updateSettings(patch: Partial<RapidIntakeSettings>) {
    onSettingsChange({
      ...settings,
      ...patch,
    });
  }

  return (
    <section
      className={`rapid-intake-panel ${enabled ? "rapid-intake-enabled" : ""}`}
      data-testid="rapid-intake-panel"
    >
      <div className="rapid-intake-heading">
        <div className="rapid-intake-icon">⚡</div>

        <div>
          <p className="rapid-intake-eyebrow">Cardshow destination</p>
          <h2>Rapid intake</h2>
          <p>
            Save each reviewed scan and add it directly to one Cardshow.
          </p>
        </div>

        <button
          aria-checked={enabled}
          className={`rapid-intake-switch ${
            enabled ? "rapid-intake-switch-active" : ""
          }`}
          data-testid="rapid-intake-toggle"
          disabled={controlsDisabled}
          onClick={() => onEnabledChange(!enabled)}
          role="switch"
          type="button"
        >
          <span />
          <strong>{enabled ? "On" : "Off"}</strong>
        </button>
      </div>

      {enabled ? (
        <div className="rapid-intake-content">
          {destinationLocked ? (
            <div className="rapid-intake-lock">
              <span>✓</span>
              <p>Event and pricing are locked for the current scan session.</p>
            </div>
          ) : null}

          <label className="rapid-intake-field">
            <span>Cardshow</span>
            <select
              data-testid="rapid-intake-event"
              disabled={controlsDisabled || loading || events.length === 0}
              onChange={(event) => onEventChange(event.target.value)}
              value={selectedEventId}
            >
              <option value="">Choose planning or active event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.status} · {event.currency}
                </option>
              ))}
            </select>
          </label>

          {selectedEvent ? (
            <div className="rapid-intake-event-summary">
              <span>{selectedEvent.status}</span>
              <strong>{selectedEvent.name}</strong>
              <small>
                {formatEventDate(selectedEvent.startsAt)} · {selectedEvent.currency}
              </small>
            </div>
          ) : null}

          <fieldset className="rapid-pricing-fieldset" disabled={controlsDisabled}>
            <legend>Default pricing</legend>
            <div className="rapid-pricing-options">
              {PRICING_OPTIONS.map((option) => {
                const selected = settings.pricingMode === option.value;

                return (
                  <button
                    className={selected ? "rapid-pricing-selected" : ""}
                    data-testid={`rapid-pricing-${option.value}`}
                    key={option.value}
                    onClick={() => updateSettings({ pricingMode: option.value })}
                    type="button"
                  >
                    <span>{selected ? "●" : "○"}</span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {settings.pricingMode === "estimate" ? (
            <div className="rapid-price-grid">
              <label className="rapid-intake-field">
                <span>Asking % of value</span>
                <div className="rapid-input-suffix">
                  <input
                    data-testid="rapid-asking-percent"
                    disabled={controlsDisabled}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateSettings({ askingPercentage: event.target.value })
                    }
                    value={settings.askingPercentage}
                  />
                  <span>%</span>
                </div>
              </label>

              <label className="rapid-intake-field">
                <span>Floor % of asking</span>
                <div className="rapid-input-suffix">
                  <input
                    data-testid="rapid-floor-percent"
                    disabled={controlsDisabled}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateSettings({ floorPercentage: event.target.value })
                    }
                    value={settings.floorPercentage}
                  />
                  <span>%</span>
                </div>
              </label>
            </div>
          ) : null}

          {settings.pricingMode === "fixed" ? (
            <div className="rapid-price-grid">
              <label className="rapid-intake-field">
                <span>Fixed asking</span>
                <div className="rapid-input-suffix">
                  <input
                    data-testid="rapid-fixed-asking"
                    disabled={controlsDisabled}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateSettings({ fixedAskingPrice: event.target.value })
                    }
                    placeholder="0,00"
                    value={settings.fixedAskingPrice}
                  />
                  <span>{selectedEvent?.currency ?? collectionCurrency ?? ""}</span>
                </div>
              </label>

              <label className="rapid-intake-field">
                <span>Fixed floor</span>
                <div className="rapid-input-suffix">
                  <input
                    data-testid="rapid-fixed-floor"
                    disabled={controlsDisabled}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateSettings({ fixedFloorPrice: event.target.value })
                    }
                    placeholder="Optional"
                    value={settings.fixedFloorPrice}
                  />
                  <span>{selectedEvent?.currency ?? collectionCurrency ?? ""}</span>
                </div>
              </label>
            </div>
          ) : null}

          <div className="rapid-price-grid">
            <label className="rapid-intake-field">
              <span>Physical location</span>
              <input
                data-testid="rapid-location"
                disabled={controlsDisabled}
                maxLength={160}
                onChange={(event) =>
                  updateSettings({ locationLabel: event.target.value })
                }
                placeholder="Showcase 1 · Row A"
                value={settings.locationLabel}
              />
            </label>

            <label className="rapid-intake-field">
              <span>Inventory prefix</span>
              <input
                data-testid="rapid-code-prefix"
                disabled={controlsDisabled}
                maxLength={40}
                onChange={(event) =>
                  updateSettings({ inventoryCodePrefix: event.target.value })
                }
                placeholder="CASE-A"
                value={settings.inventoryCodePrefix}
              />
            </label>
          </div>

          {readinessError ? (
            <div className="rapid-intake-warning" role="alert">
              <span>!</span>
              <p>{readinessError}</p>
            </div>
          ) : (
            <div className="rapid-intake-ready">
              <span>✓</span>
              <p>
                Ready: every saved scan will become Available inventory in
                {selectedEvent ? ` ${selectedEvent.name}` : " the selected event"}.
              </p>
            </div>
          )}

          {collectionType === "pc" ? (
            <p className="rapid-intake-footnote">
              Choose a Dealer Inventory-collection above before starting.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rapid-intake-off-copy">
          Collection-only scanning remains active. Turn Rapid intake on when
          preparing inventory for a show.
        </p>
      )}

      <style jsx>{`
        .rapid-intake-panel {
          min-width: 0;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background: #10131b;
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.17);
          color: #f8fafc;
        }

        .rapid-intake-enabled {
          border-color: rgba(45, 212, 191, 0.2);
          background:
            radial-gradient(
              circle at top right,
              rgba(20, 184, 166, 0.09),
              transparent 38%
            ),
            #10131b;
        }

        .rapid-intake-heading {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: start;
          gap: 12px;
        }

        .rapid-intake-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(20, 184, 166, 0.1);
          color: #5eead4;
          font-size: 15px;
        }

        .rapid-intake-eyebrow {
          margin: 0;
          color: #5eead4;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .rapid-intake-heading h2 {
          margin: 5px 0 0;
          color: #ffffff;
          font-size: 17px;
        }

        .rapid-intake-heading p:last-child,
        .rapid-intake-off-copy,
        .rapid-intake-footnote {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 9px;
          line-height: 1.5;
        }

        .rapid-intake-switch {
          width: 70px;
          min-height: 36px;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 6px;
          padding: 4px 7px 4px 4px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.025);
          color: #71798b;
          cursor: pointer;
        }

        .rapid-intake-switch:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .rapid-intake-switch > span {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          background: #3b4150;
        }

        .rapid-intake-switch strong {
          font-size: 8px;
          text-transform: uppercase;
        }

        .rapid-intake-switch-active {
          border-color: rgba(45, 212, 191, 0.3);
          background: rgba(20, 184, 166, 0.08);
          color: #99f6e4;
        }

        .rapid-intake-switch-active > span {
          background: #2dd4bf;
          box-shadow: 0 0 14px rgba(45, 212, 191, 0.35);
        }

        .rapid-intake-content {
          display: grid;
          gap: 15px;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
        }

        .rapid-intake-lock,
        .rapid-intake-warning,
        .rapid-intake-ready {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 10px 11px;
          border-radius: 11px;
          font-size: 9px;
          line-height: 1.45;
        }

        .rapid-intake-lock,
        .rapid-intake-ready {
          border: 1px solid rgba(45, 212, 191, 0.16);
          background: rgba(20, 184, 166, 0.055);
          color: #99f6e4;
        }

        .rapid-intake-warning {
          border: 1px solid rgba(251, 191, 36, 0.2);
          background: rgba(245, 158, 11, 0.065);
          color: #fde68a;
        }

        .rapid-intake-lock p,
        .rapid-intake-warning p,
        .rapid-intake-ready p {
          margin: 0;
        }

        .rapid-intake-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .rapid-intake-field > span,
        .rapid-pricing-fieldset legend {
          color: #7b8496;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .rapid-intake-field input,
        .rapid-intake-field select {
          min-width: 0;
          width: 100%;
          min-height: 40px;
          padding: 0 11px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.16);
          color: #e5e7eb;
          font: inherit;
          font-size: 10px;
        }

        .rapid-intake-field input:disabled,
        .rapid-intake-field select:disabled,
        .rapid-pricing-fieldset:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .rapid-intake-event-summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 3px 8px;
          padding: 10px 11px;
          border: 1px solid rgba(45, 212, 191, 0.12);
          border-radius: 11px;
          background: rgba(20, 184, 166, 0.035);
        }

        .rapid-intake-event-summary > span {
          grid-row: 1 / 3;
          align-self: center;
          padding: 4px 6px;
          border-radius: 6px;
          background: rgba(45, 212, 191, 0.1);
          color: #5eead4;
          font-size: 7px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .rapid-intake-event-summary strong {
          overflow: hidden;
          color: #e5e7eb;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rapid-intake-event-summary small {
          color: #71798b;
          font-size: 8px;
        }

        .rapid-pricing-fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .rapid-pricing-fieldset legend {
          margin-bottom: 7px;
        }

        .rapid-pricing-options {
          display: grid;
          gap: 7px;
        }

        .rapid-pricing-options button {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 3px 8px;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 11px;
          background: rgba(0, 0, 0, 0.12);
          color: #7b8496;
          text-align: left;
          cursor: pointer;
        }

        .rapid-pricing-options button > span {
          grid-row: 1 / 3;
          color: #596274;
        }

        .rapid-pricing-options strong {
          color: #cfd4de;
          font-size: 10px;
        }

        .rapid-pricing-options small {
          color: #697183;
          font-size: 8px;
          line-height: 1.4;
        }

        .rapid-pricing-options .rapid-pricing-selected {
          border-color: rgba(45, 212, 191, 0.36);
          background: rgba(20, 184, 166, 0.07);
        }

        .rapid-pricing-options .rapid-pricing-selected > span,
        .rapid-pricing-options .rapid-pricing-selected strong {
          color: #99f6e4;
        }

        .rapid-price-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .rapid-input-suffix {
          position: relative;
        }

        .rapid-input-suffix input {
          padding-right: 48px;
        }

        .rapid-input-suffix > span {
          position: absolute;
          top: 50%;
          right: 10px;
          max-width: 42px;
          overflow: hidden;
          color: #697183;
          font-size: 8px;
          text-overflow: ellipsis;
          transform: translateY(-50%);
        }

        .rapid-intake-off-copy {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(148, 163, 184, 0.08);
        }

        @media (max-width: 420px) {
          .rapid-intake-panel {
            padding: 18px;
          }

          .rapid-intake-heading {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .rapid-intake-switch {
            grid-column: 1 / -1;
            width: 100%;
          }

          .rapid-price-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
