import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const od = "<div";
const cd = "</motion.div>".replace("motion.", "");

function patch(file, replacements) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  for (const [from, to] of replacements) {
    if (!s.includes(from)) console.warn(`[${file}] MISS`);
    else s = s.replace(from, to);
  }
  fs.writeFileSync(p, s);
  console.log(`[${file}] styles left: ${(s.match(/style=\{\{/g) || []).length}`);
}

const iconOld = (bg, color, Icon) => `          ${od}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "${bg}" }}
          >
            <${Icon} className="w-4 h-4" style={{ color: "${color}" }} />
          ${cd}`;

const settings = fs.readFileSync(path.join(root, "src/pages/Settings.tsx"), "utf8");
const idx = settings.indexOf("rgba(34,211,238,0.12)");
console.log("snippet:", JSON.stringify(settings.slice(idx - 80, idx + 120)));
const keyBlock = iconOld("rgba(34,211,238,0.12)", "var(--primary)", "Key");
console.log("keyBlock:", JSON.stringify(keyBlock));
console.log("keyBlock found?", settings.includes(keyBlock));

patch("src/pages/Settings.tsx", [
  [
    keyBlock,
    `          ${od} className={cn(ui.iconBoxSm, ui.iconCyan)}>
            <Key className="h-4 w-4" />
          ${cd}`,
  ],
  [
    iconOld("rgba(234,179,8,0.12)", "#eab308", "Bell"),
    `          ${od} className={cn(ui.iconBoxSm, ui.iconAmber)}>
            <Bell className="h-4 w-4" />
          ${cd}`,
  ],
  [
    `            ${od}
              key={n.label}
              className="flex items-center justify-between py-2"
              className={cn("flex items-center justify-between py-2", ui.divider)}
            >
              <motion.div>
                <p className="text-sm" style={{ color: "var(--foreground)" }}>
                  {n.label}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {n.desc}
                </p>
              </motion.div>
              ${od}
                className="w-10 h-5.5 rounded-full relative cursor-pointer transition-colors"
                style={{ background: n.checked ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
              >
                ${od}
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: n.checked ? "translateX(20px)" : "translateX(0)" }}
                />
              ${cd}
            ${cd}`,
    `            <motion.div key={n.label} className={cn("flex items-center justify-between py-2", ui.divider)}>
              <motion.div>
                <p className="text-sm text-slate-900">{n.label}</p>
                <p className="text-xs text-slate-500">{n.desc}</p>
              </motion.div>
              <motion.div className={cn(ui.toggle, n.checked ? ui.toggleOn : ui.toggleOff)} role="presentation">
                <motion.div className={ui.toggleKnob} style={{ transform: n.checked ? "translateX(20px)" : "translateX(0)" }} />
              </motion.div>
            </motion.div>`,
  ],
]);
