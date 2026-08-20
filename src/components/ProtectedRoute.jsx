import { Navigate, useLocation } from 'react-router-dom';
import useQuizStore from '../store/useQuizStore';

/**
 * Restricts a route to authenticated users, redirecting to /login
 * while preserving the intended destination.
 */
export default function ProtectedRoute({ children }) {
  const user = useQuizStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}