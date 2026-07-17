import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Conditionally merge Tailwind classes using the shadcn/ui pattern. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
