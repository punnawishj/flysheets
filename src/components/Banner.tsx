export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "var(--danger-soft)",
        color: "var(--danger)",
        padding: "12px 16px",
        borderRadius: 10,
        marginBottom: 20,
        fontSize: ".9rem",
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "var(--success-soft)",
        color: "var(--success)",
        padding: "12px 16px",
        borderRadius: 10,
        marginBottom: 20,
        fontSize: ".9rem",
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}
