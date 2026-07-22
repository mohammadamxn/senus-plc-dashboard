import { siteConfig } from "@/config/site";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f4ef] px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs uppercase tracking-[0.22em] text-stone-500">
          {siteConfig.companyLegalName}
        </p>
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="font-serif text-2xl tracking-tight text-stone-900">{title}</h1>
          {description && <p className="mt-2 text-sm text-stone-600">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-stone-600">{footer}</div>}
      </div>
    </div>
  );
}
