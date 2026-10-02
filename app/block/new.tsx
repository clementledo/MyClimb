import { router } from 'expo-router';
import { useState } from 'react';

import { BlockForm } from '@/components/BlockForm';
import { Empty } from '@/components/ui';
import { insertBlock } from '@/lib/db';
import { getSession } from '@/lib/session';

/** Ajout d'une grimpe, toujours pendant une séance. */
export default function NewBlockScreen() {
  const [session] = useState(() => getSession());
  if (!session) return <Empty text="Démarre une séance depuis une salle pour ajouter des grimpes." />;
  return (
    <BlockForm
      session={session}
      onSave={(b) => {
        insertBlock(b);
        router.back();
      }}
    />
  );
}
