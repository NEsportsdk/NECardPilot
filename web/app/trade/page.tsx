import type { Metadata } from "next";
import Link from "next/link";

import AppSidebar from "@/components/app/AppSidebar";
import { defaultTradeTerms } from "@/lib/trade/tradeDesk";
import { loadTradeDesk } from "@/lib/trade/tradeDesk.server";

import styles from "./trade.module.css";

export const metadata: Metadata = {
  title: "Trade Desk",
  description: "Vallectives interne arbejdsområde for handel og lagerdrift.",
};

function formatDkk(value: number) {
  return new Intl.NumberFormat("da-DK", {
    currency: "DKK",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
function formatPercent(value: number) {
  return new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

export default async function TradeDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const { invitation, member, metrics, viewerRole } = await loadTradeDesk();
  const operator = member ?? invitation;
  const memberName = operator?.display_name ?? "Noah";
  const workspaceName = operator?.workspace_name ?? "Vallective Business";
  const isMemberView =
    viewerRole === "junior_trade_manager" || viewerRole === "trade_manager";
  const hourlyRate = Number(
    operator?.hourly_rate ?? defaultTradeTerms.hourlyRate
  );
  const weeklyHours = Number(
    operator?.weekly_hours_target ?? defaultTradeTerms.weeklyHoursTarget
  );
  const existingCommissionRate = Number(
    operator?.existing_inventory_commission_rate ??
      defaultTradeTerms.existingInventoryCommissionRate
  );
  const sourcedCommissionRate = Number(
    operator?.sourced_profit_commission_rate ??
      defaultTradeTerms.sourcedProfitCommissionRate
  );

  return (
    <div className={styles.shell}>
      <AppSidebar variant="fixed" />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Internt teamområde</p>
            <div className={styles.titleRow}>
              <h1>{memberName}s Trade Desk</h1>
              <span className={styles.roleBadge}>Junior Trade Manager</span>
            </div>
            <p className={styles.intro}>
              Ét sted til lager, salgsfremdrift, indkøb og provision — bygget
              til den daglige Vallective-drift.
            </p>
          </div>

          <Link className={styles.backLink} href="/">
            ← Til hoveddashboard
          </Link>
        </header>

        {!member ? (
          <section className={styles.setupNotice}>
            <span className={styles.setupIcon} aria-hidden="true">
              01
            </span>
            <div>
              <p className={styles.eyebrow}>Klar til næste trin</p>
              <h2>Dashboardet er bygget — Noah mangler kun at blive koblet på</h2>
              <p>
                Vallectives nuværende lager er fundet. Når Noahs konto knyttes
                til teamet, kan den første arbejdsbunke fordeles uden at ændre
                ejerskabet af samlingen. De 50 kort er en startmission — der er
                ingen grænse for, hvor mange kort han kan håndtere bagefter.
              </p>
            </div>
            <div className={styles.inviteActions}>
              <span className={styles.sentPill}>Klar — ikke sendt</span>
              {invite === "failed" ? (
                <p role="alert">
                  Invitationen kunne ikke sendes. Prøv igen om et øjeblik.
                </p>
              ) : null}
              <span className={styles.statusPill}>Afventer konto</span>
            </div>
          </section>
        ) : null}

        <section className={styles.metricGrid} aria-label="Nøgletal">
          <article className={styles.metricCard}>
            <p>Første mission</p>
            <strong>
              {metrics.listedCardCount}
              <span> / {metrics.firstMissionTarget}</span>
            </strong>
            <small>Kort listet eller solgt</small>
          </article>

          <article className={styles.metricCard}>
            <p>Samlet lager</p>
            <strong>{metrics.inventoryCardCount}</strong>
            <small>{formatDkk(metrics.inventoryValue)} i estimeret værdi</small>
          </article>

          <article className={styles.metricCard}>
            <p>Salg denne måned</p>
            <strong>{formatDkk(metrics.monthlyRevenue)}</strong>
            <small>På kort tildelt {memberName}</small>
          </article>

          <article className={`${styles.metricCard} ${styles.accentMetric}`}>
            <p>Optjent provision</p>
            <strong>{formatDkk(metrics.totalCommission)}</strong>
            <small>Denne måned</small>
          </article>
        </section>

        <div className={styles.dashboardGrid}>
          <section className={`${styles.panel} ${styles.missionPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Mission 01</p>
                <h2>Fra bunke til salgsklar</h2>
              </div>
              <span>{metrics.firstMissionProgress}%</span>
            </div>

            <div
              aria-label={`${metrics.firstMissionProgress} procent gennemført`}
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={metrics.firstMissionProgress}
            >
              <span style={{ width: `${metrics.firstMissionProgress}%` }} />
            </div>

            <div className={styles.stageGrid}>
              <div>
                <span>01</span>
                <strong>{metrics.assignedCardCount}</strong>
                <p>Tildelt</p>
              </div>
              <div>
                <span>02</span>
                <strong>{metrics.valuedCardCount}</strong>
                <p>Værdisat</p>
              </div>
              <div>
                <span>03</span>
                <strong>{metrics.listedCardCount}</strong>
                <p>Listet / solgt</p>
              </div>
            </div>

            <div className={styles.missionFooter}>
              <p>
                <strong>{metrics.availableToAssignCount} kort</strong> i det
                eksisterende lager kan vælges til den første arbejdsbunke.
                Derefter fortsætter arbejdet uden kortloft.
              </p>
              <Link href="/cards">Åbn kortbibliotek →</Link>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.compensationPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Din aftale</p>
                <h2>Timer & provision</h2>
              </div>
              <span className={styles.livePill}>
                {member ? "Aktiv" : "Klar"}
              </span>
            </div>

            <dl className={styles.termList}>
              <div>
                <dt>Timeløn</dt>
                <dd>{formatDkk(hourlyRate)} / time</dd>
              </div>
              <div>
                <dt>Ugentligt mål</dt>
                <dd>ca. {weeklyHours} timer</dd>
              </div>
              <div>
                <dt>Eksisterende lager</dt>
                <dd>{formatPercent(existingCommissionRate)} af omsætning</dd>
              </div>
              <div>
                <dt>Egne fund</dt>
                <dd>{formatPercent(sourcedCommissionRate)} af fortjeneste</dd>
              </div>
            </dl>

            <div className={styles.commissionSplit}>
              <div>
                <p>Eksisterende lager</p>
                <strong>{formatDkk(metrics.existingInventoryCommission)}</strong>
              </div>
              <div>
                <p>Egne fund</p>
                <strong>{formatDkk(metrics.sourcedProfitCommission)}</strong>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.focusPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Denne uges fokus</p>
                <h2>Arbejdsgangen</h2>
              </div>
            </div>

            <ol className={styles.focusList}>
              <li>
                <span>1</span>
                <div>
                  <strong>Registrér den første bunke</strong>
                  <p>Scan, identificér og kvalitetssikr kortene.</p>
                </div>
                <Link href="/scanner">Scan →</Link>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Vælg salgsprioritet</strong>
                  <p>Start med kort i intervallet 20–500 kr.</p>
                </div>
                <Link href="/cards">Se kort →</Link>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Følg salg og avance</strong>
                  <p>Registrér handler, så provisionen bliver dokumenteret.</p>
                </div>
                <Link href="/transactions">Handler →</Link>
              </li>
            </ol>
          </section>

          <section className={`${styles.panel} ${styles.budgetPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Indkøbsramme</p>
                <h2>Månedens budget</h2>
              </div>
              <strong>{formatDkk(metrics.monthlyPurchaseBudgetRemaining)}</strong>
            </div>

            <p className={styles.budgetLead}>Tilbage af den aftalte ramme</p>
            <div className={styles.budgetBar}>
              <span
                style={{
                  width: `${Math.min(
                    100,
                    metrics.monthlyPurchaseBudget === 0
                      ? 0
                      : (metrics.monthlyPurchaseBudgetUsed /
                          metrics.monthlyPurchaseBudget) *
                          100
                  )}%`,
                }}
              />
            </div>
            <div className={styles.budgetMeta}>
              <span>Brugt {formatDkk(metrics.monthlyPurchaseBudgetUsed)}</span>
              <span>Ramme {formatDkk(metrics.monthlyPurchaseBudget)}</span>
            </div>

            <div className={styles.guardrail}>
              <span aria-hidden="true">✓</span>
              <p>
                Hvert køb reserveres atomisk i databasen. Systemet afviser
                automatisk beløb over månedsrammen og fører et revisionsspor.
              </p>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.accessPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Arbejdsrum & ansvar</p>
                <h2>Stor frihed — tydeligt adskilte data</h2>
              </div>
              <span className={styles.accessBadge}>Ingen kortgrænse</span>
            </div>

            <div className={styles.workspaceGrid}>
              <article>
                <div className={styles.workspaceHeading}>
                  <span aria-hidden="true">V</span>
                  <div>
                    <p>Virksomhed</p>
                    <h3>{workspaceName}</h3>
                  </div>
                </div>
                <ul className={styles.permissionList}>
                  {operator?.can_manage_inventory ? (
                    <li>Registrere og redigere hele virksomhedens lager</li>
                  ) : null}
                  {operator?.can_manage_sales ? (
                    <li>Værdisætte, klargøre og styre salg</li>
                  ) : null}
                  {operator?.can_manage_grading &&
                  operator.can_manage_cardshows ? (
                    <li>Arbejde med grading og cardshows</li>
                  ) : null}
                  {operator?.can_manage_purchases_within_budget ? (
                    <li>Foretage indkøb inden for månedsbudgettet</li>
                  ) : null}
                </ul>
              </article>

              <article>
                <div className={styles.workspaceHeading}>
                  <span aria-hidden="true">N</span>
                  <div>
                    <p>Personligt</p>
                    <h3>{memberName}s PC</h3>
                  </div>
                </div>
                <ul className={styles.permissionList}>
                  <li>Privat samling med eget ejerskab</li>
                  <li>Egne collections, scanninger og værdisætninger</li>
                  <li>Adskilt fra virksomhedens lager og regnskab</li>
                  <li>Fuld kontrol og ingen kortgrænse</li>
                </ul>
              </article>
            </div>

            <div className={styles.ownerGuardrails}>
              <strong>Forbliver hos dig:</strong>
              {!operator?.can_manage_team ? (
                <span>Teamadministration</span>
              ) : null}
              {!operator?.can_approve_over_budget_purchases ? (
                <span>Indkøb over den aftalte budgetramme</span>
              ) : null}
              {!operator?.can_delete_inventory ? (
                <span>Irreversible sletninger</span>
              ) : null}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.storefrontPanel}`}>
            <div>
              <p className={styles.eyebrow}>Ny salgsvej</p>
              <h2>Fra virksomhedslager til Vallective Shop</h2>
              <p>
                Klargør titel, stand og pris i en intern kø. Den offentlige butik
                viser kun produkter, der efterfølgende er udgivet i Shopify.
              </p>
            </div>
            <div className={styles.storefrontActions}>
              <span>Shopify forbundet · DKK aktiv</span>
              <Link href="/trade/storefront">Åbn storefront pipeline →</Link>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <p>
            {isMemberView
              ? "Du ser kun det interne Vallective-handelsområde, du er inviteret til."
              : "Ejer-visning: lageret forbliver på din konto, mens Noah får afgrænset teamadgang."}
          </p>
        </footer>
      </main>
    </div>
  );
}
