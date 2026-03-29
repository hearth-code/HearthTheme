// Hearth README preview fixture: real-world TSX scene
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";

const ReleaseSchema = z.object({
  id: z.string(),
  channel: z.enum(["stable", "beta"]),
  latencyMs: z.number().int().nonnegative(),
  healthy: z.boolean(),
  updatedAt: z.string(),
});

type Release = z.infer<typeof ReleaseSchema>;

async function loadRelease(id: string): Promise<Release> {
  const res = await fetch(`/api/releases/${id}`);
  const json = await res.json();
  return ReleaseSchema.parse(json);
}

export function ReleaseCard(props: { id: string }) {
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => {
    void loadRelease(props.id).then(setRelease);
  }, [props.id]);

  const tone = useMemo(() => (release?.healthy ? "calm" : "warn"), [release]);
  if (!release) return <p>Loading release...</p>;

  const label = `${release.id} · ${release.latencyMs}ms`;

  return (
    <section data-tone={tone} className="release-card">
      <h2>{release.channel.toUpperCase()}</h2>
      <p>{label}</p>
      <time dateTime={release.updatedAt}>{release.updatedAt}</time>
    </section>
  );
}
