import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { AssetListPage } from "./pages/AssetListPage";
import { AssetLoanRequestPage } from "./pages/AssetLoanRequestPage";
import { LoginPage } from "./pages/LoginPage";
import { MyLoanRequestPage } from "./pages/MyLoanRequestPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import "./index.css";

// URL ごとの画面コンポーネントを定義する React 側の入口
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<ProtectedRoute />}>
            <Route element={<AssetListPage />} path="/" />
            <Route element={<MyLoanRequestPage />} path="/my-requests" />
            <Route element={<AssetLoanRequestPage />} path="/requests/:assetId" />
            <Route element={<AdminPage />} path="/admin" />
          </Route>
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
