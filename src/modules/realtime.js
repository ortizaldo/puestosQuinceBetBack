const clients = new Set();

function sendToClients(change) {
  const message = `data: ${JSON.stringify(change)}\n\n`;
  for (const client of clients) {
    if (!client.writableEnded) {
      try {
        client.write(message);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function connectRealtime(req, res) {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 5000\n\n");
  clients.add(res);

  let heartbeat;
  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(res);
  };
  heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      cleanup();
    }
  }, 25000);
  heartbeat.unref?.();

  req.on("aborted", cleanup);
  res.on("close", cleanup);
}

export function publishRealtimeChange(resource, action, details = {}) {
  sendToClients({ resource, action, ...details, occurredAt: new Date().toISOString() });
}
