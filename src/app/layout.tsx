import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Desktop Pet',
  description: 'A little creature living on your desktop.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
