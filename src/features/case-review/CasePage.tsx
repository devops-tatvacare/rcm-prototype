import { TopBar } from "@/components/layout/TopBar";
import { Drawer } from "@/components/ui/Drawer";
import { CaseKpis } from "./CaseKpis";
import { InpatientQueue } from "./InpatientQueue";
import { CaseDetail } from "./CaseDetail";
import { useCaseReview } from "@/store/useCaseReview";

export function CasePage() {
  const { drawerOpen, close } = useCaseReview();
  return (
    <>
      <TopBar breadcrumb="Workspace · Mid cycle" title="Case Management — concurrent review" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <CaseKpis />
        <div className="flex min-h-0 flex-1">
          <InpatientQueue />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={close} width={920}>
        <CaseDetail />
      </Drawer>
    </>
  );
}
