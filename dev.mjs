import { spawn } from "node:child_process";

const processes = [
  spawn(process.execPath, ["server.mjs"], { stdio: "inherit", env: process.env }),
  spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:web"], { stdio: "inherit", env: process.env }),
];

function shutdown(signal) {
  for (const child of processes) child.kill(signal);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) shutdown("SIGTERM");
  });
}
