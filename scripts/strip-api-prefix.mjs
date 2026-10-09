// The backend's paths all start with "/api/v1". The client's base URL already ends with it, so the generated
// types drop the prefix and call sites read `api.GET("/news")`.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/api/schema.d.ts", import.meta.url);
const text = readFileSync(file, "utf8").replace(/^(\s*)"\/api\/v1(\/[^"]*)":/gm, '$1"$2":').replace(/^(\s*)"\/api\/v1":/gm, '$1"/":');
writeFileSync(file, text);
