"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <nav className="flex-shrink-0 border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold">PortDoc</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/settings" className="text-sm text-gray-700 hover:text-gray-900">
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
