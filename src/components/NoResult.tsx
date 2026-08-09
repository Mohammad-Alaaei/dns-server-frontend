import { useTranslation } from "react-i18next";

export function NoResult({ fullScreen = true }) {
  const { t } = useTranslation();

  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen items-center justify-center text-muted-foreground"
          : "px-4 py-12 text-center text-muted-foreground"
      }
    >
      {t("common.noResults")}
    </div>
  );
}
