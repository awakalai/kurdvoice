import "./globals.css";

export const metadata = {
  title: "کورد ڤۆیس — Kurd Voice",
  description: "دەنگی کوردانی هەموو جیهان — لە یەک شوێن",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ckb" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
