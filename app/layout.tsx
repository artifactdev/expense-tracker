import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/toaster';

import './globals.css';
import 'filepond/dist/filepond.min.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

const riftonFont = localFont({
  src: '../public/fonts/rifton/rifton-regular.otf',
  display: 'swap',
  variable: '--font-rifton',
});

export const metadata: Metadata = {
  title: 'Expense Tracker - Simplify Your Financial Management',
  description:
    'Expense Tracker is an intuitive app designed to help you manage your finances effortlessly. Keep track of your incomes, expenses, and subscriptions, analyze your financial habits, and make informed decisions. Featuring a user-friendly dashboard, transaction filtering, bulk CSV uploads, and subscription management.',
  keywords: [
    'expense tracker',
    'financial management',
    'budgeting',
    'income tracking',
    'expense tracking',
    'subscription management',
  ],
  authors: [{ name: 'Pablo Avilés Prieto', url: 'https://www.pabloaviles.dev' }],
  applicationName: 'Expense Tracker',
  icons: [{ rel: 'icon', url: '/images/favicon.ico' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${inter.className} ${riftonFont.variable} ${inter.variable}`}>
        <Providers>
          <Toaster />
          {children}
        </Providers>
      </body>
    </html>
  );
}
