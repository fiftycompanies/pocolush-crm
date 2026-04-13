export default function MemberAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-page">
      {children}
    </div>
  );
}
