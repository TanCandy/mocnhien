import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { getRoleFromToken, getToken } from "../lib/auth";

export default function AdminRoute({ children }: { children: ReactElement }) {
  const token = getToken();
  const role = getRoleFromToken(token);
  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return children;
}

