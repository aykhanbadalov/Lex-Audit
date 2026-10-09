import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore, type ThemeMode } from "@/shared/stores/themeStore";
import { Button } from "@/shared/ui/button";

const OPTIONS: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: "light", icon: Sun },
  { mode: "dark", icon: Moon },
  { mode: "system", icon: Monitor },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <div role="group" aria-label={t("theme.label")} className="flex rounded-md border p-0.5">
      {OPTIONS.map(({ mode: option, icon: Icon }) => (
        <Button
          key={option}
          variant={mode === option ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2"
          aria-pressed={mode === option}
          aria-label={t(`theme.${option}`)}
          onClick={() => setMode(option)}
        >
          <Icon className="size-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
