import type { Metadata } from 'next';
import './globals.css';
import Navbar from './Navbar';

export const metadata: Metadata = {
  title: 'Zoom Clone',
  description: 'A video conferencing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}

