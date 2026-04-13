import MemberNav from '@/components/member/MemberNav';
import AuthGuard from '@/components/member/AuthGuard';

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <AuthGuard />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {children}
      </div>
      <MemberNav />
    </div>
  );
}
