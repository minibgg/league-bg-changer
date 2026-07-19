const { copyFileSync, existsSync, mkdirSync, rmSync } = require("fs");
const { resolve } = require("path");
const { execFileSync } = require("child_process");

const root = resolve(__dirname, "..");
const seaConfig = resolve(root, "sea-config.json");
const blob = resolve(root, "sea-prep.blob");
const outputDir = resolve(root, "dist");
const output = resolve(outputDir, "league-bg.exe");
const postject = require.resolve("postject/dist/cli.js");

mkdirSync(outputDir, { recursive: true });
if (existsSync(blob)) rmSync(blob);

execFileSync(process.execPath, ["--experimental-sea-config", seaConfig], {
  cwd: root,
  stdio: "inherit",
});
copyFileSync(process.execPath, output);

execFileSync(
  process.execPath,
  [
    postject,
    output,
    "NODE_SEA_BLOB",
    blob,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ],
  { cwd: root, stdio: "inherit" },
);

rmSync(blob);
console.log(`Created ${output}`);
