import Link from "next/link";

function TiHexagonLetterI() {
  return (
    <svg
      aria-hidden="true"
      data-icon="ti-hexagon-letter-i"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ color: "#7F77DD" }}
    >
      <path d="M19.875 6.27c.7.398 1.13 1.143 1.125 1.948v7.284c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1-2.184 0l-6.75-4.27A2.239 2.239 0 0 1 3 15.502V8.217c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033z" />
      <path d="M12 11v5" />
      <path d="M12 8v.01" />
    </svg>
  );
}

export function AppNavbar() {
  return (
    <header className="border-b border-border bg-background">
      <nav
        aria-label="Application"
        className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 justify-self-start"
          aria-label="Intentify home"
        >
          <TiHexagonLetterI />
          <span
            className="text-[15px] font-medium tracking-[0.04em]"
            style={{ color: "var(--color-text-primary, var(--foreground))" }}
          >
            intentify
          </span>
        </Link>

        <div className="text-xs font-normal text-muted-foreground">
          v0.1 / codex
        </div>
      </nav>
    </header>
  );
}
