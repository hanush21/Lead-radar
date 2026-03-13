"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, Users, Mail, BarChart3, LogOut } from "lucide-react";

const navItems = [
  { href: "/search", label: "Dashboard", icon: BarChart3 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campañas", icon: Mail },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function handleSignOut() {
    const callbackUrl =
      typeof window !== "undefined"
        ? new URL("/login", window.location.origin).toString()
        : "/login";

    void signOut({ callbackUrl });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <aside className="w-64 border-r border-border/20 bg-background/50 backdrop-blur-sm flex flex-col">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border/20">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <span className="text-sm text-primary-foreground font-bold">⬡</span>
          </div>
          <span className="text-lg font-semibold text-foreground">LeadRadar</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/20 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-to-br from-background/50 via-background to-background/50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
