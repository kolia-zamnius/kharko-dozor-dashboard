import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OrganizationsSettings } from "./components/organizations-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.page");
  return { title: t("orgsTitle") };
}

export default function OrganizationsSettingsPage() {
  return <OrganizationsSettings />;
}
