import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { siteConfig } from "@/config/site";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? `/reports/${siteConfig.defaultPeriodId}` : "/login");
}
