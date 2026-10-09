import { describe, expect, it } from "vitest";
import { parseSse, type SseEvent } from "./sse";

/** A stream that delivers the given byte chunks one by one, exactly as a network would. */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]!);
      else controller.close();
    },
  });
}

const bytes = (text: string) => new TextEncoder().encode(text);

/** Splits encoded text into pieces of `size` bytes, which can cut through lines and through characters. */
function chunked(text: string, size: number): Uint8Array[] {
  const all = bytes(text);
  return Array.from({ length: Math.ceil(all.length / size) }, (_, i) => all.slice(i * size, (i + 1) * size));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  for await (const event of parseSse(stream)) events.push(event);
  return events;
}

const SAMPLE =
  'id: 1\nevent: message.delta\ndata: {"text":"Salam"}\n\nid: 2\nevent: message.completed\ndata: {"ok":true}\n\n';

describe("parseSse", () => {
  it("reads events with an id, a name and data", async () => {
    expect(await collect(streamOf([bytes(SAMPLE)]))).toEqual([
      { id: "1", event: "message.delta", data: '{"text":"Salam"}' },
      { id: "2", event: "message.completed", data: '{"ok":true}' },
    ]);
  });

  it("gives the same events however the bytes are cut, down to one byte at a time", async () => {
    const whole = await collect(streamOf([bytes(SAMPLE)]));
    for (const size of [1, 2, 3, 5, 7, 13]) {
      expect(await collect(streamOf(chunked(SAMPLE, size))), `chunk size ${size}`).toEqual(whole);
    }
  });

  it("keeps a multi-byte character intact when a chunk ends in the middle of it", async () => {
    const text = "event: message.delta\ndata: ƏDV-nin dərəcəsi həmişə şəffafdır\n\n";
    for (const size of [1, 2, 3]) {
      const [event] = await collect(streamOf(chunked(text, size)));
      expect(event?.data, `chunk size ${size}`).toBe("ƏDV-nin dərəcəsi həmişə şəffafdır");
    }
  });

  it("treats \\r\\n, \\n and \\r as line breaks, including a \\r\\n split between two chunks", async () => {
    const crlf = "event: a\r\ndata: 1\r\n\r\n";
    expect(await collect(streamOf([bytes(crlf)]))).toEqual([{ id: null, event: "a", data: "1" }]);
    expect(await collect(streamOf([bytes("event: a\r"), bytes("\ndata: 1\r"), bytes("\n\r"), bytes("\n")]))).toEqual([
      { id: null, event: "a", data: "1" },
    ]);
    expect(await collect(streamOf([bytes("event: a\rdata: 1\r\r")]))).toEqual([{ id: null, event: "a", data: "1" }]);
  });

  it("joins several data lines with a newline", async () => {
    expect(await collect(streamOf([bytes("data: a\ndata: b\ndata:\ndata: d\n\n")]))).toEqual([
      { id: null, event: "message", data: "a\nb\n\nd" },
    ]);
  });

  it("calls an event without a name 'message' and removes only one space after the colon", async () => {
    expect(await collect(streamOf([bytes("data:  two spaces\n\ndata:none\n\n")]))).toEqual([
      { id: null, event: "message", data: " two spaces" },
      { id: null, event: "message", data: "none" },
    ]);
  });

  it("ignores comments (keep-alives), retry and unknown fields", async () => {
    expect(await collect(streamOf([bytes(": keep-alive\nretry: 3000\nfoo: bar\nevent: x\ndata: 1\n\n")]))).toEqual([
      { id: null, event: "x", data: "1" },
    ]);
  });

  it("does not deliver an event that has no data", async () => {
    expect(await collect(streamOf([bytes("event: ping\n\nevent: real\ndata: 1\n\n")]))).toEqual([
      { id: null, event: "real", data: "1" },
    ]);
  });

  it("drops an event that was cut off before its blank line, instead of delivering half of it", async () => {
    expect(await collect(streamOf([bytes('id: 1\nevent: a\ndata: {"x":1}\n\nid: 2\nevent: b\ndata: {"par')]))).toEqual([
      { id: "1", event: "a", data: '{"x":1}' },
    ]);
  });

  it("keeps the last id for later events, as the specification says", async () => {
    expect(await collect(streamOf([bytes("id: 7\ndata: a\n\ndata: b\n\n")]))).toEqual([
      { id: "7", event: "message", data: "a" },
      { id: "7", event: "message", data: "b" },
    ]);
  });

  it("returns nothing for an empty stream", async () => {
    expect(await collect(streamOf([]))).toEqual([]);
  });
});
