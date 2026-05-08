const QVAC_BASE_URL = (import.meta.env.VITE_QVAC_BASE_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:11434/v1";

interface QvacModelListResponse {
  data?: Array<{ id: string }>;
}

async function fetchModels(): Promise<string[]> {
  const res = await fetch(`${QVAC_BASE_URL}/models`);
  if (!res.ok) throw new Error("QVAC local runtime not reachable. Start it with `qvac serve openai --cors`.");
  const data = (await res.json()) as QvacModelListResponse;
  return (data.data ?? []).map((item) => item.id);
}

async function resolveModel(preferred: string | undefined, matcher?: (id: string) => boolean): Promise<string> {
  if (preferred?.trim()) return preferred.trim();
  const models = await fetchModels();
  const matched = matcher ? models.find(matcher) : undefined;
  const selected = matched ?? models[0];
  if (!selected) {
    throw new Error("No QVAC models are loaded. Configure and start a local QVAC server first.");
  }
  return selected;
}

export async function checkQvacAvailability(): Promise<boolean> {
  try {
    await fetchModels();
    return true;
  } catch {
    return false;
  }
}

export async function qvacChatJson<T>(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<T> {
  const model = await resolveModel(import.meta.env.VITE_QVAC_CHAT_MODEL as string | undefined);
  const res = await fetch(`${QVAC_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`QVAC chat failed (${res.status}).`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("QVAC returned an empty response.");

  const jsonMatch = content.match(/\{[\s\S]*\}$/);
  const raw = jsonMatch ? jsonMatch[0] : content;
  return JSON.parse(raw) as T;
}

export async function qvacTranscribe(file: Blob): Promise<string> {
  const model = await resolveModel(
    import.meta.env.VITE_QVAC_TRANSCRIBE_MODEL as string | undefined,
    (id) => /whisper|parakeet/i.test(id)
  );
  const form = new FormData();
  form.append("file", file, "qvac-audio.webm");
  form.append("model", model);
  form.append("response_format", "json");

  const res = await fetch(`${QVAC_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`QVAC transcription failed (${res.status}). Make sure the server is running with CORS enabled.`);
  }
  const data = await res.json() as { text?: string };
  return data.text?.trim() ?? "";
}
