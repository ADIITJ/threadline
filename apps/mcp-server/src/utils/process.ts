import { execFileSync } from "node:child_process";
import { platform } from "node:os";

export function openFile(filePath: string): void {
  const p = platform();
  if (p === "darwin") {
    execFileSync("open", [filePath]);
  } else if (p === "linux") {
    execFileSync("xdg-open", [filePath]);
  } else if (p === "win32") {
    execFileSync("cmd", ["/c", "start", "", filePath]);
  }
}

export function openUrl(url: string): void {
  openFile(url);
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("node:net") as typeof import("net");
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export function getPlatform(): NodeJS.Platform {
  return platform();
}
