import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import styles from "./welcome.module.css";

const onboardingSteps = [
  {
    step: "01",
    title: "Opret din samling",
    description:
      "Start med PC eller inventory, så hvert kort får det rigtige hjem fra begyndelsen.",
    href: "/",
    link: "Åbn dashboard",
  },
  {
    step: "02",
    title: "Scan dit første kort",
    description:
      "Brug kameraet til hurtigt at registrere kortet og fortsæt direkte til det næste.",
    href: "/scanner",
    link: "Start scanner",
  },
  {
    step: "03",
    title: "Følg værdien",
    description:
      "Se samling, handler, grading og markedsdata samlet i én arbejdsgang.",
    href: "/cards",
    link: "Se kortbibliotek",
  },
] as const;

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/welcome");
  }

  const metadataName = user.user_metadata?.display_name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split("@")[0] ?? "samler";

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <p className={styles.eyebrow}>VELKOMMEN TIL NECARDPILOT</p>
        <h1 className={styles.title}>Godt at have dig med, {displayName}.</h1>
        <p className={styles.intro}>
          Din konto er klar. På få minutter kan du oprette din første samling,
          scanne et kort og begynde at følge hele kortets rejse.
        </p>

        <div className={styles.grid}>
          {onboardingSteps.map((item) => (
            <article className={styles.card} key={item.step}>
              <span className={styles.step}>{item.step}</span>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className={styles.cardText}>{item.description}</p>
              <Link className={styles.link} href={item.href}>
                {item.link} →
              </Link>
            </article>
          ))}
        </div>

        <Link className={styles.primaryLink} href="/">
          Gå til NECardPilot
        </Link>
      </section>
    </main>
  );
}
