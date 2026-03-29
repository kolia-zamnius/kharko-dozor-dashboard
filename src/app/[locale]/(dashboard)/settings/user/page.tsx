import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UserSettings } from "./components/user-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.page");
  return { title: t("userTitle") };
}

export default function UserSettingsPage() {
  return <UserSettings />;
}
