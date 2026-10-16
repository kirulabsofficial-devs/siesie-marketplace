import { LinkButton } from "../components/ui";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 grid w-24 grid-cols-2 gap-[3px] rounded-[var(--radius-tile)] bg-grout-deep p-[3px]" aria-hidden>
        <span className="aspect-square rounded-[3px] bg-cobalt" />
        <span className="aspect-square rounded-[3px] bg-cobalt" />
        <span className="aspect-square rounded-[3px] bg-cobalt" />
        <span className="aspect-square rounded-[3px] border-2 border-dashed border-ink-soft/50 bg-tile-dim" />
      </div>
      <h1 className="display-narrow text-3xl">This page is missing a tile.</h1>
      <p className="mt-3 text-ink-soft">The link may be old, or the job or worker was removed.</p>
      <LinkButton to="/" className="mt-6">
        Go to the home page
      </LinkButton>
    </div>
  );
}
