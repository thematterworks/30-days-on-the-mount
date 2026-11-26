import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** The browser-tab icon: the app's mountain, in a circle. */
export default async function Icon() {
  const source = await readFile(path.join(process.cwd(), "components/site/icon-source.png"));
  return new ImageResponse(
    (
      <img
        src={`data:image/png;base64,${source.toString("base64")}`}
        width={512}
        height={512}
        alt=""
        style={{ borderRadius: "50%" }}
      />
    ),
    size,
  );
}
