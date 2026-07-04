import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Clapperboard,
  DollarSign,
  Film,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Target,
} from "lucide-react";

import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/review", icon: ListChecks, label: "Review Queue" },
  { to: "/generate", icon: Clapperboard, label: "Generate" },
  { to: "/channels", icon: Film, label: "Channels" },
  { to: "/monetization", icon: Target, label: "Monetization" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-surface-border/60 bg-surface-raised/95 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 border-b border-surface-border/60 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/25">
          <Film className="h-5 w-5 text-brand" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold">Pipeline Studio</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            YouTube Automation
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(isActive ? "nav-item-active" : "nav-item-inactive")
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border/60 p-4">
        <button onClick={logout} className="nav-item-inactive w-full">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pl-64">
      <Sidebar />
      <main className="min-h-screen p-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "brand" | "accent" | "emerald" | "amber";
}) {
  const accents = {
    brand: "bg-brand/10 text-brand ring-brand/20",
    accent: "bg-accent/10 text-accent-muted ring-accent/20",
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  };

  return (
    <div className="glass glass-hover rounded-2xl p-5 shadow-card animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
            accents[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-overlay">
        <Icon className="h-7 w-7 text-zinc-500" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-surface-border border-t-brand" />
      {label && <p className="mt-4 text-sm text-zinc-500">{label}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
      {message}
    </div>
  );
}
