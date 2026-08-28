import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Run the guided Vallective private beta journey.",
  title: "Beta pilot",
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
