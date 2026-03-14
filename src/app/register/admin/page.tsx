import { Suspense } from "react";
import { AdminRegisterForm } from "./admin-register-form";

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading invite details...</p>
      </div>
    </main>
  );
}

export default function AdminRegisterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminRegisterForm />
    </Suspense>
  );
}
