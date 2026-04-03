import { Navigate, Outlet } from 'react-router-dom';
import { getAuthToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui/LoadingSpinner';

export default function ProtectedRoute() {
  const { ready } = useAuth();

  if (!ready) {
    return <PageLoader />;
  }

  if (!getAuthToken()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
