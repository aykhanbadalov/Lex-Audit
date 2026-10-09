import {
  File as FileIcon,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { extensionOf } from "./limits";

const ICONS: Record<string, LucideIcon> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  csv: FileSpreadsheet,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  xml: FileCode,
  zip: FileArchive,
};

export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[extensionOf(name)] ?? FileIcon;
  return <Icon className={className ?? "size-4 shrink-0"} aria-hidden="true" />;
}
