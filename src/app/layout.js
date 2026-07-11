import "./globals.css";

export const metadata = {
  title: "Súper Compras PWA",
  description:
    "Calculadora inteligente de compras con dictado por voz, tasa BCV y recordatorios. 100% offline, hecha para Venezuela.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Súper Compras",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport = {
  themeColor: "#002b49",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full bg-mesh safe-top">{children}</body>
    </html>
  );
}
