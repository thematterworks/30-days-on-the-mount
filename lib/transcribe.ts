import "server-only";

// Voice messages and videos in group conversations are transcribed so the
// screen can read what was said (and so the words are there for anyone who
// can't listen). ElevenLabs speech-to-text, fetching the file itself from a
// short-lived signed URL.

export async function transcribe(fileURL: string): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("cloud_storage_url", fileURL);
  form.append("tag_audio_events", "false");
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      console.error("Transcription failed", response.status, await response.text().catch(() => ""));
      return null;
    }
    const body = (await response.json()) as { text?: string };
    return body.text?.trim() ?? "";
  } catch (error) {
    console.error("Transcription failed", error);
    return null;
  }
}
