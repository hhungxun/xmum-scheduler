import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function run(label, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 || signal) return;
    shuttingDown = true;
    for (const proc of children) {
      if (proc !== child && !proc.killed) proc.kill();
    }
    console.error(`${label} exited with code ${code}.`);
    process.exit(code ?? 1);
  });
  return child;
}

function shutdown() {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

run("API server", process.execPath, ["server.mjs"]);
run("Vite", process.execPath, ["node_modules/vite/bin/vite.js"]);
