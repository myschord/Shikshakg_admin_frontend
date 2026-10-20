import { Suspense } from "react";
import PyqYearsScreen from "@/components/papers/PyqYearsScreen";

export const metadata = { title: "PYQ by year" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PyqYearsScreen />
    </Suspense>
  );
}
