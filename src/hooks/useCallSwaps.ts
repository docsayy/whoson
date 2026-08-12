import { useEffect, useState } from "react";

import { subscribeToCallSwaps } from "../services/callSwapService";
import type { CallSwapRequest } from "../types/callSwap";

export function useCallSwaps() {
  const [requests, setRequests] = useState<CallSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() =>
    subscribeToCallSwaps(
      (next) => {
        setRequests(next);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error(err);
        setError("Unable to load call-swap requests.");
        setLoading(false);
      }
    ), []);

  return { requests, loading, error };
}
