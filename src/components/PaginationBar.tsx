import type { PaginationMeta } from "@/api/client";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

interface PaginationBarProps {
  pagination: PaginationMeta | null;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationBar({
  pagination,
  loading,
  onPrev,
  onNext,
}: PaginationBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
      <span>
        {t("common.page")} {pagination?.page || "1"} {t("common.of")}{" "}
        {pagination?.totalPages || "1"}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!pagination?.hasPrev || loading}
          onClick={onPrev}
        >
          {t("common.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!pagination?.hasNext || loading}
          onClick={onNext}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
