import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/primitives/button";
import { Spinner } from "@/components/ui/feedback/spinner";

type LoadMoreProps = {
  onClick: () => void;
  isLoading: boolean;
};

/**
 * Cursor-pagination trigger. Shows a centered "Load more" button with
 * an inline spinner while the next page is in flight.
 */
export function LoadMore({ onClick, isLoading }: LoadMoreProps) {
  const t = useTranslations("replays.list");
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" size="sm" onClick={onClick} disabled={isLoading}>
        {isLoading && <Spinner className="mr-1.5 size-3.5" aria-hidden />}
        {t("loadMore")}
      </Button>
    </div>
  );
}
