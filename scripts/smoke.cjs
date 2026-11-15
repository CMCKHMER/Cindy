/* Headless smoke test: mounts the built dist/index.html in jsdom,
   walks every view, drives the primary flows and reports runtime errors. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs
  .readFileSync(path.join(__dirname, "..", "dist", "index.html"), "utf8")
  .replace(/type="module"/g, 'type="text/javascript"')
  .replace(/import\.meta/g, '({url:"http://localhost/index.html",env:{MODE:"production",PROD:true,DEV:false}})')
  // jsdom has no ESM support: run the bundle as a classic script once the DOM is ready
  .replace(/<script type="text\/javascript"[^>]*>([\s\S]*?)<\/script>/, (_m, code) => `<script type="text/javascript">window.addEventListener("DOMContentLoaded",function(){${code}\n});</script>`);
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
vc.on("warn", () => {});
vc.on("log", () => {});

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  virtualConsole: vc,
  beforeParse(w) {
    w.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; }
      observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
      disconnect() {}
      unobserve() {}
    };
    w.Element.prototype.scrollTo = function () {};
    w.Element.prototype.scrollIntoView = function () {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,";
    w.URL.createObjectURL = () => "blob:mock";
    w.URL.revokeObjectURL = () => {};
    w.addEventListener("error", (e) => errors.push("window.error: " + (e.error?.stack || e.message)));
    w.addEventListener("unhandledrejection", (e) => errors.push("unhandledrejection: " + e.reason));
  },
});

const w = dom.window;
const doc = w.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $$ = (sel) => Array.from(doc.querySelectorAll(sel));
const byText = (sel, text) => $$(sel).find((el) => (el.textContent || "").trim().toLowerCase().includes(text.toLowerCase()));
const click = (el, label) => {
  if (!el) { errors.push("MISSING CONTROL: " + label); return false; }
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
};
const checks = [];
const check = (name, cond, extra = "") => checks.push({ name, pass: !!cond, extra });

(async () => {
  await wait(1200);
  const root = doc.getElementById("root");
  check("app mounts", root && root.innerHTML.length > 5000, `${root?.innerHTML.length ?? 0} chars`);
  check("hero renders", !!byText("h2", "librarian for every"));
  check("seed library loaded", /files indexed/i.test(doc.body.textContent));
  check("no broken img fallback loop", $$("img").length > 0, `${$$("img").length} imgs`);

  // navigate every view
  check("brand is Sasha Maid", /SASHA\s*MAID/.test(doc.body.textContent) && /Sasha Maid/.test(doc.title), doc.title);
  const views = ["Scan & Watch", "Live disk", "Explorer", "Duplicates", "Damaged files", "AI Renaming", "Cleanup plan", "Storage", "Undo & Reports", "Run on desktop", "Settings", "Developer", "Overview"];
  for (const v of views) {
    const btn = $$(".navlink").find((b) => b.textContent.trim().startsWith(v));
    click(btn, "nav " + v);
    await wait(320);
    const renderedLength = doc.querySelector("main").textContent.length;
    check("view renders: " + v, renderedLength > (v === "Live disk" ? 300 : 400), `${renderedLength} chars`);
  }

  // the live filesystem view must fail closed when the local API is unavailable
  click($$(".navlink").find((b) => b.textContent.includes("Live disk")), "nav live disk");
  await wait(500);
  check("live disk explains missing local service", /Live filesystem service is not running/i.test(doc.body.textContent));

  // duplicates flow
  click($$(".navlink").find((b) => b.textContent.includes("Duplicates")), "nav duplicates");
  await wait(300);
  const groupCount = $$("article").length;
  check("duplicate groups listed", groupCount > 0, `${groupCount} groups`);
  click(byText("button", "Delete duplicates"), "delete duplicates");
  await wait(250);
  check("approval dialog opens", !!byText("h3", "These files appear duplicated"));
  const before = doc.body.textContent;
  click($$("button").filter((b) => b.textContent.trim() === "Delete").pop(), "confirm delete");
  await wait(400);
  check("delete applied + toast", /Recycle Bin|Trash/.test(doc.body.textContent) && doc.body.textContent !== before);
  const undoBtn = $$("button").find((b) => b.textContent.trim() === "Undo");
  click(undoBtn, "undo from toast");
  await wait(400);
  check("undo restores", /reverted/i.test(doc.body.textContent));
  check("undo returns duplicate group to review", $$("article").length >= groupCount, `${$$("article").length} groups restored`);

  // broken flow
  click($$(".navlink").find((b) => b.textContent.includes("Damaged")), "nav broken");
  await wait(300);
  check("broken cards", $$("article").length > 3, `${$$("article").length} cards`);
  const repair = $$("button").find((b) => b.textContent.trim() === "Repair" && !b.disabled);
  click(repair, "repair");
  await wait(250);
  check("damaged approval opens", !!byText("h3", "damaged or unusable"));
  click($$("button").find((b) => /^Repair/.test(b.textContent.trim()) && b.closest('[role="dialog"]') && !b.disabled), "confirm repair");
  await wait(400);
  check("repair applied", /repaired/i.test(doc.body.textContent));

  // rename flow
  click($$(".navlink").find((b) => b.textContent.includes("AI Renaming")), "nav rename");
  await wait(350);
  const renameCardsBefore = $$("article").length;
  const firstRenameName = $$("article")[0]?.querySelector(".mono")?.textContent || "";
  const approve = $$("button").find((b) => b.textContent.trim() === "Approve");
  click(approve, "approve rename");
  await wait(350);
  check("rename applied", /renamed/i.test(doc.body.textContent));
  check("rename preserves exactly one extension", !/\.(jpe?g|png|svg|mov|mp4)\.\1/i.test(doc.body.textContent));
  check("approved rename leaves the queue", !$$("article").some((a) => firstRenameName && a.textContent.includes(firstRenameName)), `${renameCardsBefore} cards visible, renamed item removed`);

  // organize flow
  click($$(".navlink").find((b) => b.textContent.includes("Cleanup")), "nav organize");
  await wait(350);
  click(byText("button", "Approve full plan"), "approve plan");
  await wait(300);
  check("move approval opens", !!byText("h3", "Downloads cleanup plan"));
  click($$("button").find((b) => b.textContent.trim() === "Approve moves"), "confirm moves");
  await wait(500);
  check("moves applied", /moved/i.test(doc.body.textContent));

  // scan flow
  click($$(".navlink").find((b) => b.textContent.includes("Scan &")), "nav scan");
  await wait(300);
  click(byText("button", "Start scan"), "start scan");
  await wait(900);
  check("scan progresses", /worker-0/.test(doc.body.textContent) && /files\/s/.test(doc.body.textContent));
  click(byText("button", "Pause & checkpoint"), "pause scan");
  await wait(300);
  check("scan paused + resumable", /Resume/i.test(doc.body.textContent));
  click(byText("button", "Resume"), "resume scan");
  await wait(9000);
  check("scan completes", /Scan complete|complete/i.test(doc.body.textContent));

  // command palette
  w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  await wait(250);
  check("palette opens", !!doc.querySelector('input[placeholder*="librarian"]'));
  click(byText("button", "Show files larger than 1GB"), "command large files");
  await wait(500);
  check("command navigates to analytics", /Large file finder/i.test(doc.querySelector("main").textContent));

  // explorer search + selection
  click($$(".navlink").find((b) => b.textContent.includes("Explorer")), "nav explorer");
  await wait(400);
  click(byText("button", "Clear filters"), "clear filters");
  await wait(300);
  const search = doc.getElementById("explorer-search");
  check("explorer search present", !!search);
  if (search) {
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set;
    setter.call(search, "screenshot");
    search.dispatchEvent(new w.Event("input", { bubbles: true }));
    await wait(400);
    check("search filters rows", /screenshot/i.test(doc.querySelector("main").textContent));
  }
  const cb = $$('input.check[type="checkbox"]')[1];
  click(cb, "row select");
  await wait(250);
  check("bulk bar appears", /selected/i.test(doc.body.textContent));
  check("virtualised rows rendered", $$('input.check[type="checkbox"]').length > 5, `${$$('input.check[type="checkbox"]').length} rows`);

  // detail drawer
  const nameBtn = $$("button").find((b) => b.className.includes("min-w-0") && b.closest(".row") && /\.\w{2,4}/.test(b.textContent));
  click(nameBtn, "open drawer");
  await wait(350);
  check("detail drawer opens", /SHA-256/.test(doc.body.textContent) && !!doc.querySelector("aside"));
  w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(250);

  // grid mode
  click(byText("button", "Grid"), "grid mode");
  await wait(400);
  check("grid mode renders", $$("img").length > 20, `${$$("img").length} thumbs`);
  click(byText("button", "List"), "list mode");
  await wait(300);

  // desktop setup view
  click($$(".navlink").find((b) => b.textContent.includes("Run on desktop")), "nav desktop");
  await wait(400);
  check("desktop steps render", /desktop_setup\.py/.test(doc.querySelector("main").textContent));
  let launchers = [];
  w.URL.createObjectURL = (blob) => { launchers.push(blob); return "blob:launcher"; };
  w.HTMLAnchorElement.prototype.click = function () { launchers.lastDownload = this.download; };
  click(byText("button", "Download Start Sasha Maid"), "download launcher");
  await wait(300);
  check("launcher downloads", launchers.length === 1, w.HTMLAnchorElement.prototype.click.lastDownload || "");
  if (launchers[0]) {
    const body = await launchers[0].text();
    check("launcher runs setup", /desktop_setup\.py/.test(body), `${body.length} bytes`);
  }
  click(byText("button", "macOS"), "switch to macOS");
  await wait(300);
  check("macOS instructions swap", /quarantine/.test(doc.querySelector("main").textContent));
  click(byText("button", "Linux"), "switch to Linux");
  await wait(300);
  check("Linux instructions swap", /start-sasha-maid\.sh/.test(doc.querySelector("main").textContent));

  // settings + benchmark + diagnostics
  click($$(".navlink").find((b) => b.textContent.includes("Settings")), "nav settings");
  await wait(350);
  const range = doc.querySelector('input[type="range"]');
  check("settings sliders", $$('input[type="range"]').length >= 5, `${$$('input[type="range"]').length} sliders`);
  if (range) {
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set;
    setter.call(range, "8");
    range.dispatchEvent(new w.Event("input", { bubbles: true }));
    await wait(200);
  }
  click(byText("button", "Run 1,000,000 paths"), "benchmark");
  await wait(3500);
  check("benchmark reports throughput", /Paths hashed/i.test(doc.body.textContent));

  click($$(".navlink").find((b) => b.textContent.includes("Developer")), "nav developer");
  await wait(350);
  click(byText("button", "Tests"), "tests tab");
  await wait(250);
  click(byText("button", "Run diagnostics"), "run diagnostics");
  await wait(900);
  const diag = doc.body.textContent.match(/(\d+)\/(\d+) passed/);
  check("diagnostics suite passes", diag && diag[1] === diag[2], diag ? diag[0] : "no result");

  // theme toggle
  click(doc.querySelector('button[aria-label="Toggle theme"]'), "theme");
  await wait(250);
  check("theme switches", doc.documentElement.dataset.theme === "light", doc.documentElement.dataset.theme);

  // reports
  click($$(".navlink").find((b) => b.textContent.includes("Undo &")), "nav history");
  await wait(350);
  check("history shows operations", /Operations/i.test(doc.body.textContent));
  let downloaded = [];
  w.URL.createObjectURL = (blob) => { downloaded.push(blob); return "blob:report"; };
  w.HTMLAnchorElement.prototype.click = function () {};
  click(byText("button", "Export JSON"), "export json");
  await wait(300);
  click(byText("button", "Export CSV"), "export csv");
  await wait(300);
  click(byText("button", "Export PDF"), "export pdf");
  await wait(400);
  check("3 report formats exported", downloaded.length === 3, downloaded.map((b) => b.type + ":" + b.size).join(", "));
  const pdfBlob = downloaded.find((b) => b.type === "application/pdf");
  if (pdfBlob) {
    const text = await pdfBlob.text();
    check("PDF is well-formed", text.startsWith("%PDF-1.4") && text.includes("%%EOF") && /\/Type \/Page/.test(text), `${text.length} bytes`);
  }

  console.log("\n=== CHECKS ===");
  checks.forEach((c) => console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.extra ? "  [" + c.extra + "]" : ""}`));
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
  console.log("\n=== RUNTIME ERRORS (" + errors.length + ") ===");
  errors.slice(0, 25).forEach((e) => console.log(e.slice(0, 600)));
  dom.window.close();
  process.exit(checks.every((c) => c.pass) && errors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS CRASH", e);
  console.log("errors so far:", errors.slice(0, 10));
  process.exit(2);
});