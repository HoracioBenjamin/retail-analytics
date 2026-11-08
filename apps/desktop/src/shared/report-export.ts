export type ReportPdfResult =
  | { ok: true; canceled: true }
  | { ok: true; canceled: false; fileName: string }
  | { ok: false; error: string }

export interface ReportExportApi {
  saveCurrentReportAsPdf: () => Promise<ReportPdfResult>
}
