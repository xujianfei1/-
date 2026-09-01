/**
 * /vocab - 背单词主页 (登录后可用)
 */
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { HeroBackdrop } from '@/components/hero-backdrop';
import { VocabClient } from '@/components/vocab/vocab-client';

export const metadata: Metadata = {
  title: '背单词',
  description: '间隔重复记单词 · 四六级/考研词库',
};

export const dynamic = 'force-dynamic';

export default async function VocabPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }

  return (
    <div className="relative">
      <HeroBackdrop
        className="h-[380px] md:h-[420px]"
        scrim="bg-gradient-to-b from-black/50 via-black/25 to-transparent"
      />
      <div className="container relative flex min-h-screen flex-col py-6 md:py-10">
        <Topbar />
        <main className="flex flex-1 flex-col gap-8">
          <div className="relative z-10 [&_h1]:text-white [&_h1]:drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">背单词</h1>
            <p className="mt-1 text-sm text-white/85">间隔重复 · 每天一点, 稳步前进</p>
          </div>
          <VocabClient />
        </main>
        <Footer />
      </div>
    </div>
  );
}
