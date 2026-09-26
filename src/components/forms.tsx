"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { buttonStyles, cn } from "@/components/ui";
import type { ActionState } from "@/lib/types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

const noopSubscribe = () => () => {};

/** False during SSR and before hydration, so forms can't be submitted natively (as a GET) before React takes over. */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Form wired to a server action with inline error/success feedback.
 * Submits via onSubmit instead of the `action` prop so React doesn't clear
 * the fields when the server returns an error — users keep what they typed.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      method="post"
      className={cn("space-y-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="rounded-lg border border-paid/30 bg-paid-tint px-4 py-3 text-sm text-[#155c39]">
          {state.success}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  confirm,
  pendingLabel = "Saving…",
}: {
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
  className?: string;
  confirm?: string;
  pendingLabel?: string;
}) {
  const pending = useContext(PendingContext);
  const hydrated = useHydrated();
  return (
    <button
      type="submit"
      disabled={pending || !hydrated}
      aria-busy={pending}
      className={cn(buttonStyles[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
