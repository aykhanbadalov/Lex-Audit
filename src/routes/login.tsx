import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { isAuthenticated, useAuthStore } from "@/shared/stores/authStore";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

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

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    email: z.email({ error: t("auth.emailInvalid") }),
    password: z.string().min(1, { error: t("auth.fieldRequired") }),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const { data } = await api.POST("/auth/login", { body: values });
      if (!data) throw new ApiError("INTERNAL", "Empty response", 500);
      useAuthStore.getState().setSession(data);
      // Only same-origin paths are honoured, to avoid open redirects.
      const target =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/dashboard";
      await navigate({ to: target });
    } catch (error) {
      const unauthenticated = error instanceof ApiError && error.code === "UNAUTHENTICATED";
      setFormError(unauthenticated ? t("auth.invalidCredentials") : t("auth.networkError"));
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("auth.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              {t("auth.email")}
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              {t("auth.password")}
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
          </div>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("auth.submit")}
          </Button>
        </form>
      </div>
    </main>
  );
}
