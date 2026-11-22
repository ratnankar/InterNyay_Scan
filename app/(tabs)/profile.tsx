import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { clearDownloads } from '@/api/files'
import { Avatar, Button, Card, Screen, Segmented } from '@/components/ui'
import { QUALITY, type QualityId } from '@/constants'
import { clearAllDrafts } from '@/pipeline/importPages'
import { clearExports } from '@/pdf/localPdf'
import type { OcrLanguage } from '@/ocr/types'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { colors, space, type } from '@/theme'
import { usePendingRows } from '@/upload/usePending'
import { initials } from '@/utils/format'

export default function Profile() {
  const user = useSession((s) => s.user)
  const signOut = useSession((s) => s.signOut)
  const { language, quality, setLanguage, setQuality } = useSettings()
  const { waiting } = usePendingRows()

  const confirmSignOut = () => {
    const body =
      waiting.length > 0
        ? `${waiting.length} scan${waiting.length === 1 ? '' : 's'} not yet uploaded will be deleted from this device.`
        : 'Scans and files stored on this device will be removed.'
    Alert.alert('Sign out?', body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  const clearTemp = () => {
    clearDownloads()
    clearExports()
    clearAllDrafts()
    Alert.alert('Temporary files cleared')
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.title} accessibilityRole="header">
          Profile
        </Text>

        <Card style={styles.account}>
          <Avatar label={initials(user?.name)} />
          <View style={styles.accountText}>
            <Text style={type.heading} numberOfLines={1}>
              {user?.name ?? ''}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
            {user?.advocateName ? <Text style={type.small} numberOfLines={1}>{`Associate of ${user.advocateName}`}</Text> : null}
          </View>
        </Card>

        <Text style={[type.heading, styles.section]}>Scan settings</Text>
        <Card style={styles.settings}>
          <View style={styles.setting}>
            <Text style={type.label}>Text recognition language</Text>
            <Segmented<OcrLanguage>
              value={language}
              onChange={setLanguage}
              options={[
                { id: 'auto', label: 'Auto' },
                { id: 'en', label: 'English' },
                { id: 'hi', label: 'Hindi' },
              ]}
            />
            <Text style={type.caption}>Text is read on this device. Pages are not sent anywhere for recognition.</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.setting}>
            <Text style={type.label}>PDF quality</Text>
            <Segmented<QualityId>
              value={quality}
              onChange={setQuality}
              options={(Object.keys(QUALITY) as QualityId[]).map((id) => ({ id, label: QUALITY[id].label }))}
            />
            <Text style={type.caption}>{QUALITY[quality].hint}</Text>
          </View>
        </Card>

        <Text style={[type.heading, styles.section]}>Storage and account</Text>
        <View style={styles.actions}>
          <Button label="Clear temporary files" variant="secondary" icon="trash" onPress={clearTemp} />
          <Button label="Sign out" variant="danger" icon="log-out" onPress={confirmSignOut} />
        </View>
        <Text style={[type.small, styles.version]}>InterNyay Scan 1.0.0</Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  accountText: { flex: 1, gap: 2 },
  section: { marginTop: space.xl, marginBottom: space.sm },
  settings: { padding: 0 },
  setting: { gap: space.sm, padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  actions: { gap: space.md },
  version: { textAlign: 'center', marginTop: space.xl, color: colors.inkFaint },
})
