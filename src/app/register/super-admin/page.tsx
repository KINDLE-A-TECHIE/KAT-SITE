import { Suspense } from "react";
import { SuperAdminRegisterForm } from "./super-admin-register-form";

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading invite details...</p>
      </div>
    </main>
  );
}

export default function SuperAdminRegisterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SuperAdminRegisterForm />
    </Suspense>
  );
}
