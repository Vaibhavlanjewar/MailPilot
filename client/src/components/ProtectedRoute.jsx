import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui/LoadingSpinner';

export default function ProtectedRoute() {
  const { ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <PageLoader />;
  }

  if (!getAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
