import React, { ReactNode } from "react";
import { cn } from "../lib/utils";

type Props = {
  className?: string;
  children: ReactNode;
};

export default function MaxWidthWrapper({ children, className }: Props) {
  return (
    <div
      className={cn(
        "mx-auto max-w-screen-xl w-full px-2.5 md:px-10",
        className
      )}
    >
      {children}
    </div>
  );
}
