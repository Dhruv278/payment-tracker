import { redirect } from "next/navigation";
import { homePathFor, requireProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await requireProfile();
  redirect(homePathFor(profile));
}
