import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { PortalLayout } from './components/PortalLayout';
import { Spinner } from './components/ui';
import { Account } from './pages/Account';
import { BookingDetail } from './pages/BookingDetail';
import { Bookings } from './pages/Bookings';
import { Communications } from './pages/Communications';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { LinkRequests } from './pages/LinkRequests';
import { Register } from './pages/Register';
import { ResetPassword } from './pages/ResetPassword';
import { SignIn } from './pages/SignIn';

function RequireAuth({ children, agencyOnly = false }: { children: ReactNode; agencyOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (agencyOnly && user.role !== 'agency_admin') return <Navigate to="/portal" replace />;

  return <>{children}</>;
}

function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to="/portal" replace />;

  return <>{children}</>;
}

/** Clients land on their dashboard; Genesis staff land on the access queue. */
function PortalHome() {
  const { user } = useAuth();
  return user?.role === 'agency_admin' ? <Navigate to="/agency/link-requests" replace /> : <Dashboard />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/sign-in"
            element={
              <RedirectIfSignedIn>
                <SignIn />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfSignedIn>
                <Register />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RedirectIfSignedIn>
                <ResetPassword />
              </RedirectIfSignedIn>
            }
          />

          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route path="/portal" element={<PortalHome />} />
            <Route path="/portal/bookings" element={<Bookings />} />
            <Route path="/portal/bookings/:id" element={<BookingDetail />} />
            <Route path="/portal/communications" element={<Communications />} />
            <Route path="/portal/invoices" element={<Invoices />} />
            <Route path="/portal/account" element={<Account />} />
            <Route
              path="/agency/link-requests"
              element={
                <RequireAuth agencyOnly>
                  <LinkRequests />
                </RequireAuth>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
