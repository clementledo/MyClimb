import { router, useLocalSearchParams } from 'expo-router';

import { BlockForm } from '@/components/BlockForm';
import { insertBlock } from '@/lib/db';

export default function NewBlockScreen() {
  const { gymId } = useLocalSearchParams<{ gymId?: string }>();
  return (
    <BlockForm
      gymId={gymId}
      onSave={(b) => {
        const id = insertBlock(b);
        router.replace({ pathname: '/block/[id]', params: { id: String(id) } });
      }}
    />
  );
}
