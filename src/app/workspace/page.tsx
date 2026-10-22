import type { Metadata } from "next";
import Workspace from "@/components/Workspace";
export const metadata: Metadata = {
  title: "My workspace",
  robots: { index: false, follow: false },
};
export default function WorkspacePage() {
  return <Workspace />;
}
