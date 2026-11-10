# Prüft den Installer auf einem frischen Windows (in der CI, nicht auf Robins Rechner):
# still installieren, Programm und Dateizuordnungen prüfen, still deinstallieren.
$ErrorActionPreference = 'Stop'

$setup = Get-ChildItem 'src-tauri/target/release/bundle/nsis/*-setup.exe' | Select-Object -First 1
if (-not $setup) { throw 'Kein Installer gefunden.' }
Write-Host "Installiere $($setup.Name) still ..."
Start-Process $setup.FullName -ArgumentList '/S' -Wait

$ordner = Join-Path $env:LOCALAPPDATA 'Prozesslotse'
$exe = Join-Path $ordner 'prozesslotse.exe'
if (-not (Test-Path $exe)) { throw "Programm nicht installiert: $exe" }

# .prozesslotse gehört dem Prozesslotsen (pro Benutzer, ohne Admin)
$endung = (Get-ItemProperty 'HKCU:\Software\Classes\.prozesslotse').'(default)'
if ($endung -ne 'Prozesslotse.Projekt') { throw ".prozesslotse zeigt auf '$endung' statt auf Prozesslotse.Projekt" }
$befehl = (Get-ItemProperty 'HKCU:\Software\Classes\Prozesslotse.Projekt\shell\open\command').'(default)'
if ($befehl -notlike '*prozesslotse.exe*%1*') { throw "Öffnen-Befehl für .prozesslotse unerwartet: $befehl" }

# .bpmn nur unter „Öffnen mit“, nicht als Standard
$mit = Get-ItemProperty 'HKCU:\Software\Classes\.bpmn\OpenWithProgids'
if (-not ($mit.PSObject.Properties.Name -contains 'Prozesslotse.BPMN')) { throw '.bpmn fehlt unter „Öffnen mit“' }
$standard = (Get-ItemProperty 'HKCU:\Software\Classes\.bpmn' -ErrorAction SilentlyContinue).'(default)'
if ($standard -eq 'Prozesslotse.BPMN') { throw '.bpmn darf nicht als Standard eingetragen sein' }
$bpmnBefehl = (Get-ItemProperty 'HKCU:\Software\Classes\Prozesslotse.BPMN\shell\open\command').'(default)'
if ($bpmnBefehl -notlike '*prozesslotse.exe*%1*') { throw "Öffnen-Befehl für .bpmn unerwartet: $bpmnBefehl" }

Write-Host 'Installation in Ordnung, deinstalliere still ...'
Start-Process (Join-Path $ordner 'uninstall.exe') -ArgumentList '/S' -Wait
# Der Deinstaller startet sich aus einer Kopie neu; kurz warten, bis er fertig ist
for ($i = 0; $i -lt 30 -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }

if (Test-Path $exe) { throw 'Programm nach der Deinstallation noch vorhanden' }
if (Test-Path 'HKCU:\Software\Classes\Prozesslotse.BPMN') { throw 'BPMN-Eintrag nach der Deinstallation noch vorhanden' }
$rest = Get-ItemProperty 'HKCU:\Software\Classes\.bpmn\OpenWithProgids' -ErrorAction SilentlyContinue
if ($rest -and ($rest.PSObject.Properties.Name -contains 'Prozesslotse.BPMN')) { throw '.bpmn „Öffnen mit“ nach der Deinstallation noch vorhanden' }
Write-Host 'Installer-Test bestanden.'
