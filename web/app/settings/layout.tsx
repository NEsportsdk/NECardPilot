import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Administrér din Vallective-profil og kontosikkerhed.",
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
