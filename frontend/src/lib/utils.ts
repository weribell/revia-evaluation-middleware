import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only recognises the stock font-size scale (text-xs, text-sm, ...).
 * Our own --text-* tokens look like colours to it, so `cn("text-caps", "text-label")`
 * would treat both as text-colour, call them a conflict and silently drop the size.
 * Registering them here keeps size and colour independent.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["caps", "caps-sm", "metric", "panel-title", "banner-title", "banner-title-lg"],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
