import './globals.css'
import '../landingpage/globals.css'
import { Inter } from 'next/font/google'
import PageTransition from '../components/PageTransition/PageTransition'
import { AuthProvider } from '../contexts/AuthContext'
import { NotificationProvider } from '../components/ui/NotificationSystem'
import GlobalOnboardingManager from '../components/onboarding/GlobalOnboardingManager'
import DevIndicator from '../components/DevIndicator'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'QueryFuel - AI-Powered Content Creation',
  description: 'Transform your expertise into professional blog articles with AI. From interview to published content in minutes, powered by GPT-4, DALL-E, and advanced AI tools.',
  icons: {
    icon: '/client/favicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Bootstrap CSS */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
          crossOrigin="anonymous"
        />
        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <NotificationProvider maxNotifications={5}>
            <GlobalOnboardingManager />
            <DevIndicator />
            <PageTransition>
              {children}
            </PageTransition>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}