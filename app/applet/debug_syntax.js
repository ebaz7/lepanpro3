import fs from "fs";

const code = fs.readFileSync("./components/SecretariatModule.tsx", "utf8");
const lines = code.split("\n");

let stack = [];
for (let lineNum = 2457; lineNum <= lines.length; lineNum++) {
  const line = lines[lineNum - 1];
  let inStr = false;
  let quote = "";
  for (let cIdx = 0; cIdx < line.length; cIdx++) {
    const c = line[cIdx];
    if (inStr) {
      if (c === quote && line[cIdx - 1] !== "\\") inStr = false;
    } else {
      if (c === '"' || c === "'" || c === "`") {
        inStr = true;
        quote = c;
      } else if (c === "{") {
        stack.push({ lineNum, text: line.trim() });
      } else if (c === "}") {
        stack.pop();
      }
    }
  }
}
console.log("Unclosed count:", stack.length);
stack.forEach(s => console.log("Unclosed at line:", s.lineNum, s.text));
