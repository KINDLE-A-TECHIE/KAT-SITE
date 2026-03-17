import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { BackButton, PrintButton } from "./print-button";

interface Props {
  params: Promise<{ receiptId: string }>;
}

export default async function ReceiptPage({ params }: Props) {
  const { receiptId } = await params;
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          program: { select: { name: true } },
        },
      },
      issuedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!receipt) {
    notFound();
  }

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  const isOwner = receipt.issuedTo.id === session.user.id;

  // Parents may view receipts for their linked children.
  const isParentOfOwner =
    !isOwner &&
    !isAdmin &&
    session.user.role === UserRole.PARENT &&
    (await prisma.parentStudent.findUnique({
      where: {
        parentId_childId: { parentId: session.user.id, childId: receipt.issuedTo.id },
      },
      select: { childId: true },
    })) !== null;

  if (!isOwner && !isAdmin && !isParentOfOwner) {
    notFound();
  }

  const { payment, issuedTo, issuedBy } = receipt;

  // Resolve parent name if this was a parent-initiated payment.
  const paidByParentId =
    typeof receipt.payment === "object" &&
    receipt.payment.metadata &&
    typeof receipt.payment.metadata === "object" &&
    !Array.isArray(receipt.payment.metadata)
      ? (receipt.payment.metadata as Record<string, unknown>).paidByParentId as string | undefined
      : undefined;

  const paidByParent = paidByParentId
    ? await prisma.user.findUnique({
        where: { id: paidByParentId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const amount = Number(payment.amount).toLocaleString("en-NG", {
    style: "currency",
    currency: payment.currency,
  });
  const billingMonth = new Date(payment.billingMonth).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
  const issuedDate = new Date(receipt.issuedAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white shadow-lg print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-8 py-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              KAT Learning
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Payment Receipt</h1>
            <p className="mt-0.5 text-sm text-slate-500">#{receipt.receiptNumber}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                payment.status === "SUCCESS"
                  ? "bg-emerald-100 text-emerald-700"
                  : payment.status === "REFUNDED"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {payment.status}
            </span>
            <p className="mt-1 text-xs text-slate-400">{issuedDate}</p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 px-8 py-7">
          {/* Issued To */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Issued To
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {issuedTo.firstName} {issuedTo.lastName}
            </p>
            <p className="text-sm text-slate-500">{issuedTo.email}</p>
          </div>

          {/* Payment Details */}
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 text-slate-500">Program</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {payment.program?.name ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-500">Billing Month</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {billingMonth}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-500">Reference</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                    {payment.reference}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-500">Payment Method</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {payment.channel ?? payment.provider}
                  </td>
                </tr>
                {paidByParent && (
                  <tr>
                    <td className="px-4 py-3 text-slate-500">Paid By</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {paidByParent.firstName} {paidByParent.lastName}{" "}
                      <span className="text-xs text-slate-400">(Parent)</span>
                    </td>
                  </tr>
                )}
                {issuedBy && (
                  <tr>
                    <td className="px-4 py-3 text-slate-500">Issued By</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {issuedBy.firstName} {issuedBy.lastName}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Amount */}
          <div className="flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Amount Paid
            </p>
            <p className="text-2xl font-bold text-slate-900">{amount}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-8 py-5 text-center text-xs text-slate-400 print:hidden">
          <p>This is an official payment receipt from KAT Learning.</p>
          <p className="mt-1">
            Use your browser&apos;s Print function (Ctrl+P / ⌘P) to save as PDF.
          </p>
        </div>
      </div>

      {/* Print / Back buttons */}
      <div className="mx-auto mt-5 flex max-w-2xl justify-between print:hidden">
        <BackButton />
        <PrintButton />
      </div>
    </div>
  );
}
