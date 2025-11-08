"use client";

import React from "react";

export interface EmergencyBannerProps {
  isActive: boolean;
  message?: string;
  severity?: "warning" | "error" | "info";
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function EmergencyBanner({
  isActive,
  message = "⚠️ Emergency mode is active. Normal operations may be affected.",
  severity = "warning",
  showIcon = true,
  dismissible = false,
  onDismiss,
}: EmergencyBannerProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (!isActive || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Severity configurations
  const severityConfig = {
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/50",
      text: "text-yellow-400",
      icon: "⚠️",
      pulse: true,
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/50",
      text: "text-red-400",
      icon: "🚨",
      pulse: true,
    },
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/50",
      text: "text-blue-400",
      icon: "ℹ️",
      pulse: false,
    },
  };

  const config = severityConfig[severity];

  return (
    <div
      className={`
        sticky top-0 z-50 w-full
        ${config.bg} ${config.border} border-2
        ${config.pulse ? "animate-pulse" : ""}
      `}
    >
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Icon and Message */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            {showIcon && (
              <span className="text-2xl sm:text-3xl flex-shrink-0">
                {config.icon}
              </span>
            )}
            <div className="flex-1">
              <p
                className={`${config.text} font-semibold text-sm sm:text-base leading-tight`}
              >
                {message}
              </p>
            </div>
          </div>

          {/* Dismiss Button */}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={`
                ${config.text} hover:opacity-70 transition-opacity
                text-xl sm:text-2xl flex-shrink-0 p-1
              `}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Additional Details (optional) */}
        {severity === "error" && (
          <div className="mt-2 sm:mt-3 pl-8 sm:pl-11">
            <p className="text-xs sm:text-sm text-gray-300">
              Emergency withdrawals are enabled. Please exercise caution.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
