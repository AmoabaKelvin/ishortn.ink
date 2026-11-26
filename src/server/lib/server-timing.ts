type Metric = { name: string; dur: number; desc?: string };

/**
 * Step durations for one request's `Server-Timing` header. Create one per request and pass it
 * down: a Worker isolate serves concurrent requests, so this must never be module state. Only
 * durations and fixed outcome labels go in; never URLs, ids or hostnames.
 */
export class ServerTiming {
  private readonly started = Date.now();
  private readonly metrics: Metric[] = [];

  add(name: string, dur: number, desc?: string): void {
    this.metrics.push({ name, dur, desc });
  }

  /** Times `run` whether it resolves or throws, so refused requests are measured too. */
  async measure<T>(name: string, run: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await run();
    } finally {
      this.add(name, Date.now() - started);
    }
  }

  /** The header value, ending with `total` (creation to now). */
  header(): string {
    return [...this.metrics, { name: "total", dur: Date.now() - this.started }]
      .map(formatMetric)
      .join(", ");
  }

  /** Sets the header on `response` and returns it. */
  apply(response: Response): Response {
    response.headers.set("Server-Timing", this.header());
    return response;
  }
}

export function formatMetric({ name, dur, desc }: Metric): string {
  const value = `${name};dur=${Math.max(0, Math.round(dur))}`;
  return desc ? `${value};desc="${desc.replace(/["\\]/g, "")}"` : value;
}
