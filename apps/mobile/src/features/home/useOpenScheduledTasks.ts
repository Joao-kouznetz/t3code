import { useNavigation } from "@react-navigation/native";
import { useCallback, useMemo } from "react";

import { useWorkspaceState } from "../../state/workspace";
import { useHomeListOptions } from "./home-list-options";

/** Carry the thread list's machine and project filters into the schedule list. */
export function useOpenScheduledTasks() {
  const navigation = useNavigation();
  const { environments } = useWorkspaceState();
  const environmentIds = useMemo(
    () => new Set(environments.map((entry) => entry.environmentId)),
    [environments],
  );
  const { options: listOptions } = useHomeListOptions(environmentIds);
  return useCallback(() => {
    navigation.navigate("SettingsSheet", {
      screen: "SettingsContent",
      params: {
        screen: "SettingsScheduledTasks",
        params: {
          environmentId: listOptions.selectedEnvironmentId ?? undefined,
          projectKey: listOptions.selectedProjectKey,
        },
      },
    });
  }, [navigation, listOptions.selectedEnvironmentId, listOptions.selectedProjectKey]);
}
