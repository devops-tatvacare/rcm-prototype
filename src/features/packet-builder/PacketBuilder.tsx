import { TopBar } from "@/components/layout/TopBar";
import { Drawer } from "@/components/ui/Drawer";
import { HeadlineStrip } from "./HeadlineStrip";
import { FloorBoard } from "./FloorBoard";
import { ClaimDetail } from "./ClaimDetail";
import { usePacketBuilder } from "@/store/usePacketBuilder";

export function PacketBuilder() {
  const { drawerOpen, closeDrawer } = usePacketBuilder();

  return (
    <>
      <TopBar breadcrumb="Workspace · Operations" title="Claims floor — TatvaCare agents" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <HeadlineStrip />
        <div className="flex min-h-0 flex-1">
          <FloorBoard />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} width={920}>
        <ClaimDetail />
      </Drawer>
    </>
  );
}
