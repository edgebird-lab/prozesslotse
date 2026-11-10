; .bpmn nur unter „Öffnen mit“ eintragen, nicht als Standard: Sonst würde der
; Installer z. B. den Camunda Modeler als Programm für BPMN-Dateien verdrängen.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Prozesslotse.BPMN" "" "BPMN-Diagramm"
  WriteRegStr HKCU "Software\Classes\Prozesslotse.BPMN\DefaultIcon" "" "$INSTDIR\prozesslotse.exe,0"
  WriteRegStr HKCU "Software\Classes\Prozesslotse.BPMN\shell\open\command" "" '"$INSTDIR\prozesslotse.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.bpmn\OpenWithProgids" "Prozesslotse.BPMN" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue HKCU "Software\Classes\.bpmn\OpenWithProgids" "Prozesslotse.BPMN"
  DeleteRegKey HKCU "Software\Classes\Prozesslotse.BPMN"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
