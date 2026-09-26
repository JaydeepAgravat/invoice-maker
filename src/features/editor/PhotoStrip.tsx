import { Camera, ImagePlus, Images, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  addPhoto,
  listPhotos,
  removePhoto,
  type Photo,
} from '@/data/repositories/attachments';
import NativeMedia from '@/specs/NativeMedia';
import {
  Divider,
  Icon,
  ListRow,
  Sheet,
  Text,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

const PHOTO = { maxSize: 1600, format: 'jpeg', folder: 'photos' };

/**
 * Job photos on a document: printed on an appendix page and carried over
 * when an estimate becomes an invoice.
 */
export function PhotoStrip({ documentId }: { documentId: string }) {
  const { t } = useTranslation();
  const addSheet = useRef<SheetRef>(null);
  const photoSheet = useRef<SheetRef>(null);
  const [selected, setSelected] = useState<Photo | null>(null);
  const { data: photos } = useLiveQuery(
    db => listPhotos(db, documentId),
    [documentId],
  );

  const add = async (source: 'camera' | 'library') => {
    addSheet.current?.dismiss();
    try {
      const file =
        source === 'camera'
          ? await NativeMedia?.takePhoto(PHOTO)
          : await NativeMedia?.pickImage(PHOTO);
      if (file) {
        await mutate(tx => addPhoto(tx, clock, documentId, file));
      }
    } catch {
      toast.show({ message: t('expenses.photoFailed'), tone: 'danger' });
    }
  };

  const remove = async () => {
    photoSheet.current?.dismiss();
    if (!selected) {
      return;
    }
    const orphan = await mutate(tx => removePhoto(tx, selected.id));
    if (orphan) {
      NativeMedia?.deleteFile(orphan);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {(photos ?? []).map(p => (
          <Touchable
            key={p.id}
            feedback="scale"
            onPress={() => {
              setSelected(p);
              photoSheet.current?.present();
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('photos.photo')}
          >
            <Image source={{ uri: `file://${p.path}` }} style={styles.photo} />
          </Touchable>
        ))}
        <Touchable
          testID="add-photo"
          feedback="scale"
          style={styles.add}
          onPress={() => addSheet.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={t('photos.add')}
        >
          <Icon icon={ImagePlus} size={22} tone="accent" />
          <Text variant="caption" tone="accent">
            {t('photos.add')}
          </Text>
        </Touchable>
      </ScrollView>

      <Sheet ref={addSheet} title={t('photos.add')}>
        <ListRow leadingIcon={Camera} title={t('expenses.takePhoto')} onPress={() => add('camera')} />
        <Divider inset={52} />
        <ListRow leadingIcon={Images} title={t('expenses.choosePhoto')} onPress={() => add('library')} />
      </Sheet>
      <Sheet ref={photoSheet} title={t('photos.photo')}>
        {selected ? (
          <Image
            source={{ uri: `file://${selected.path}` }}
            style={styles.preview}
            resizeMode="contain"
          />
        ) : null}
        <ListRow leadingIcon={Trash2} title={t('photos.remove')} destructive onPress={remove} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  row: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.subtle,
  },
  add: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: theme.stroke.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.bg.app,
  },
  preview: {
    height: 260,
    marginHorizontal: theme.size.gutter,
    marginBottom: theme.space[3],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.subtle,
  },
}));
