import { useSyncExternalStore } from "react";
import {
  getDataAccessDiagnostics,
  subscribeToDataAccessDiagnostics,
} from "../services/dataCache";

export function useDataAccessDiagnostics() {
  return useSyncExternalStore(
    subscribeToDataAccessDiagnostics,
    getDataAccessDiagnostics,
    getDataAccessDiagnostics
  );
}
