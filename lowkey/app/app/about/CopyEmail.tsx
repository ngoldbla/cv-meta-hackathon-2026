"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";

/** The author's address as selectable text, with a copy button (task 044). */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="select-all font-mono text-sm">{email}</span>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Email address copied" : ""}
      </span>
    </span>
  );
}
