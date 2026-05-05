import { TopBar } from "@/components/layout/TopBar";
import { Drawer } from "@/components/ui/Drawer";
import { DenialsKpis } from "./DenialsKpis";
import { DenialsQueue } from "./DenialsQueue";
import { AppealDrafter } from "./AppealDrafter";
import { useDenials } from "@/store/useDenials";

export function DenialsPage() {
  const { drawerOpen, closeDrawer } = useDenials();
  return (
    <>
      <TopBar title="Denials" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <DenialsKpis />
        <div className="flex min-h-0 flex-1">
          <DenialsQueue />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} width={920}>
        <AppealDrafter />
      </Drawer>
    </>
  );
}
