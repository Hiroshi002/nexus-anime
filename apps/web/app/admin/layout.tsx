export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void-base">
      <header className="border-b border-border-subtle px-6 py-4">
        <p className="font-display text-sm font-semibold text-rift-gold">Nexus Admin</p>
      </header>
      <main className="mx-auto max-w-container px-6 py-8">{children}</main>
    </div>
  );
}
