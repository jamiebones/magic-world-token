"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CustomConnectButton } from "@/components/ConnectButton";
import { useMultiRoleGate } from "@/hooks/useRoleGate";

export function Navbar() {
  const pathname = usePathname();
  const { hasAnyAdminRole, isConnected } = useMultiRoleGate();

  const isActive = (path: string) => {
    // Home page - exact match only
    if (path === "/") {
      return pathname === "/";
    }

    // Admin dashboard - exact match only (not its sub-routes)
    if (path === "/admin") {
      return pathname === "/admin";
    }

    // For all other paths - exact match or starts with path + "/"
    return pathname === path || pathname.startsWith(path + "/");
  };

  const navLinks = [
    { href: "/", label: "Home", showAlways: true },
    { href: "/admin", label: "Admin Dashboard", requiresAdmin: true },
    {
      href: "/admin/game/distribute",
      label: "Distribute Rewards",
      requiresAdmin: true,
    },
    { href: "/admin/game/config", label: "Game Config", requiresAdmin: true },
    {
      href: "/admin/partners/allocate",
      label: "Partner Allocations",
      requiresAdmin: true,
    },
    {
      href: "/admin/emergency",
      label: "Emergency Controls",
      requiresAdmin: true,
    },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-purple-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">
                Magic World
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                // Show link if it's always visible or if user is connected with admin role
                const shouldShow =
                  link.showAlways || (isConnected && hasAnyAdminRole);

                if (!shouldShow) return null;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-300 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Connect Button */}
          <div className="flex items-center">
            <CustomConnectButton />
          </div>
        </div>

        {/* Mobile Navigation */}
        {isConnected && hasAnyAdminRole && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => {
                const shouldShow =
                  link.showAlways || (isConnected && hasAnyAdminRole);

                if (!shouldShow) return null;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-300 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
