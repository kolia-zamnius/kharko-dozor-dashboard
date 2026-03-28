import { useState } from "react";

/**
 * Local input state that re-syncs to a `serverValue` prop whenever the prop
 * changes.
 *
 * Why this exists: the display-name modal has three sections, each with a
 * text input pre-filled from the server. After a successful mutation the
 * parent's detail query refetches and the section re-renders with a new
 * `serverValue`. The local input state needs to follow — otherwise the
 * field keeps showing stale text after "Set" or "Reset".
 *
 * We don't use `useEffect(() => setValue(serverValue), [serverValue])`
 * because that trips the new React 19 `react-hooks/set-state-in-effect`
 * lint and costs an extra render per prop change. Instead we use the
 * "storing information from previous renders" pattern documented in the
 * React docs: keep a `prevServerValue` sentinel, and when the incoming
 * prop differs from it, update both at the top of render. React collapses
 * the two `setState` calls into one re-render, and the lint rule is happy
 * because we're not inside an effect body.
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
