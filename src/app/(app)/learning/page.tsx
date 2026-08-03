import { BookOpen } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function LearningPage() {
  return (
    <ComingSoon
      icon={<BookOpen />}
      title="Learning"
      description="Books, courses, and skills you're building - tracked alongside the work they feed into."
    />
  );
}
