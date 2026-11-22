import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { Button } from '@/components/ui'

export default function Crop() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text>Cropping is not available in the web build yet.</Text>
      <Button label="Back" onPress={() => router.back()} />
    </View>
  )
}
