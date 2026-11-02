import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { isConfigured } from './lib/supabase';
import TabBar from './components/TabBar';
import RequireAuth from './components/RequireAuth';
import MapPage from './pages/MapPage';
import PlacePage from './pages/PlacePage';
import ReviewPage from './pages/ReviewPage';
import AddPlacePage from './pages/AddPlacePage';
import TopPage from './pages/TopPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';

export default function App() {
  if (!isConfigured) return <SetupPage />;
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const hideTabs = pathname === '/login' || pathname === '/add' || pathname.endsWith('/review');
  return (
    <div className="shell">
      <main className="shell-main">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/place/:id" element={<PlacePage />} />
          <Route
            path="/place/:id/review"
            element={
              <RequireAuth>
                <ReviewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/add"
            element={
              <RequireAuth>
                <AddPlacePage />
              </RequireAuth>
            }
          />
          <Route path="/top" element={<TopPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<MapPage />} />
        </Routes>
      </main>
      {!hideTabs && <TabBar />}
    </div>
  );
}
