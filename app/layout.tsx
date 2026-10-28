import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ledger — Financial overview',
  description: 'A financial analytics dashboard using clearly labeled fictional demo data.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
