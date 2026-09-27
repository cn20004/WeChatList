import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";

export async function createZipFromDirectory(sourceDir, outputFile) {
  await fsp.mkdir(path.dirname(outputFile), { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve({
      filePath: outputFile,
      bytes: archive.pointer()
    }));

    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
