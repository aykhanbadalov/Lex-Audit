/**
 * A small multipart/form-data reader for the mock API. `request.formData()` is not used because under jsdom the
 * global `File` is replaced, and undici then rejects its own parsed files. Reading raw bytes works everywhere.
 */
export interface ParsedMultipart {
  fields: Map<string, string[]>;
  file?: { fieldName: string; name: string; type: string; size: number };
}

function boundaryOf(contentType: string | null): string | null {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  return match ? (match[1] ?? match[2] ?? null) : null;
}

/** One character per byte, so string offsets equal byte offsets. */
function latin1(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return text;
}

function utf8(binaryString: string): string {
  return new TextDecoder("utf-8").decode(Uint8Array.from(binaryString, (char) => char.charCodeAt(0)));
}

export async function parseMultipart(request: Request): Promise<ParsedMultipart | null> {
  const boundary = boundaryOf(request.headers.get("Content-Type"));
  if (!boundary) return null;

  const body = latin1(new Uint8Array(await request.arrayBuffer()));
  const result: ParsedMultipart = { fields: new Map() };

  for (const rawPart of body.split(`--${boundary}`)) {
    const part = rawPart.replace(/^\r\n/, "");
    if (part === "" || part.startsWith("--")) continue; // preamble and closing marker

    const split = part.indexOf("\r\n\r\n");
    if (split < 0) continue;
    const headers = utf8(part.slice(0, split));
    const content = part.slice(split + 4).replace(/\r\n$/, "");

    const name = /name="([^"]*)"/.exec(headers)?.[1];
    if (name === undefined) continue;
    const fileName = /filename="([^"]*)"/.exec(headers)?.[1];

    if (fileName !== undefined) {
      result.file = {
        fieldName: name,
        name: fileName,
        type: /Content-Type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? "application/octet-stream",
        size: content.length,
      };
    } else {
      result.fields.set(name, [...(result.fields.get(name) ?? []), utf8(content)]);
    }
  }
  return result;
}
