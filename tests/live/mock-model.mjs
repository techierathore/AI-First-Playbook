// A scripted OpenAI-compatible chat-completions server. OpenCode talks to it
// as a model provider; it answers each request with the next scripted tool
// call, then with plain text once every step is spent. No real model runs.
import { createServer } from "node:http";

export function startMockModel(script) {
  const requests = [];
  let step = 0;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed = {};
      try { parsed = JSON.parse(body || "{}"); } catch {}
      requests.push({ url: req.url, body: parsed });
      if (!req.url.endsWith("/chat/completions")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: [{ id: "scripted", object: "model" }] }));
        return;
      }
      const toolNames = new Set((parsed.tools ?? []).map((t) => t.function?.name));
      const next = step < script.length ? script[step] : null;
      const lastIsTool = parsed.messages?.at(-1)?.role === "tool";
      // A title-generation or summary request carries no tools: answer text.
      // A step marked `fresh` opens a new session's first turn (a subagent the
      // previous step dispatched), whose last message is its prompt, not a tool result.
      const action = toolNames.size && next && (step === 0 || lastIsTool || (next.fresh && !lastIsTool)) ? next : null;
      if (action) step += 1;
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      const id = `chatcmpl-${requests.length}`;
      const chunk = (delta, finish = null) => res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: "scripted", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
      if (action) {
        chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${step}`, type: "function", function: { name: action.tool, arguments: JSON.stringify(action.args) } }] });
        chunk({}, "tool_calls");
      } else {
        chunk({ role: "assistant", content: "probe finished" });
        chunk({}, "stop");
      }
      res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: "scripted", choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, requests, steps: () => step })));
}
