import { RibbonNav } from "@/components/RibbonNav";
import { DashboardHeader } from "@/components/DashboardHeader";

// Todo lo que cuelga de este layout vive detrás del login y solo trae datos desde el
// cliente (axios); no hay nada útil que pre-renderizar de forma estática en build time.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-[76px]">
      <RibbonNav />
      <DashboardHeader />
      <main className="max-w-[1800px] px-6 py-5">{children}</main>
    </div>
  );
}
