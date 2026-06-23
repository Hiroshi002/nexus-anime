export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-void-base px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border-subtle bg-void-elevated p-8 shadow-glow-resonance">
        {children}
      </div>
    </div>
  );
}
