import { Image, StyleSheet } from 'react-native';

type CareArtworkKind = 'medication' | 'appointment' | 'note' | 'location';

const artwork = {
  medication: require('@/assets/images/care/pill.png'),
  appointment: require('@/assets/images/care/calendar.png'),
  note: require('@/assets/images/care/note.png'),
  location: require('@/assets/images/care/location.png'),
} as const;

export function CareArtwork({ kind, size = 42 }: { kind: CareArtworkKind; size?: number }) {
  return <Image source={artwork[kind]} resizeMode="contain" style={[styles.image, { width: size, height: size }]} />;
}

const styles = StyleSheet.create({ image: { flexShrink: 0 } });
