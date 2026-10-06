; F15 · "Open with" for .pdf and .epub (decision 2026-10-06: offer only, never take over the default).
; electron-builder's own fileAssociations also sets the ".pdf" default and leaves it behind on
; uninstall, so the entries are written here instead. Only "offer" keys are written:
;   - a ProgID per type (how to open it, with the app's icon),
;   - OpenWithProgids on the extension (lists the app under right-click > Open with),
;   - Capabilities + RegisteredApplications (lists it in Settings > Default apps).
; The extension's own default value and the user's choice (UserChoice) are never touched.

!macro EbookReaderProgId TYPE DESC
  WriteRegStr SHELL_CONTEXT "Software\Classes\EbookReader.${TYPE}" "" "${DESC}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\EbookReader.${TYPE}" "FriendlyTypeName" "${DESC}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\EbookReader.${TYPE}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\EbookReader.${TYPE}\shell\open" "FriendlyAppName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\EbookReader.${TYPE}\shell\open\command" "" '"$appExe" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.${TYPE}\OpenWithProgids" "EbookReader.${TYPE}"
  WriteRegStr SHELL_CONTEXT "Software\EbookReader\Capabilities\FileAssociations" ".${TYPE}" "EbookReader.${TYPE}"
!macroend

!macro customInstall
  !insertmacro EbookReaderProgId "pdf" "PDF document"
  !insertmacro EbookReaderProgId "epub" "EPUB book"
  WriteRegStr SHELL_CONTEXT "Software\EbookReader\Capabilities" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "Software\EbookReader\Capabilities" "ApplicationDescription" "Offline reader for PDF and EPUB books"
  WriteRegStr SHELL_CONTEXT "Software\EbookReader\Capabilities" "ApplicationIcon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}" "Software\EbookReader\Capabilities"
  ; Tell Explorer the associations changed.
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "EbookReader.pdf"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.epub\OpenWithProgids" "EbookReader.epub"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\EbookReader.pdf"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\EbookReader.epub"
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}"
  DeleteRegKey SHELL_CONTEXT "Software\EbookReader"
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend
