import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily } from '@/src/theme/typography';

export type LocalPhoto = { uri: string; mimeType?: string | null };

type Props = {
  value: LocalPhoto | null;
  remoteUrl?: string | null;
  onChange: (photo: LocalPhoto) => void;
  label?: string;
};

export function ProfilePhotoPicker({ value, remoteUrl, onChange, label = 'Add profile photo' }: Props) {
  const theme = getTheme(useColorScheme() === 'dark');
  const source = value?.uri ?? remoteUrl;

  const chooseFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to select a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (!result.canceled) onChange({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to take a profile picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (!result.canceled) onChange({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  };

  const openOptions = () => Alert.alert(label, 'Choose how you want to add the photo.', [
    { text: 'Camera', onPress: () => void takePhoto() },
    { text: 'Photo library', onPress: () => void chooseFromGallery() },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={openOptions} style={styles.photoButton}>
        {source ? (
          <Image source={{ uri: source }} style={styles.photo} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="person-outline" size={36} color={palette.primaryDark} />
          </View>
        )}
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
      <Text style={[styles.label, { color: theme.subtitle }]}>{label} (optional)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 24 },
  photoButton: { width: 112, height: 112 },
  photo: { width: 112, height: 112, borderRadius: 14 },
  placeholder: { width: 112, height: 112, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.aquaSurface },
  cameraBadge: { position: 'absolute', right: -6, bottom: -6, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryDark, borderWidth: 2, borderColor: '#FFFFFF' },
  label: { marginTop: 10, fontSize: 12, fontFamily: fontFamily.semiBold },
});
