"use client";

import { useEffect, useState } from "react";

export function BetaBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner was previously dismissed
  useEffect(() => {
    const dismissed = localStorage?.getItem("betaBannerDismissed");
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage?.setItem("betaBannerDismissed", "true");
    setIsVisible(false);
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div
      className={`w-full bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 transition-all duration-300 ${isVisible ? "opacity-100" : "opacity-0 h-0 p-0 mb-0 overflow-hidden"}`}
      role="alert"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="font-bold mr-2">Beta Version</span>
          <span>
            This is a beta version. Timeouts may occur and swaps may get stuck.
            Test with small amounts first.
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-4 px-2 py-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
