// Appearance: light, dark or the device's own. Stored on this device (lib/theme.ts).
import { Monitor, Moon, Sun } from "lucide-react";
import { ChoiceCards } from "../../components/ui";
import { setThemeMode, useThemeMode, type ThemeMode } from "../../lib/theme";

const modes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match system", icon: Monitor },
];

export default function Appearance() {
  const mode = useThemeMode();
  return (
    <ChoiceCards
      label="Theme"
      options={modes.map((m) => ({ id: m.id, label: m.label, icon: <m.icon size={16} strokeWidth={1.75} /> }))}
      value={mode}
      onChange={setThemeMode}
    />
  );
}
