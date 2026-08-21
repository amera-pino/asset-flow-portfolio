import { LogOut, Settings, ShieldCheck, UserCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

function getRoleLabel(role: "user" | "admin") {
  return role === "admin" ? "管理者" : "一般ユーザー";
}

export function UserMenu() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="relative z-[200]"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="ユーザーメニュー"
        className="inline-flex size-10 items-center justify-center rounded-full bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <UserCircle className="size-7" />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-10 z-[220] w-64 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-[0_20px_48px_rgba(15,23,42,0.18)]"
          role="menu"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="font-semibold text-slate-950">{getRoleLabel(user.role)}</p>
            <p className="mt-1 text-xs text-slate-500">{user.name}</p>
          </div>
          <button
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-600"
            disabled
            type="button"
          >
            <Settings className="size-4" />
            ユーザー設定
          </button>
          {user.role === "admin" ? (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-600">
              <ShieldCheck className="size-4 text-teal-700" />
              管理者権限
            </div>
          ) : null}
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-700 transition hover:bg-red-50"
            onClick={() => {
              void handleLogout();
            }}
            type="button"
          >
            <LogOut className="size-4" />
            ログアウト
          </button>
        </div>
      ) : null}
    </div>
  );
}
