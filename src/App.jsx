/**
 * App.jsx — Router Principal do PALCO
 * 
 * Estrutura de rotas:
 * - /           → HomePage (pública)
 * - /login      → LoginPage (pública, redirect se autenticado)
 * - /register   → RegisterPage (pública, redirect se autenticado)
 * - /artist     → ArtistDashboardPage (protegida, role: artist)
 * - /tv         → TVModePage (protegida, role: venue)
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Spinner from './components/ui/Spinner';

// Pages
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ArtistDashboardPage = lazy(() => import('./pages/ArtistDashboardPage'));
const TVModePage = lazy(() => import('./pages/TVModePage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));
const PublicInteractionPage = lazy(() => import('./pages/PublicInteractionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const WalletReturnPage = lazy(() => import('./pages/WalletReturnPage'));
const AdminCuratorPage = lazy(() => import('./pages/AdminCuratorPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
import OnboardingModal from './components/features/auth/OnboardingModal';

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-palco-black">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          {/* Rotas com AppShell (header + layout) */}
          <Route
            path="/"
            element={
              <AppShell>
                <HomePage />
              </AppShell>
            }
          />
          <Route
            path="/rooms"
            element={
              <AppShell>
                <RoomsPage />
              </AppShell>
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RoomPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="/interact/:roomId" element={<PublicInteractionPage />} />
          <Route
            path="/wallet/return"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WalletReturnPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProfilePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/artist"
            element={
              <ProtectedRoute roles={['artist']}>
                <AppShell>
                  <ArtistDashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Rotas de Auth (sem AppShell — layout próprio) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AdminCuratorPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute>
                <AppShell>
                  <MarketplacePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Modo TV (sem AppShell — fullscreen) */}
          <Route
            path="/tv"
            element={
              <ProtectedRoute roles={['venue']}>
                <TVModePage />
              </ProtectedRoute>
            }
          />

          {/* 404 fallback */}
          <Route
            path="*"
            element={
              <AppShell>
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <h1 className="font-display font-bold text-6xl text-palco-gold mb-4">
                    404
                  </h1>
                  <p className="text-palco-text-muted text-lg mb-6">
                    Essa página não existe.
                  </p>
                  <a
                    href="/"
                    className="px-6 py-3 bg-palco-gold text-palco-black font-bold rounded-xl hover:bg-palco-gold-light transition-colors"
                  >
                    Voltar ao início
                  </a>
                </div>
              </AppShell>
            }
          />
          </Routes>
        </Suspense>
        <OnboardingModal />
      </AuthProvider>
    </BrowserRouter>
  );
}
