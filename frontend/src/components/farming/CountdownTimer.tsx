"use client";

import React, { useState, useEffect } from "react";

export interface CountdownTimerProps {
  targetTimestamp: bigint; // Unix timestamp in seconds
  onComplete?: () => void;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

export function CountdownTimer({
  targetTimestamp,
  onComplete,
  showLabels = true,
  size = "md",
  compact = false,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      const target = Number(targetTimestamp);
      const remaining = Math.max(0, target - now);

      setTimeRemaining(remaining);

      if (remaining === 0 && onComplete) {
        onComplete();
      }
    };

    // Initial calculation
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp, onComplete]);

  // Calculate time units
  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  const isExpired = timeRemaining === 0;

  // Size configurations
  const sizeConfig = {
    sm: {
      container: "gap-1",
      number: "text-lg sm:text-xl",
      label: "text-xs",
      separator: "text-sm",
    },
    md: {
      container: "gap-2",
      number: "text-2xl sm:text-3xl",
      label: "text-xs sm:text-sm",
      separator: "text-lg",
    },
    lg: {
      container: "gap-3",
      number: "text-3xl sm:text-4xl",
      label: "text-sm sm:text-base",
      separator: "text-xl",
    },
  };

  const config = sizeConfig[size];

  if (isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
        <span className="text-lg sm:text-xl">✅</span>
        <span className="text-sm sm:text-base font-semibold text-green-400">
          Unlocked
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-gray-800/50 rounded-lg border border-purple-500/20">
        <span className="text-xs sm:text-sm font-mono text-white">
          {days > 0 && `${days}d `}
          {hours.toString().padStart(2, "0")}:
          {minutes.toString().padStart(2, "0")}:
          {seconds.toString().padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${config.container}`}>
      {/* Days */}
      {days > 0 && (
        <>
          <div className="flex flex-col items-center bg-gray-800/50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border border-purple-500/20">
            <span className={`${config.number} font-bold text-white font-mono`}>
              {days}
            </span>
            {showLabels && (
              <span className={`${config.label} text-gray-400`}>
                {days === 1 ? "Day" : "Days"}
              </span>
            )}
          </div>
          <span className={`${config.separator} text-gray-600 font-bold`}>
            :
          </span>
        </>
      )}

      {/* Hours */}
      <div className="flex flex-col items-center bg-gray-800/50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border border-purple-500/20">
        <span className={`${config.number} font-bold text-white font-mono`}>
          {hours.toString().padStart(2, "0")}
        </span>
        {showLabels && (
          <span className={`${config.label} text-gray-400`}>
            {hours === 1 ? "Hour" : "Hours"}
          </span>
        )}
      </div>

      <span className={`${config.separator} text-gray-600 font-bold`}>:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center bg-gray-800/50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border border-purple-500/20">
        <span className={`${config.number} font-bold text-white font-mono`}>
          {minutes.toString().padStart(2, "0")}
        </span>
        {showLabels && (
          <span className={`${config.label} text-gray-400`}>
            {minutes === 1 ? "Min" : "Mins"}
          </span>
        )}
      </div>

      <span className={`${config.separator} text-gray-600 font-bold`}>:</span>

      {/* Seconds */}
      <div className="flex flex-col items-center bg-gray-800/50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border border-purple-500/20">
        <span
          className={`${config.number} font-bold text-purple-400 font-mono`}
        >
          {seconds.toString().padStart(2, "0")}
        </span>
        {showLabels && (
          <span className={`${config.label} text-gray-400`}>
            {seconds === 1 ? "Sec" : "Secs"}
          </span>
        )}
      </div>
    </div>
  );
}
