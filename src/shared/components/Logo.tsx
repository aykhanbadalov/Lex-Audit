/** The product's mark, the same drawing as the browser tab icon (public/favicon.svg). */
export function Logo({ className = "size-8" }: { className?: string }) {
  return <img src="/favicon.svg" alt="" aria-hidden="true" className={className} width={32} height={32} />;
}
