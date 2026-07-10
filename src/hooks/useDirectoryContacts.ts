import { useEffect, useState } from "react";

import { subscribeToDirectoryContacts } from "../services/directoryContactService";
import type { DirectoryContact } from "../types/directoryContact";

export function useDirectoryContacts() {
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToDirectoryContacts(
      (nextContacts) => {
        setContacts(nextContacts);
        setError("");
        setLoading(false);
      },
      (subscriptionError) => {
        console.error(subscriptionError);
        setError("Unable to load the phone directory.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { contacts, loading, error };
}
