import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(pathname: string) {
  if (typeof window !== "undefined") return pathname;
  if (process.env.VERCEL_ENV)
    return `https://${process.env.VERCEL_ENV}${pathname}`;
  return `http://localhost:${process.env.PORT ?? 3000}${pathname}`;
}
