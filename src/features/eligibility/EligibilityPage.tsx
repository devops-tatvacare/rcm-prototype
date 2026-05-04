import { TopBar } from "@/components/layout/TopBar";
import { Drawer } from "@/components/ui/Drawer";
import { EligibilityKpis } from "./EligibilityKpis";
import { EligibilityQueue } from "./EligibilityQueue";
import { CheckDetail } from "./CheckDetail";
import { useEligibility } from "@/store/useEligibility";

export function EligibilityPage() {
  const { drawerOpen, closeDrawer } = useEligibility();
  return (
    <>
      <TopBar breadcrumb="Workspace · Front cycle" title="Eligibility — 90-second checks" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <EligibilityKpis />
        <div className="flex min-h-0 flex-1">
          <EligibilityQueue />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} width={920}>
        <CheckDetail />
      </Drawer>
    </>
  );
}
