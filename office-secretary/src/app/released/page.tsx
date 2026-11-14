import Link from 'next/link';

export default function ReleasedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <div className="text-4xl">👋</div>
        <h1 className="text-xl font-bold">המערכת שוחררה</h1>
        <p className="text-sm text-slate-600">המזכירה השנייה יכולה להיכנס עכשיו מהמחשב שלה. אפשר לסגור את החלון.</p>
        <Link href="/" className="btn">חזרה למערכת</Link>
      </div>
    </main>
  );
}
