# Windows toast for the engineering harness notifier (hooks/scripts/notify.js).
# Uses the WinRT toast API, so no module has to be installed on a developer's machine.
# Never fails: notify.js ignores the exit code, and every error path here exits 0.
param(
    [string]$Title = 'Claude Code',
    [string]$Body = ''
)

try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI, ContentType = WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotification, Windows.UI, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data, ContentType = WindowsRuntime]

    # PowerShell's own registered AppUserModelID; present on every Windows install.
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
        [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $texts = $xml.GetElementsByTagName('text')
    [void]$texts.Item(0).AppendChild($xml.CreateTextNode($Title))
    [void]$texts.Item(1).AppendChild($xml.CreateTextNode($Body))

    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
} catch {
    exit 0
}
