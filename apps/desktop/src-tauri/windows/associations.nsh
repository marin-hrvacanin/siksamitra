/*
 * THE DOCUMENT ICON, on Windows.
 *
 * Tauri writes the file associations itself — the extension, the ProgID, the
 * open command — but it points every one of them at the APPLICATION's icon
 * (`app.exe,0`). That makes a folder of documents look like a folder of copies
 * of the program, which is exactly the thing an icon is supposed to prevent.
 *
 * There is no per-association icon in the Tauri config (checked against the
 * v2 schema: `ext`, `contentTypes`, `name`, `description`, `role`, `mimeType`,
 * `rank`, `exportedType` — and nothing else), so the icon is set here, after
 * the association exists.
 *
 * THE PROGID IS `${BUNDLEID}.${EXT}`, which is what the bundler's own template
 * writes. If that ever changes, this hook writes a key nobody reads — it
 * cannot break the association, only fail to improve it.
 *
 * `SHCTX` is the same hive the installer used (per-user or per-machine,
 * following `installMode`), so an uninstall removes what an install added.
 */

!macro NSIS_HOOK_POSTINSTALL
  ; The document icon, shipped as a resource beside the binary.
  WriteRegStr SHCTX "Software\Classes\${BUNDLEID}.smdoc\DefaultIcon" "" "$INSTDIR\resources\icons\document.ico"
  WriteRegStr SHCTX "Software\Classes\${BUNDLEID}.vuchant\DefaultIcon" "" "$INSTDIR\resources\icons\document.ico"

  ; The name Explorer shows in its Type column, and in "Open with".
  WriteRegStr SHCTX "Software\Classes\${BUNDLEID}.smdoc" "FriendlyTypeName" "śikṣāmitra document"
  WriteRegStr SHCTX "Software\Classes\${BUNDLEID}.vuchant" "FriendlyTypeName" "śikṣāmitra chant package"

  ; Tell the shell to drop its cached icons, or the new ones appear only after
  ; a restart — and the association looks broken until then.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\${BUNDLEID}.smdoc\DefaultIcon"
  DeleteRegKey SHCTX "Software\Classes\${BUNDLEID}.vuchant\DefaultIcon"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
