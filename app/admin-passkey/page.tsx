// app/admin-passkeys/page.tsx
import PasskeyManagement from '../Passkeymanagement'

export default function PasskeysAdminPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <PasskeyManagement isDark={true} />
    </div>
  )
}