import Link from "next/link";
import { redirect } from "next/navigation";

import VallectiveMark from "@/components/brand/VallectiveMark";
import { createClient } from "@/lib/supabase/server";

import styles from "./welcome.module.css";

const onboardingSteps = [
  {
    step: "01",
    title: "Create your collection",
    description:
      "Start with a personal collection or dealer inventory, so every card has the right home from day one.",
    href: "/",
    link: "Open dashboard",
  },
  {
    step: "02",
    title: "Scan your first card",
    description:
      "Use your camera to capture the card quickly and move straight on to the next one.",
    href: "/scanner",
    link: "Start scanner",
  },
  {
    step: "03",
    title: "Track the value",
    description:
      "Bring your collection, transactions, grading, and market data into one workflow.",
    href: "/cards",
    link: "Open card library",
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
      : user.email?.split("@")[0] ?? "collector";

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <VallectiveMark className={styles.mark} />
        <p className={styles.eyebrow}>WELCOME TO VALLECTIVE</p>
        <h1 className={styles.title}>Great to have you here, {displayName}.</h1>
        <p className={styles.intro}>
          Your account is ready. In just a few minutes, you can create your
          first collection, scan a card, and start following its complete
          journey.
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
          Enter Vallective
        </Link>
      </section>
    </main>
  );
}
