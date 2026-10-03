import { router, useLocalSearchParams } from 'expo-router';

import { BlockForm } from '@/components/BlockForm';
import { Empty } from '@/components/ui';
import { getBlock, updateBlock } from '@/lib/db';
import { deletePhoto } from '@/lib/photos';

export default function EditBlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const block = getBlock(Number(id));
  if (!block) return <Empty icon="search_off" text="Grimpe introuvable." />;
  const { id: _id, gymName: _gymName, ...initial } = block;
  return (
    <BlockForm
      initial={initial}
      onSave={(b) => {
        if (block.photoUri && block.photoUri !== b.photoUri) deletePhoto(block.photoUri);
        updateBlock(block.id, b);
        router.back();
      }}
    />
  );
}
