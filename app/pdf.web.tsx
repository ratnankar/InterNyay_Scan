import { router } from 'expo-router'
import { EmptyState, Header, Screen } from '@/components/ui'

// The in-app PDF viewer renders pages with a native module, so the web build only shows a notice.
export default function PdfViewerWeb() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Document" onBack={() => router.back()} />
      <EmptyState icon="smartphone" title="PDF preview is available in the phone app" message="Open this document in the InterNyay Scan app on your phone." />
    </Screen>
  )
}
