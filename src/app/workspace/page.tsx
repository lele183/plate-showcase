import type { Metadata } from "next";
import Workspace from "@/components/Workspace";
export const metadata: Metadata = { title: "My workspace" };
export default function WorkspacePage() {
  return <Workspace />;
}
