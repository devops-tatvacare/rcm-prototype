import { TopBar } from "@/components/layout/TopBar";
import { Drawer } from "@/components/ui/Drawer";
import { ClearancesKpis } from "./ClearancesKpis";
import { ClearancesQueue } from "./ClearancesQueue";
import { ClearanceDetail } from "./ClearanceDetail";
import { useClearances } from "@/store/useClearances";

export function ClearancesPage() {
  const { drawerOpen, close } = useClearances();
  return (
    <>
      <TopBar breadcrumb="Workspace · Front cycle" title="Financial Clearance — before they walk in" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <ClearancesKpis />
        <div className="flex min-h-0 flex-1">
          <ClearancesQueue />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={close} width={920}>
        <ClearanceDetail />
      </Drawer>
    </>
  );
}
