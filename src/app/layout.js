import "./globals.css";

export const metadata = {
  title: "Socity — Society Management SaaS",
  description: "Multi-tenant society management with role-based access control.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
