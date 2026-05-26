export type SessionEvent = {
  html: string;
  sessionCode: string;
};

export class SessionEventBroker {
  readonly #clients = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();
  readonly #encoder = new TextEncoder();

  publish(event: SessionEvent) {
    const clients = this.#clients.get(event.sessionCode);
    if (!clients) return;

    const payload = this.#encoder.encode(`event: session\n${this.#dataLines(event.html)}\n\n`);
    for (const client of clients) {
      try {
        client.enqueue(payload);
      } catch {
        clients.delete(client);
      }
    }
  }

  stream(sessionCode: string) {
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const clients = this.#clients.get(sessionCode) ?? new Set();
        clients.add(controller);
        this.#clients.set(sessionCode, clients);
        controller.enqueue(this.#encoder.encode(": connected\n\n"));
      },
      cancel: () => {
        const clients = this.#clients.get(sessionCode);
        if (!clients) return;
        for (const client of clients) clients.delete(client);
        if (clients.size === 0) this.#clients.delete(sessionCode);
      },
    });
  }

  #dataLines(html: string) {
    return html
      .split("\n")
      .map((line) => `data: ${line}`)
      .join("\n");
  }
}
