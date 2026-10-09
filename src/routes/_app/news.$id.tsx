import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, ExternalLink, Newspaper } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { useNewsDetail, useSetNewsBookmark, useSetNewsRead } from "@/features/news/api";
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

  // Opening an item counts as reading it. Only the transition to "read" is sent, once per item.
  const needsMarking = detail.data !== undefined && !detail.data.isRead;
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
    const originalUrl = safeExternalUrl(item.originalUrl);
    content = (
      <article className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <RiskLabel level={item.riskLevel} />
            <Badge tone="outline">{t(`category.${item.category}`)}</Badge>
            {item.tags.map((tagName) => (
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
              aria-pressed={item.isBookmarked}
              onClick={() => setBookmark({ id, value: !item.isBookmarked })}
            >
              <Bookmark className={cn("size-4", item.isBookmarked && "fill-current")} aria-hidden="true" />
              {item.isBookmarked ? t("news.removeBookmark") : t("news.addBookmark")}
            </Button>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <div className="flex gap-1.5">
              <dt>{t("news.source")}:</dt>
              <dd className="text-foreground">{item.sourceName}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t("news.published")}:</dt>
              <dd className="text-foreground">{formatDateTime(item.publishedAt, tag)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t("news.fetched")}:</dt>
              <dd className="text-foreground">{formatDateTime(item.fetchedAt, tag)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t("news.lastChecked")}:</dt>
              <dd className="text-foreground">{formatDateTime(item.lastCheckedAt, tag)}</dd>
            </div>
          </dl>
        </header>

        <AiNotice modelVersion={item.ai.modelVersion}>
          <div className="space-y-3 text-sm">
            <div>
              <h2 className="font-medium">{t("news.aiSummary")}</h2>
              <p>{item.ai.summary}</p>
            </div>
            <div>
              <h2 className="font-medium">{t("news.aiRisk")}</h2>
              <p>{item.ai.riskExplanation}</p>
            </div>
          </div>
        </AiNotice>

        <Card>
          <CardHeader>
            <CardTitle>{t("news.sourceText")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plain text on purpose: scraped content is never rendered as HTML. */}
            <p className="text-sm leading-relaxed whitespace-pre-line">{item.body}</p>
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

        {item.relatedLegislation.length > 0 ? (
          <section aria-labelledby="related-heading" className="space-y-2">
            <h2 id="related-heading" className="text-lg font-semibold">
              {t("news.relatedLegislation")}
            </h2>
            <ul className="space-y-1 text-sm">
              {item.relatedLegislation.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to="/legislation/$id"
                    params={{ id: doc.id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {doc.title}
                    {doc.articleRef ? ` — ${t("legislation.article", { ref: doc.articleRef })}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="impact-heading" className="space-y-2">
          <h2 id="impact-heading" className="text-lg font-semibold">
            {t("news.impact")}
          </h2>
          {item.impact.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("news.noImpact")}</p>
          ) : (
            <ul className="space-y-2">
              {item.impact.map((finding) => (
                <li key={finding.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{finding.resourceTitle}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{t(`news.impactType.${finding.resourceType}`)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("news.relevance", { percent: Math.round(finding.score * 100) })}
                      </span>
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
