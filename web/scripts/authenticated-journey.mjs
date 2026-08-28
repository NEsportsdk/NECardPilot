#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function readOption(name) {
  const exactIndex = process.argv.indexOf(name);

  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }

  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length
  );
}

function normalizeBaseUrl(value) {
  const url = new URL(value ?? process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL);

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("E2E_BASE_URL must use HTTP or HTTPS.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.origin;
}

const missingVariables = ["E2E_EMAIL", "E2E_PASSWORD"].filter(
  (name) => !process.env[name]?.trim()
);

if (missingVariables.length > 0) {
  console.error(
    `Authenticated journey requires ${missingVariables.join(" and ")}. ` +
      "Use a dedicated, confirmed test account; values are never written to the repository."
  );
  process.exit(2);
}

const baseURL = normalizeBaseUrl(readOption("--base-url"));
const passthroughArguments = process.argv.slice(2).filter((argument, index, all) => {
  if (argument === "--base-url") {
    return false;
  }

  if (index > 0 && all[index - 1] === "--base-url") {
    return false;
  }

  return !argument.startsWith("--base-url=");
});
const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url)
);

console.log(`Vallective authenticated journey: ${baseURL}`);

const child = spawn(
  process.execPath,
  [playwrightCli, "test", ...passthroughArguments],
  {
    env: {
      ...process.env,
      E2E_BASE_URL: baseURL,
    },
    stdio: "inherit",
  }
);

child.on("error", (error) => {
  console.error(`Unable to start Playwright: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Playwright stopped after receiving ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
