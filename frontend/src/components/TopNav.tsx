"use client";

import { CustomConnectButton } from "@/components/ConnectButton";

export function TopNav() {
  return (
    <nav className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-purple-500/20">
      <div className="flex items-center justify-end px-6 py-3">
        <CustomConnectButton />
      </div>
    </nav>
  );
}
