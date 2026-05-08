"use client";

import QuestionBank from "../_components/QuestionBank";

export default function AdminGuruInsightPage() {
  return (
    <QuestionBank
      pageTitle="Questions Bank"
      description="Lists all questions with search. Only admin can see and manage this page. New questions should be added every quarter by admin to keep the question bank fresh and relevant. Old questions can be inactivated but not deleted to preserve historical data. Questions should be rolled forward to the next quarter if they are still relevant and valid. This ensures that the question bank remains up-to-date and useful for future assessments."
      emptyLabel="Question List"
      summaryLabel="Questions"
    />
  );
}
