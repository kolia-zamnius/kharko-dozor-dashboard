import { useState } from "react";

/**
 * setState-during-render sentinel pattern — `useEffect`-based sync trips the
 * React 19 `react-hooks/set-state-in-effect` lint and costs an extra render.
 * The two `setState` calls here collapse into one re-render.
 */
export function useServerSyncedInput(serverValue: string) {
  const [value, setValue] = useState(serverValue);
  const [prevServerValue, setPrevServerValue] = useState(serverValue);

  if (prevServerValue !== serverValue) {
    setPrevServerValue(serverValue);
    setValue(serverValue);
  }

  return [value, setValue] as const;
}
