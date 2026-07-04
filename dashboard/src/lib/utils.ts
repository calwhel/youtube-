import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en").format(n);
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function youtubeStudioUrl(videoId: string): string {
  return `https://studio.youtube.com/video/${videoId}/edit`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://youtube.com/watch?v=${videoId}`;
}
