import { redirect } from "next/navigation";

type OnboardingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) {
          params.append(key, item);
        }
      }
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  redirect(queryString ? `/learn?${queryString}` : "/learn");
}
