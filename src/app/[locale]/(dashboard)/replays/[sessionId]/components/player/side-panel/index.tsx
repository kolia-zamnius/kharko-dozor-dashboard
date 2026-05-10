import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";

import { usePlayerStore } from "../store";
import { isPlayerTab } from "../types";
import { ConsoleTab } from "./console-tab";
import { HistoryTab } from "./history-tab";

export function SidePanel() {
  const t = useTranslations("replays.detail.player.tabs");
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isPlayerTab(value)) setActiveTab(value);
      }}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <TabsList variant="line" className="h-9 w-full shrink-0 justify-start gap-1 border-b px-2">
        <TabsTrigger value="history">{t("history")}</TabsTrigger>
        <TabsTrigger value="console">{t("console")}</TabsTrigger>
      </TabsList>
      <TabsContent value="history" className="min-h-0 flex-1 outline-none">
        <HistoryTab />
      </TabsContent>
      <TabsContent value="console" className="min-h-0 flex-1 outline-none">
        <ConsoleTab />
      </TabsContent>
    </Tabs>
  );
}
