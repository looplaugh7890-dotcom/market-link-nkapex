import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';

// Role-based access control: only listed roles may see the nested routes.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-message">Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
