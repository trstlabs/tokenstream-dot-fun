import { PlusIcon } from "@heroicons/react/20/solid";
import { ComponentProps } from "react";

import { cn } from "@/utils/ui";

export function ConnectWalletButtonSmall({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "bg-[#16537e]/20 text-[#16537e] hover:bg-[#16537e]/30",
        "flex items-center gap-1 rounded-md px-2.5 py-1 pr-1 text-xs font-semibold transition-colors focus:outline-none",
        className,
      )}
      {...props}
    >
      <span>Connect Wallet</span>
      <PlusIcon className="h-4 w-4" />
    </button>
  );
}
