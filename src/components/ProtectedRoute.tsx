import { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const token = getToken();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

