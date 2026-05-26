export type SessionEvent = {
  clientId: string;
  html: string;
  sessionCode: string;
};

export class SessionEventBroker {
  readonly #clients = new Map<
    string,
    Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>
  >();
  readonly #encoder = new TextEncoder();

  publish(event: SessionEvent) {
    const clients = this.#clients.get(event.sessionCode)?.get(event.clientId);
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

  stream(sessionCode: string, clientId: string, initialHtml?: string) {
    let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        activeController = controller;
        const sessionClients = this.#clients.get(sessionCode) ?? new Map();
        const clients = sessionClients.get(clientId) ?? new Set();
        clients.add(controller);
        sessionClients.set(clientId, clients);
        this.#clients.set(sessionCode, sessionClients);
        controller.enqueue(this.#encoder.encode(": connected\n\n"));
        if (initialHtml) {
          controller.enqueue(
            this.#encoder.encode(`event: session\n${this.#dataLines(initialHtml)}\n\n`),
          );
        }
      },
      cancel: () => {
        const clients = this.#clients.get(sessionCode)?.get(clientId);
        if (!clients) return;
        if (activeController) clients.delete(activeController);
        if (clients.size > 0) return;

        const sessionClients = this.#clients.get(sessionCode);
        sessionClients?.delete(clientId);
        if (sessionClients?.size === 0) this.#clients.delete(sessionCode);
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
