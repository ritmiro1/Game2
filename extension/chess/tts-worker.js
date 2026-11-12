import ESpeakNG from "../vendor/espeak/espeak-ng.js";

const jobs = [];
let running = false;
let sequence = 0;

self.addEventListener("message", (event) => {
  if (event.data?.type === "cancel") {
    jobs.length = 0;
    return;
  }
  if (event.data?.type !== "synthesize") return;
  jobs.push(event.data);
  void processQueue();
});

async function processQueue() {
  if (running) return;
  running = true;
  while (jobs.length) {
    const job = jobs.shift();
    try {
      const wavPath = `/ladya-speech-${++sequence}.wav`;
      const speed = Math.min(240, Math.max(110, Math.round(175 * (Number(job.rate) || 1))));
      const module = await ESpeakNG({
        arguments: ["-w", wavPath, "-v", "ru", "-s", String(speed), String(job.text || "")],
        print: () => {},
        printErr: () => {},
      });
      const wav = module.FS.readFile(wavPath);
      module.FS.unlink(wavPath);
      const audio = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
      self.postMessage({ type: "audio", id: job.id, audio }, [audio]);
    } catch (error) {
      self.postMessage({ type: "error", id: job.id, error: error?.message || "Не удалось синтезировать речь." });
    }
  }
  running = false;
}
