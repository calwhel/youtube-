import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Clapperboard,
  Film,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  Target,
  X,
} from "lucide-react";

import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Overview", short: "Home" },
  { to: "/setup", icon: Link2, label: "Connect", short: "Setup" },
  { to: "/review", icon: ListChecks, label: "Review Queue", short: "Review" },
  { to: "/generate", icon: Clapperboard, label: "Generate", short: "Create" },
  { to: "/channels", icon: Film, label: "Channels", short: "Channels" },
  { to: "/monetization", icon: Target, label: "Monetization", short: "YPP" },
  { to: "/analytics", icon: BarChart3, label: "Analytics", short: "Stats" },
];

const mobileBottomLinks = links.filter(
  (link) => link.to !== "/setup" && link.to !== "/monetization",
);

function NavItems({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <>
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              isActive ? "nav-item-active" : "nav-item-inactive",
              className,
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  );
}

function DesktopSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-surface-border/60 bg-surface-raised/95 backdrop-blur-xl md:flex">
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

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <NavItems />
      </nav>

      <div className="border-t border-surface-border/60 p-4">
        <button
          onClick={() => void logout()}
          className="nav-item-inactive w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border/80 bg-surface-raised/95 backdrop-blur-xl md:hidden">
      <div className="flex items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {mobileBottomLinks.map(({ to, icon: Icon, short }) => {
          const active =
            to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-brand"
                  : "text-zinc-500 active:text-zinc-300",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand")} />
              <span className="truncate">{short}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { logout } = useAuth();

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-50 bg-black/70 md:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-surface-border bg-surface-raised md:hidden animate-slide-up">
        <div className="flex h-14 items-center justify-between border-b border-surface-border/60 px-4">
          <span className="font-display text-sm font-semibold">Menu</span>
          <button type="button" onClick={onClose} className="btn-ghost p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavItems onNavigate={onClose} />
        </nav>
        <div className="border-t border-surface-border/60 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => {
              void logout();
              onClose();
            }}
            className="nav-item-inactive w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-surface-border/60 bg-surface/90 px-4 backdrop-blur-xl md:hidden">
      <button type="button" onClick={onMenuOpen} className="btn-ghost -ml-2 p-2">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-brand" />
        <span className="font-display text-sm font-semibold">Pipeline Studio</span>
      </div>
      <div className="w-9" />
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen md:pl-64">
      <DesktopSidebar />
      <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MobileBottomNav />

      <main className="min-h-screen px-4 py-5 pb-24 md:p-8 md:pb-8">
        {children}
      </main>
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
    <div className="mb-6 flex flex-col gap-4 animate-fade-in md:mb-8 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
    <div className="glass glass-hover rounded-2xl p-4 shadow-card animate-slide-up md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold md:text-3xl">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border px-4 py-12 text-center md:py-16">
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

export function DatabaseSetupBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5">
      <h3 className="font-display font-semibold text-amber-100">
        Connect your database in Railway
      </h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-200/90">
        <li>
          Railway project → <strong>+ New</strong> → <strong>Database</strong> →{" "}
          <strong>PostgreSQL</strong>
        </li>
        <li>
          Click your <strong>app service</strong> (not Postgres) →{" "}
          <strong>Variables</strong>
        </li>
        <li>
          <strong>New Variable</strong> → <strong>Add Reference</strong> → pick
          Postgres → select <code className="rounded bg-black/20 px-1">DATABASE_URL</code>
        </li>
        <li>Wait for redeploy (~1 min), then refresh this page</li>
      </ol>
      <p className="mt-3 text-xs text-amber-200/70">
        Then open <strong>Connect</strong> (hamburger menu on mobile) to link YouTube — all in the browser, no terminal.
      </p>
    </div>
  );
}

export function isDatabaseError(message: string): boolean {
  return (
    message.includes("Missing database URL") ||
    message.includes("DATABASE_URL") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect")
  );
}
