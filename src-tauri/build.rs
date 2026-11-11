fn main() {
    // Eigene Befehle nur über Rechte freigeben (capabilities/default.json), nicht pauschal.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "start_datei",
        "oeffnen",
        "speichern",
        "speichern_unter",
        "speichern_unter_bytes",
        "zuletzt",
        "oeffne_zuletzt",
        "als_pdf",
    ])))
    .expect("Fehler beim Vorbereiten des Tauri-Builds");
}
