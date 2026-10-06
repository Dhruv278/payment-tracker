"use client";

import { useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * Date and time in the viewer's own time zone. The server (UTC on Vercel)
 * renders the date only; the browser adds the local time after hydration.
 */
export function LocalDateTime({ value }: { value: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () =>
      new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    () => formatDate(value),
  );
  return <time dateTime={value}>{text}</time>;
}
