import { useEffect, useState } from 'react';

import { collectionSummary, onCollectionChange } from './collection';

/** Résumé de la collection, tenu à jour : packs à ouvrir, objets obtenus, magnésie. */
export function useCollectionSummary() {
  const [summary, setSummary] = useState(collectionSummary);
  useEffect(() => {
    setSummary(collectionSummary()); // eslint-disable-line react-hooks/set-state-in-effect
    return onCollectionChange(() => setSummary(collectionSummary()));
  }, []);
  return summary;
}
