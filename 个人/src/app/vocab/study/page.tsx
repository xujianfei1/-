/**
 * /vocab/study - 学习界面 (登录, 素净专注模式, 无背景壁纸)
 */
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { VocabStudy } from '@/components/vocab/study';

export const metadata: Metadata = {
  title: '学习中 · 背单词',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function VocabStudyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }

  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col justify-center py-6">
        <VocabStudy />
      </main>
      <Footer />
    </div>
  );
}
