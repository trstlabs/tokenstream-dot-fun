"use client";

import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { CloseIcon } from "./CloseIcon";

type BetaBannerProps = {
  theme?: "dark" | "light";
};

export function BetaBanner({ theme = "light" }: BetaBannerProps) {
  const hideBannerTitle =
    typeof window !== "undefined" ? localStorage.getItem("hideBanner") : null;
  const hideBannerFromLocalStorage =
    hideBannerTitle === process.env.NEXT_PUBLIC_BANNER_TITLE;

  const [isDesktop, setIsDesktop] = useState(false);
  const [bannerRoot, setBannerRoot] = useState<HTMLElement | null>(null);
  const [hideBanner, setHideBanner] = useState(
    hideBannerFromLocalStorage ?? false
  );

  const handleHideBanner = () => {
    setHideBanner(true);
    localStorage?.setItem(
      "hideBanner",
      process.env.NEXT_PUBLIC_BANNER_TITLE ?? ""
    );
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 900px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let el = document.getElementById("banner-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "banner-root";
      document.body.appendChild(el);
    }
    setBannerRoot(el);
  }, []);

  const bannerElement = !hideBanner ? (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <a
        href={process.env.NEXT_PUBLIC_BANNER_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex flex-col gap-[18px] rounded-[10px] p-[18px] shadow-lg ${theme === "light" ? "bg-white text-black" : "bg-black text-white"}`}
      >
        <strong
          className={`flex items-center justify-between font-sans text-[15px] font-medium ${theme === "light" ? "text-black" : "text-white"}`}
        >
          {process.env.NEXT_PUBLIC_BANNER_TITLE || "Beta Version"}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleHideBanner();
            }}
            className="ml-2"
            aria-label="Dismiss"
          >
            <CloseIcon color={theme === "light" ? "#00000073" : "#ffffff80"} />
          </button>
        </strong>
        <div
          className={`font-sans text-[13px] ${theme === "light" ? "text-[#00000073]" : "text-[#ffffff80]"}`}
        >
          {process.env.NEXT_PUBLIC_BANNER_MESSAGE ||
            "This is a beta version. Some features may not work as expected."}
        </div>
      </a>
    </div>
  ) : null;

  if (isDesktop && bannerRoot) {
    return ReactDOM.createPortal(bannerElement, bannerRoot);
  }

  return bannerElement;
}
