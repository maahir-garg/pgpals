import type { Metadata } from "next";
import { RecoverySession } from "./recovery-session";

export const metadata: Metadata = { title: "Open password reset" };

export default function RecoveryPage() {
  return <RecoverySession />;
}
