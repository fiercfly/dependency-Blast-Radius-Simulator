import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dependency Blast Radius Simulator | Resiliency Engineering",
  description:
    "Interactive distributed system service registry, dependency graph modeler, failure cascade simulator, and circular dependency detector.",
  keywords: ["distributed systems", "resiliency", "chaos engineering", "blast radius", "service mesh", "dependency mapping"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
