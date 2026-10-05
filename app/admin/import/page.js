import { Suspense } from "react";
import Import from "@/components/admin/Import";

export const metadata = { title: "Import" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Import />
    </Suspense>
  );
}
