export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void-base">
      <div className="mx-auto max-w-3xl px-4 py-12 font-body text-text-secondary prose-invert">
        {children}
      </div>
    </div>
  );
}
