import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ApiError } from "@/api/errors";
import { isMfaRequired, login } from "@/api/session";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { isAuthenticated } from "@/shared/stores/authStore";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const DEMO_PASSWORD = "Demo-Passw0rd-2026";

const DEMO_ACCOUNTS = [
  { roleKey: "auth.demoRoleAdmin", email: "admin@demo.lexaudit.local" },
  { roleKey: "auth.demoRoleAccountant", email: "accountant@demo.lexaudit.local" },
  { roleKey: "auth.demoRoleApprover", email: "approver@demo.lexaudit.local" },
  { roleKey: "auth.demoRoleViewer", email: "viewer@demo.lexaudit.local" },
] as const;

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function DemoCredentialsPanel({ onSelect }: { onSelect: (email: string) => void }) {
  const { t } = useTranslation();

  return (
    <aside
      className="w-full max-w-md rounded-2xl border border-primary/20 bg-card p-6 shadow-md sm:p-8"
      aria-labelledby="demo-credentials-heading"
    >
      <header className="mb-5 space-y-1">
        <h2 id="demo-credentials-heading" className="text-lg font-semibold tracking-tight">
          {t("auth.demoCredentialsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("auth.demoCredentialsSubtitle")}</p>
      </header>

      <ul className="space-y-2">
        {DEMO_ACCOUNTS.map(({ roleKey, email }) => (
          <li key={email}>
            <button
              type="button"
              className="flex w-full flex-col gap-0.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(email)}
              aria-label={`${t(roleKey)}: ${email}. ${t("auth.demoCredentialsFill")}`}
            >
              <span className="text-xs font-medium text-muted-foreground">{t(roleKey)}</span>
              <code className="text-sm font-mono">{email}</code>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm">
        <span className="font-medium">{t("auth.password")}: </span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{DEMO_PASSWORD}</code>
      </p>
    </aside>
  );
}

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);

  const schema = z.object({
    email: z.email({ error: t("auth.emailInvalid") }),
    password: z.string().min(1, { error: t("auth.fieldRequired") }),
    mfaCode: z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function fillDemoCredentials(email: string) {
    setValue("email", email, { shouldValidate: true, shouldDirty: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true, shouldDirty: true });
    setFormError(null);
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values);
      // Only same-origin paths are honoured, to avoid open redirects.
      const target =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/dashboard";
      await navigate({ to: target });
    } catch (error) {
      if (isMfaRequired(error)) {
        setNeedsCode(true);
        setFormError(null);
        return;
      }
      const unauthenticated = error instanceof ApiError && error.code === "UNAUTHENTICATED";
      setFormError(
        unauthenticated
          ? t(needsCode ? "auth.invalidCode" : "auth.invalidCredentials")
          : error instanceof ApiError && error.code === "RATE_LIMITED"
            ? t("auth.tooManyAttempts")
            : t("auth.networkError"),
      );
    }
  }

  const fieldClass = "h-11 px-3.5 text-base";
  const labelClass = "block text-sm font-medium";

  return (
    <main className="min-h-dvh bg-muted">
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <LanguageSwitcher />
        </div>

        <div className="flex w-full max-w-4xl flex-col flex-col-reverse gap-6 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg sm:p-10">
            <p className="mb-8 text-lg font-semibold">{t("app.name")}</p>
            <header className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t("auth.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
            </header>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className={labelClass}>
                  {t("auth.email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className={labelClass}>
                  {t("auth.password")}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
              </div>
              {needsCode ? (
                <div className="space-y-2">
                  <label htmlFor="mfaCode" className={labelClass}>
                    {t("auth.mfaCode")}
                  </label>
                  <Input
                    id="mfaCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    autoFocus
                    className={fieldClass}
                    {...register("mfaCode")}
                  />
                  <p className="text-xs text-muted-foreground">{t("auth.mfaHint")}</p>
                </div>
              ) : null}
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isSubmitting}>
                {t("auth.submit")}
              </Button>
            </form>
          </div>

          <DemoCredentialsPanel onSelect={fillDemoCredentials} />
        </div>
      </section>
    </main>
  );
}
