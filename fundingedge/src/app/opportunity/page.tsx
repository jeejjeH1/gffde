import { Suspense } from "react";
import { OpportunityDetail } from "@/components/OpportunityDetail";

export default function Page() {
  return <Suspense fallback={null}><OpportunityDetail /></Suspense>;
}
