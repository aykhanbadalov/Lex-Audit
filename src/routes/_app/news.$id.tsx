import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, ExternalLink, Newspaper } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { AskAssistantLink } from "@/features/assistant/components/AskAssistantLink";
import { useImpactFindings, scorePercent } from "@/features/impact/api";
import { useNewsDetail, useNewsSources, useSetNewsBookmark, useSetNewsRead } from "@/features/news/api";
import { riskLevel } from "@/features/news/risk";
import { AiNotice } from "@/shared/components/AiNotice";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { RiskLabel } from "@/shared/components/RiskLabel";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { safeExternalUrl } from "@/shared/lib/safeUrl";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const Route = createFileRoute("/_app/news/$id")({
  component: NewsDetailPage,
});

function BackLink() {
  const { t } = useTranslation();
  // Return to the list exactly as the user left it (filters, search); a direct visit has no list state, so none is applied.
  const listSearch = useLocation({ select: (location) => location.state.fromNewsSearch });
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/news" search={listSearch ?? {}}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("news.back")}
      </Link>
    </Button>
  );
}

function NewsDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="news:read">
      <NewsDetailPageContent />
    </RequirePermission>
  );
}

function NewsDetailPageContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const detail = useNewsDetail(id);
  const { mutate: setRead } = useSetNewsRead();
  const { mutate: setBookmark } = useSetNewsBookmark();
  const tag = localeTag(i18n.language);
  const sources = useNewsSources();
  const impact = useImpactFindings();

  // Opening an item counts as reading it. Only the transition to "read" is sent, once per item.
  const needsMarking = detail.data !== undefined && !detail.data.read;
  useEffect(() => {
    if (needsMarking) setRead({ id, value: true });
  }, [needsMarking, id, setRead]);

  let content;
  if (detail.isPending) {
    content = <LoadingState />;
  } else if (detail.isError) {
    content =
      detail.error instanceof ApiError && detail.error.code === "NOT_FOUND" ? (
        <EmptyState icon={Newspaper} title={t("news.notFound")} description={t("news.notFoundHint")} />
      ) : (
        <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />
      );
  } else {
    const item = detail.data;
    const findings = (impact.data ?? []).filter((finding) => finding.sourceKind === "news" && finding.sourceId === item.id);
    const originalUrl = safeExternalUrl(item.originalUrl);
    content = (
      <article className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {riskLevel(item.aiRiskLevel) ? <RiskLabel level={riskLevel(item.aiRiskLevel)!} /> : null}
            {item.aiCategory ? (
              <Badge tone="outline">{t(`category.${item.aiCategory}`, { defaultValue: item.aiCategory })}</Badge>
            ) : null}
            {(item.aiTags ?? []).map((tagName) => (
              <Badge key={tagName} tone="neutral">
                {tagName}
              </Badge>
            ))}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              aria-pressed={item.bookmarked}
              onClick={() => setBookmark({ id, value: !item.bookmarked })}
            >
              <Bookmark className={cn("size-4", item.bookmarked && "fill-current")} aria-hidden="true" />
              {item.bookmarked ? t("news.removeBookmark") : t("news.addBookmark")}
            </Button>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <div className="flex gap-1.5">
              <dt>{t("news.source")}:</dt>
              <dd className="text-foreground">{sources.data?.find((source) => source.id === item.sourceId)?.name ?? "—"}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t("news.published")}:</dt>
              <dd className="text-foreground">{formatDateTime(item.publishedAt ?? item.fetchedAt, tag)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t("news.fetched")}:</dt>
              <dd className="text-foreground">{formatDateTime(item.fetchedAt, tag)}</dd>
            </div>
          </dl>
        </header>

        <div>
          <AskAssistantLink resource={{ type: "news", id: item.id, title: item.title }} />
        </div>

        {item.aiSummary ? (
          <AiNotice>
            <div className="space-y-3 text-sm">
              <div>
                <h2 className="font-medium">{t("news.aiSummary")}</h2>
                <p>{item.aiSummary}</p>
              </div>
            </div>
          </AiNotice>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("news.sourceText")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plain text on purpose: scraped content is never rendered as HTML. */}
            <p className="text-sm leading-relaxed whitespace-pre-line">{item.rawText || item.excerpt}</p>
            {originalUrl ? (
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
              >
                {t("news.openOriginal")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </CardContent>
        </Card>

        <section aria-labelledby="impact-heading" className="space-y-2">
          <h2 id="impact-heading" className="text-lg font-semibold">
            {t("news.impact")}
          </h2>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("news.noImpact")}</p>
          ) : (
            <ul className="space-y-2">
              {findings.map((finding) => (
                <li key={finding.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {finding.affectedResourceType === "file" ? (
                      <Link
                        to="/files/$id"
                        params={{ id: finding.affectedResourceId }}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t("news.impactType.file")}
                      </Link>
                    ) : (
                      <span className="font-medium">{t(`news.impactType.${finding.affectedResourceType}`)}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {t("news.relevance", { percent: scorePercent(finding.score) })}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{finding.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    );
  }

  return (
    <>
      <BackLink />
      {content}
    </>
  );
}
