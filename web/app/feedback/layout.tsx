import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta feedback",
  description: "Help shape the next version of Vallective.",
};

export default function FeedbackLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
